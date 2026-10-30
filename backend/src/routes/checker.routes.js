import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { allowRoles } from '../middleware/role.middleware.js';
import { asyncHandler } from '../utils/http.js';
import * as controller from '../controllers/checker.controller.js';
const router = Router(); router.use(authenticate, allowRoles('CHECKER', 'COMPLIANCE'));
router.get('/pending', asyncHandler(controller.pending)); router.post('/applications/:applicationId/decision', asyncHandler(controller.decide)); export default router;
