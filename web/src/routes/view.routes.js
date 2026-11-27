import { Router } from 'express';
import * as ctrl from '../controllers/vista.controller.js';
import { requiereSesion } from '../middleware/auth.js';

const router = Router();
router.get('/', requiereSesion, ctrl.dashboard);

export default router;
