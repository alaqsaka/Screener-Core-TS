import { Request, Response, RequestHandler } from 'express';
import { extractTextFromFile } from '../../services/extraction.service';
import { uploadBuffer } from '../../services/storage.service';
import { pool } from '../../db/pool';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET!;

const ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

export const uploadHandler: RequestHandler = async (req: Request, res: Response) => {
  try {
    const files = req.files as {
      cv?: Express.Multer.File[];
      project_report?: Express.Multer.File[];
    } | undefined;

    const cvFile = files?.cv?.[0];
    const projectFile = files?.project_report?.[0];

    if (!cvFile && !projectFile) {
      return res.status(400).json({ error: 'cv or project_report file required' });
    }

    if (cvFile && cvFile.size === 0) {
      return res.status(400).json({ error: 'CV file cannot be empty.' });
    }
    if (projectFile && projectFile.size === 0) {
      return res.status(400).json({ error: 'Project report file cannot be empty.' });
    }

    try {
      ensureAllowedFile(cvFile);
      ensureAllowedFile(projectFile);
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'invalid_file' });
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
      return res.status(201).json({
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
  } catch (e: unknown) {
    console.error('Error in uploadHandler:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
};
