import { Request, Response } from 'express';
import { extractTextFromFile } from '../../services/extraction.service';
import { uploadBuffer } from '../../services/storage.service';
import { pool } from '../../db/pool';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!;

const ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/plain'
]);

function ensureAllowedFile(file?: Express.Multer.File) {
  if (!file) return;
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new Error(
      `Unsupported file type: ${file.mimetype}. Allowed types: pdf (.pdf), docx (.docx), txt (.txt)`
    );
  }
}

export async function uploadHandler(req: Request, res: Response) {
  try {
    const cvFile = (req.files as any)?.cv?.[0] as Express.Multer.File | undefined;
    const projectFile = (req.files as any)?.project_report?.[0] as Express.Multer.File | undefined;

    if (!cvFile && !projectFile) {
      return res.status(400).json({ error: 'cv or project_report file required' });
    }

    // Validate that uploaded files are not empty
    if (cvFile && cvFile.size === 0) {
      return res.status(400).json({ error: 'CV file cannot be empty.' });
    }
    if (projectFile && projectFile.size === 0) {
      return res.status(400).json({ error: 'Project report file cannot be empty.' });
    }

    // Validate MIME types before any DB/storage work
    try {
      ensureAllowedFile(cvFile);
      ensureAllowedFile(projectFile);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      const taskRes = await client.query(
        `insert into tasks (status) values ('uploaded') returning id`
      );
      const taskId = taskRes.rows[0].id;

      for (const f of [cvFile, projectFile].filter(Boolean) as Express.Multer.File[]) {
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
          role: (f as Express.Multer.File).fieldname === 'cv' ? 'cv' : 'project',
          filename: (f as Express.Multer.File).originalname,
          mimetype: (f as Express.Multer.File).mimetype
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
    res.status(500).json({ error: 'internal_error' });
  }
}