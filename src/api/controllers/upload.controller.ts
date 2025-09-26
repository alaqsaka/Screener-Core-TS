import { Request, Response } from 'express';
import { extractTextFromFile } from '../../services/extraction.service';
import { uploadBuffer } from '../../services/storage.service';
import { pool } from '../../db/pool';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!;

export async function uploadHandler(req: Request, res: Response) {
  try {
    const cvFile = (req.files as any)?.cv?.[0];
    const projectFile = (req.files as any)?.project_report?.[0];
    if (!cvFile && !projectFile) {
      return res.status(400).json({ error: 'cv or project_report file required' });
    }
    const client = await pool.connect();
    try {
      await client.query('begin');
      const taskRes = await client.query(
        `insert into tasks (status) values ('uploaded') returning id`
      );
      const taskId = taskRes.rows[0].id;

      for (const f of [cvFile, projectFile].filter(Boolean)) {
        const pathKey = await uploadBuffer(
            BUCKET,
            taskId,
            f.originalname,
            f.buffer,
            f.mimetype
        );
        const extracted = await extractTextFromFile(f);
        console.log('Extracted text length:', extracted.length);
        await client.query(
          `insert into files (task_id, role, original_filename, mimetype, storage_path, extracted_text)
           values ($1,$2,$3,$4,$5,$6)`,
          [
            taskId,
            f.fieldname === 'cv' ? 'cv' : 'project',
            f.originalname,
            f.mimetype,
            pathKey,
            extracted
          ]
        );
      }
      await client.query('commit');
      res.status(201).json({
        id: taskId,
        status: 'uploaded',
        files: [cvFile, projectFile].filter(Boolean).map(f => ({
          role: f.fieldname === 'cv' ? 'cv' : 'project',
          filename: f.originalname,
          mimetype: f.mimetype
        }))
      });
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  } catch (e: any) {
    console.error('Error in uploadHandler:', e);
    res.status(500).json({ error: e});
  }
}