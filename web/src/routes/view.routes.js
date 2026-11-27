import { Router } from 'express';
import * as ctrl from '../controllers/vista.controller.js';
import { requiereSesionVista } from '../middleware/auth.js';

const router = Router();
router.get('/', requiereSesionVista, ctrl.dashboard);

export default router;