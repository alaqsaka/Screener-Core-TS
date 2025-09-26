import { Router } from 'express';
import multer from 'multer';
import { uploadHandler } from './controllers/upload.controller';
import { evaluateHandler } from './controllers/evaluate.controller';
import { resultHandler } from './controllers/result.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.FILE_MAX_MB) || 5) * 1024 * 1024 }
});

router.post(
  '/upload',
  upload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'project_report', maxCount: 1 }
  ]),
  uploadHandler
);

router.post('/evaluate', evaluateHandler);
router.get('/result/:id', resultHandler);

export default router;