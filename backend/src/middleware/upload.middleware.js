import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../utils/http.js';
const destination = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(destination, { recursive: true });
const storage = multer.diskStorage({ destination, filename: (_req, file, cb) => cb(null, `${randomUUID()}.txt`) });
export const uploadDocument = multer({ storage, limits: { fileSize: Number(process.env.MAX_DOCUMENT_BYTES || 1048576), files: 1 }, fileFilter: (_req, file, cb) => {
  if (path.extname(file.originalname).toLowerCase() !== '.txt' || !['text/plain', 'application/octet-stream'].includes(file.mimetype)) return cb(new HttpError(400, 'INVALID_FILE_TYPE', 'Only .txt documents are accepted'));
  cb(null, true);
} }).single('file');
