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
    if (ALLOWED_MIME.has(file.mimetype)) {
      return cb(null, true);
    }
    
    const err = new Error(
      `Unsupported file type: ${file.mimetype}. Allowed: pdf (.pdf), docx (.docx), txt (.txt)`
    ) as Error & { code: string; field: string; mimetype: string };

    err.code = 'UNSUPPORTED_FILE_TYPE';
    err.field = file.fieldname;
    err.mimetype = file.mimetype;
    return cb(err);
  }
}).fields([
  { name: 'cv', maxCount: 1 },
  { name: 'project_report', maxCount: 1 }
]);

const uploadWithJsonErrors: RequestHandler = (req, res, next) => {
  uploadCore(req, res, (err) => {
    if (err) {
      if (err.code === 'UNSUPPORTED_FILE_TYPE') {
        return res.status(415).json({
          error: 'unsupported_media_type',
          message: 'Only document files are allowed.',
          detail: err.message,
          allowed: [...ALLOWED_MIME],
          received: err.field ? { field: err.field, mimetype: err.mimetype } : undefined
        });
      }
      return res.status(400).json({
        error: 'upload_error',
        message: err.message
      });
    }
    next();
  });
};

router.post('/upload', uploadWithJsonErrors, uploadHandler);
router.post('/evaluate', evaluateHandler);
router.get('/result/:id', resultHandler);

export default router;