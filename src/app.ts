import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import express from 'express';
import routes from './api/routes';
const app = express();

app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/', routes);

const port = process.env.PORT || 8080;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log('Server listening on', port));
}

export default app;