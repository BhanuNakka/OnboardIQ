import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/http.js';
import * as controller from '../controllers/auth.controller.js';
const router = Router();
router.post('/register', asyncHandler(controller.register)); router.post('/login', asyncHandler(controller.login)); router.get('/me', authenticate, asyncHandler(controller.me));
export default router;
