import { Router, RequestHandler } from 'express';
import multer from 'multer';
import { uploadHandler } from './controllers/upload.controller';
import { evaluateHandler } from './controllers/evaluate.controller';
import { resultHandler } from './controllers/result.controller';

const router = Router();

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);

const uploadCore = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: (Number(process.env.FILE_MAX_MB) || 5) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    const err: any = new Error(
      `Unsupported file type: ${file.mimetype}. Allowed: pdf (.pdf), docx (.docx), txt (.txt)`
    );
    err.code = 'UNSUPPORTED_FILE_TYPE';
    return cb(err);
  }
}).fields([
  { name: 'cv', maxCount: 1 },
  { name: 'project_report', maxCount: 1 }
]);

const uploadWithJsonErrors: RequestHandler = (req, res, next) => {
  uploadCore(req, res, (err: any) => {
    if (err) {
      const status = err.code === 'UNSUPPORTED_FILE_TYPE' ? 415 : 400;
      return res.status(status).json({
        error: 'unsupported_media_type',
        message: 'Only document files are allowed.',
        detail: err.message,
        allowed: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
        received: err.field ? { field: err.field, mimetype: err.mimetype } : undefined
      });
    }
    next();
  });
};

router.post('/upload', uploadWithJsonErrors, uploadHandler);
router.post('/evaluate', evaluateHandler);
router.get('/result/:id', resultHandler);

export default router;