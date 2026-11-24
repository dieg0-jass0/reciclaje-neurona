import { Router } from 'express';
import * as ctrl from '../controllers/vista.controller.js';

const router = Router();
router.get('/', ctrl.dashboard);

export default router;
