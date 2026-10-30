import mongoose from 'mongoose';
import multer from 'multer';
import { fail } from '../utils/http.js';
export function notFound(_req, res) { res.status(404).json(fail(404, 'NOT_FOUND', 'Endpoint not found')); }
export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  let status = error.status || 500, code = error.code || 'INTERNAL_SERVER_ERROR', message = error.message || 'An unexpected error occurred', details = error.details || [];
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') { status = 413; code = 'FILE_TOO_LARGE'; message = 'File exceeds the 1 MB limit'; }
  if (error instanceof mongoose.Error.ValidationError) { status = 400; code = 'VALIDATION_ERROR'; message = 'Validation failed'; details = Object.values(error.errors).map((e) => ({ field: e.path, issue: e.message })); }
  if (error instanceof mongoose.Error.VersionError) { status = 409; code = 'CONCURRENT_MODIFICATION'; message = 'This record changed during the request. Reload and try again.'; }
  if (error instanceof mongoose.Error.CastError) { status = 404; code = 'DOCUMENT_NOT_FOUND'; message = 'The requested resource was not found'; }
  if (error.code === 11000) { status = 409; code = error.keyPattern?.email ? 'EMAIL_ALREADY_EXISTS' : 'DUPLICATE_APPLICATION'; message = 'A record with this value already exists'; }
  if (status >= 500) console.error(error);
  res.status(status).json(fail(status, code, status >= 500 ? 'An unexpected error occurred' : message, details));
}
