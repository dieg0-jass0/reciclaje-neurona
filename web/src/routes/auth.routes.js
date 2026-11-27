import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { soloInvitados } from '../middleware/auth.js';

const router = Router();

router.get('/login', soloInvitados, ctrl.verLogin);
router.post('/login', soloInvitados, ctrl.iniciarSesion);
router.get('/registro', soloInvitados, ctrl.verRegistro);
router.post('/registro', soloInvitados, ctrl.registrar);
router.post('/logout', ctrl.cerrarSesion);

export default router;
