import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { allowRoles } from '../middleware/role.middleware.js';
import { asyncHandler } from '../utils/http.js';
import * as controller from '../controllers/officer.controller.js';
const router = Router(); router.use(authenticate, allowRoles('MAKER'));
router.get('/review-queue', asyncHandler(controller.queue)); router.get('/applications/:applicationId', asyncHandler(controller.detail)); router.post('/applications/:applicationId/recommend', asyncHandler(controller.recommend));
export default router;
