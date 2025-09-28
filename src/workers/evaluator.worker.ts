import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { Worker, Job } from 'bullmq'; 
import { connection } from './queue'; 
import { pool } from '../db/pool'; 
import { extractCV, scoreCV, evaluateProject, refineSummary } from '../services/llm/chain.orchestrator'; 
import { computeCvMatchRate, computeProjectScore } from '../utils/scoring'; 
import { validateCvEval, validateProjectEval } from '../utils/validators'; 
import { withBackoff } from '../utils/backoff'; 
import { jobDescription, rubricSchema, rubricWeights } from '../config';

async function processJob(job: Job){
  const { taskId } = job.data;
  console.log('[worker] Received job', job.id, 'taskId:', taskId);

  await pool.query(`update tasks set status='processing', updated_at=now() where id=$1`, [taskId]);

  try { 
    console.log(`[WORKER_DEBUG] Fetching files for taskId: ${taskId}`);
    const filesRes = await pool.query(`select role, extracted_text from files where task_id=$1`, [taskId] );

    const cvText = filesRes.rows.find(r => r.role === 'cv')?.extracted_text || '';
    const projectText = filesRes.rows.find(r => r.role === 'project')?.extracted_text || '';
    console.log(`[WORKER_DEBUG] CV Text length: ${cvText.length}`);
    console.log(`[WORKER_DEBUG] Project Text length: ${projectText.length}`);

    const jobDescText = Array.isArray(jobDescription)
      ? jobDescription.map(j => j.text ?? '').join('\n')
      : String(jobDescription ?? '');
    console.log(`[WORKER_DEBUG] Job Description Text length: ${jobDescText.length}`);

    const rubricForPrompt = { schema: rubricSchema, weights: rubricWeights };
    console.log('[WORKER_DEBUG] Rubric for prompt:', JSON.stringify(rubricForPrompt, null, 2));

    console.log('[WORKER_DEBUG] Starting CV extraction');
    const extracted = cvText
      ? await withBackoff(() => extractCV(cvText))
      : null;
    console.log('[WORKER_DEBUG] Result of extractCV:', JSON.stringify(extracted, null, 2));

    const cvEval = extracted
      ? await withBackoff(() => scoreCV(extracted, jobDescText, rubricForPrompt))
      : null;
    console.log('[WORKER_DEBUG] Result of scoreCV:', JSON.stringify(cvEval, null, 2));

    if (cvEval && !validateCvEval(cvEval)) {
      throw new Error('Invalid CV evaluation JSON from LLM');
    }

    const projEval = projectText
      ? await withBackoff(() => evaluateProject(projectText, jobDescText, rubricForPrompt))
      : null;
    console.log('[WORKER_DEBUG] Result of evaluateProject:', JSON.stringify(projEval, null, 2));

    if (projEval && !validateProjectEval(projEval)) {
      throw new Error('Invalid Project evaluation JSON from LLM');
    }

    const cv_match_rate = cvEval
      ? computeCvMatchRate({
          technical_skills: cvEval.technical_skills,
          experience_level: cvEval.experience_level,
          achievements: cvEval.achievements,
          cultural_fit: cvEval.cultural_fit
        })
      : 0;
    console.log(`[WORKER_DEBUG] Computed CV Match Rate: ${cv_match_rate}`);

  const project_score = projEval
    ? computeProjectScore({
        correctness: projEval.correctness,
        code_quality: projEval.code_quality,
        resilience: projEval.resilience,
        documentation: projEval.documentation,
        creativity: projEval.creativity
      })
    : 0;
    console.log(`[WORKER_DEBUG] Computed Project Score: ${project_score}`);

    const overall_summary = await withBackoff(() => refineSummary(cvEval, projEval));
    console.log(`[WORKER_DEBUG] Refined Overall Summary: ${overall_summary}`);

    const resultData = {
      taskId,
      cv_match_rate,
      cv_feedback: cvEval?.notes ?? null,
      project_score,
      project_feedback: projEval?.notes ?? null,
      overall_summary,
      raw_llm_outputs: { config: { jobDescription, rubricSchema, rubricWeights }, extracted, cvEval, projEval }
    };
    console.log('[WORKER_DEBUG] Data being saved to results table:', JSON.stringify(resultData, null, 2));

    await pool.query(
      `insert into results (task_id, cv_match_rate, cv_feedback, project_score, project_feedback, overall_summary, raw_llm_outputs)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (task_id) do update set
         cv_match_rate=excluded.cv_match_rate,
         cv_feedback=excluded.cv_feedback,
         project_score=excluded.project_score,
         project_feedback=excluded.project_feedback,
         overall_summary=excluded.overall_summary,
         raw_llm_outputs=excluded.raw_llm_outputs`,
      [
        resultData.taskId,
        resultData.cv_match_rate,
        resultData.cv_feedback,
        resultData.project_score,
        resultData.project_feedback,
        resultData.overall_summary,
        resultData.raw_llm_outputs
      ]
    );

    await pool.query(`update tasks set status='completed', updated_at=now() where id=$1`, [taskId]);
    console.log('[worker] Completed task', taskId);
    return true;
  } catch (err: any) { 
    console.error('[worker] Failed task', taskId, err);
    await pool.query(`update tasks set status='failed', updated_at=now() where id=$1`, [taskId]); throw err; 
  } 
}

export const evaluatorWorker = new Worker('evaluation', processJob, { connection });

evaluatorWorker.on('ready', () => console.log('[worker] Ready and listening')); 
evaluatorWorker.on('active', job => console.log('[worker] Active job', job.id)); 
evaluatorWorker.on('failed', (job, err) => console.error('[worker] Job failed', job?.id, err.message) ); 
evaluatorWorker.on('completed', job => console.log('[worker] Job completed', job.id));
