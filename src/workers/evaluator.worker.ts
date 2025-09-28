import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { Worker, Job } from 'bullmq';
import { connection } from './queue';
import { pool } from '../db/pool';
import { extractCV, scoreCV, evaluateProject, refineSummary } from '../services/llm/chain.orchestrator';
import { computeCvMatchRate, computeProjectScore } from '../utils/scoring';
import { validateCvEval, validateProjectEval } from '../utils/validators';
import { withBackoff } from '../utils/backoff';
import { searchRelevantChunks } from '../services/vector.service';

async function processJob(job: Job) {
  const { taskId } = job.data;
  console.log('[worker] Received job', job.id, 'taskId:', taskId);

  await pool.query(`update tasks set status='processing', updated_at=now() where id=$1`, [taskId]);

  try {
    console.log(`[WORKER] Fetching files for taskId: ${taskId}`);
    const filesRes = await pool.query(`select role, extracted_text from files where task_id=$1`, [taskId]);

    const cvText = filesRes.rows.find(r => r.role === 'cv')?.extracted_text || '';
    const projectText = filesRes.rows.find(r => r.role === 'project')?.extracted_text || '';
    console.log(`[WORKER] CV Text length: ${cvText.length}`);
    console.log(`[WORKER] Project Text length: ${projectText.length}`);

    // --- RAG Implementation Step 1: Get Context for CV ---
    console.log('[WORKER_RAG] Searching for context relevant to the CV...');
    const cvContextChunks = await searchRelevantChunks(cvText, 7);
    const cvContext = cvContextChunks.map(c => c.content).join('\n\n---\n\n');
    console.log(`[WORKER_RAG] Found CV context, length: ${cvContext.length}`);

    // --- RAG Implementation Step 2: Get Context for Project ---
    console.log('[WORKER_RAG] Searching for context relevant to the Project...');
    const projectContextChunks = await searchRelevantChunks(projectText, 7);
    const projectContext = projectContextChunks.map(c => c.content).join('\n\n---\n\n');
    console.log(`[WORKER_RAG] Found Project context, length: ${projectContext.length}`);

    // --- Evaluation using RAG context ---
    console.log('[WORKER] Starting CV extraction');
    const extracted = cvText ? await withBackoff(() => extractCV(cvText)) : null;
    console.log('[WORKER] Result of extractCV:', JSON.stringify(extracted, null, 2));

    const cvEval = extracted
      ? await withBackoff(() => scoreCV(extracted, cvContext)) // Use RAG context
      : null;
    console.log('[WORKER] Result of scoreCV:', JSON.stringify(cvEval, null, 2));

    if (cvEval && !validateCvEval(cvEval)) {
      throw new Error('Invalid CV evaluation JSON from LLM');
    }

    const projEval = projectText
      ? await withBackoff(() => evaluateProject(projectText, projectContext)) // Use RAG context
      : null;
    console.log('[WORKER] Result of evaluateProject:', JSON.stringify(projEval, null, 2));

    if (projEval && !validateProjectEval(projEval)) {
      throw new Error('Invalid Project evaluation JSON from LLM');
    }

    // --- Scoring and Summary (no changes needed here) ---
    const cv_match_rate = cvEval ? computeCvMatchRate(cvEval) : 0;
    console.log(`[WORKER] Computed CV Match Rate: ${cv_match_rate}`);

    const project_score = projEval ? computeProjectScore(projEval) : 0;
    console.log(`[WORKER] Computed Project Score: ${project_score}`);

    const overall_summary = await withBackoff(() => refineSummary(cvEval, projEval));
    console.log(`[WORKER] Refined Overall Summary: ${overall_summary}`);

    // --- Save results to database ---
    const resultData = {
      taskId,
      cv_match_rate,
      cv_feedback: cvEval?.notes ?? null,
      project_score,
      project_feedback: projEval?.notes ?? null,
      overall_summary,
      raw_llm_outputs: { extracted, cvEval, projEval, cvContext, projectContext } // Save RAG context for debugging
    };

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
      Object.values(resultData)
    );

    await pool.query(`update tasks set status='completed', updated_at=now() where id=$1`, [taskId]);
    console.log('[worker] Completed task', taskId);
    return true;
  } catch (err: any) {
    console.error('[worker] Failed task', taskId, err);
    await pool.query(`update tasks set status='failed', updated_at=now() where id=$1`, [taskId]);
    throw err;
  }
}

export const evaluatorWorker = new Worker('evaluation', processJob, { connection });

evaluatorWorker.on('ready', () => console.log('[worker] Ready and listening'));
evaluatorWorker.on('active', job => console.log('[worker] Active job', job.id));
evaluatorWorker.on('failed', (job, err) => console.error('[worker] Job failed', job?.id, err.message));
evaluatorWorker.on('completed', job => console.log('[worker] Job completed', job.id));