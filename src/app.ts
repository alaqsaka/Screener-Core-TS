import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import express, { NextFunction } from 'express';
import routes from './api/routes';
import path from 'path';
import { jobDescription } from './config';
import { pool } from './db/pool';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, '../views'));
app.use(express.static(path.resolve(__dirname, '../public')));

app.get('/', (_req, res) => {
  res.render('index', { jobDescription });
});

app.get('/:taskId', async (req, res, next: NextFunction) => {
  const { taskId } = req.params;
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(taskId)) {
    return next();
  }
  try {
    const taskRes = await pool.query(`SELECT id, status FROM tasks WHERE id=$1`, [taskId]);
    if (!taskRes.rowCount) {
      return res.status(404).send('Task not found');
    }
    const filesRes = await pool.query(`SELECT role, original_filename, extracted_text FROM files WHERE task_id=$1`, [taskId]);
    res.render('result', {
      taskId,
      task: taskRes.rows[0],
      files: filesRes.rows
    });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error loading task page.');
  }
});


app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true, message: 'hello world!' }));
app.use('/', routes);

const port = process.env.PORT || 8080;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log('Server listening on', port));
}

export default app;