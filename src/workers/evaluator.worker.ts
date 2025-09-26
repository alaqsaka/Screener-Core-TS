// src/workers/evaluator.worker.ts
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { Worker, Job } from 'bullmq';
import { connection } from './queue';
import { pool } from '../db/pool';

async function processJob(job: Job) {
  const { taskId } = job.data;
  console.log('[worker] Received job', job.id, 'taskId:', taskId);
  await pool.query(`update tasks set status='processing', updated_at=now() where id=$1`, [taskId]);

  try {
    const taskRes = await pool.query(`select job_meta from tasks where id=$1`, [taskId]);
    const filesRes = await pool.query(
      `select role, extracted_text from files where task_id=$1`,
      [taskId]
    );

    const cvText = filesRes.rows.find(r => r.role === 'cv')?.extracted_text || '';
    const projectText = filesRes.rows.find(r => r.role === 'project')?.extracted_text || '';
    const jobMeta = taskRes.rows[0]?.job_meta || {};

    const placeholder = {
      cv_match_rate: 0,
      cv_feedback: 'Pending scoring implementation',
      project_score: 0,
      project_feedback: 'Pending project evaluation implementation',
      overall_summary: 'Not generated yet',
      raw_llm_outputs: {
        meta: jobMeta,
        lengths: { cv: cvText.length, project: projectText.length }
      }
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
      [
        taskId,
        placeholder.cv_match_rate,
        placeholder.cv_feedback,
        placeholder.project_score,
        placeholder.project_feedback,
        placeholder.overall_summary,
        placeholder.raw_llm_outputs
      ]
    );

    await pool.query(`update tasks set status='completed', updated_at=now() where id=$1`, [taskId]);
    console.log('[worker] Completed task', taskId);
    return true;
  } catch (err) {
    console.error('[worker] Failed task', taskId, err);
    await pool.query(`update tasks set status='failed', updated_at=now() where id=$1`, [taskId]);
    throw err;
  }
}

export const evaluatorWorker = new Worker('evaluation', processJob, { connection });

evaluatorWorker.on('ready', () => console.log('[worker] Ready and listening'));
evaluatorWorker.on('active', job => console.log('[worker] Active job', job.id));
evaluatorWorker.on('failed', (job, err) =>
  console.error('[worker] Job failed', job?.id, err.message)
);
evaluatorWorker.on('completed', job => console.log('[worker] Job completed', job.id));