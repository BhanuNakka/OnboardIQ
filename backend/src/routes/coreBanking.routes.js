import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { allowRoles } from '../middleware/role.middleware.js';
import { asyncHandler } from '../utils/http.js';
import * as controller from '../controllers/coreBanking.controller.js';
const router = Router(); router.post('/accounts', authenticate, allowRoles('ADMIN'), asyncHandler(controller.create)); router.get('/accounts/:applicationId', authenticate, allowRoles('CUSTOMER', 'MAKER', 'CHECKER', 'COMPLIANCE', 'ADMIN'), asyncHandler(controller.get)); export default router;
