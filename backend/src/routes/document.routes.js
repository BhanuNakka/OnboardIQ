import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { allowRoles } from '../middleware/role.middleware.js';
import { asyncHandler } from '../utils/http.js';
import { extract } from '../controllers/document.controller.js';
const router = Router(); router.post('/:documentId/extract', authenticate, allowRoles('ADMIN'), asyncHandler(extract)); export default router;
