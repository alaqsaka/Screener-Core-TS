import { Request, Response } from 'express'; import { pool } from '../../db/pool'; 
import { evaluationQueue } from '../../workers/queue';

export async function evaluateHandler(req: Request, res: Response) { 
  try { 
    const { taskId } = req.body || {}; 
    if (!taskId) { 
      return res.status(400).json({ error: 'taskId required' }); 
    }

    const { rowCount } = await pool.query('select 1 from tasks where id=$1', [taskId]);
    if (!rowCount) return res.status(404).json({ error: 'task not found' });
   
    await pool.query(`update tasks set status='queued', updated_at=now() where id=$1`, [taskId]);
  
    const job = await evaluationQueue.add('evaluate', { taskId });
    res.json({ id: job.id, status: 'queued' });

  } catch (e: any) { 
    res.status(500).json({ error: e.message }); 
  } 
}
