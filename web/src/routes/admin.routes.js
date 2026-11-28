import { Router } from 'express';
import * as ctrl from '../controllers/admin.controller.js';
import { reporteDeUsuario } from '../controllers/reporte.controller.js';
import { requiereSesionVista, requiereAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requiereSesionVista, requiereAdmin);
router.get('/', ctrl.panel);
router.get('/usuarios.pdf', ctrl.pdfUsuarios);
router.get('/usuarios/:id/reporte.pdf', reporteDeUsuario);
router.post('/usuarios/:id/eliminar', ctrl.eliminarUsuario);

export default router;