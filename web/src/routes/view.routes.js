import { Router } from 'express';
import * as ctrl from '../controllers/vista.controller.js';
import { miReporte } from '../controllers/reporte.controller.js';
import { requiereSesionVista } from '../middleware/auth.js';

const router = Router();
router.get('/', requiereSesionVista, ctrl.dashboard);
router.get('/reporte.pdf', requiereSesionVista, miReporte);

export default router;