import { Request, Response } from 'express';
import { pool } from '../../db/pool';

export async function resultHandler(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const taskRes = await pool.query(`select id, status from tasks where id=$1`, [id]);
    if (!taskRes.rowCount) return res.status(404).json({ error: 'not found' });

    const { status } = taskRes.rows[0];
    if (status !== 'completed') {
      return res.json({ id, status });
    }
    const resultRes = await pool.query(
      `select cv_match_rate, cv_feedback, project_score, project_feedback, overall_summary
       from results where task_id=$1`,
      [id]
    );
    return res.json({
      id,
      status,
      result: resultRes.rows[0] || null
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}