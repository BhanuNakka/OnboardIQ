import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { allowRoles } from '../middleware/role.middleware.js';
import { asyncHandler } from '../utils/http.js';
import * as controller from '../controllers/compliance.controller.js';
const router = Router(); router.use(authenticate, allowRoles('COMPLIANCE', 'ADMIN'));
router.get('/dashboard', asyncHandler(controller.dashboard)); router.get('/audit/:applicationId', asyncHandler(controller.audit)); router.get('/decisions/export', asyncHandler(controller.exportDecisions)); export default router;
