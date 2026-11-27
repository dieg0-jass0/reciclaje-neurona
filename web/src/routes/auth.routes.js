import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { soloInvitados, requiereSesionApi } from '../middleware/auth.js';

const router = Router();

router.get('/login', soloInvitados, ctrl.vistaLogin);
router.post('/login', soloInvitados, ctrl.login);
router.get('/registro', soloInvitados, ctrl.vistaRegistro);
router.post('/registro', soloInvitados, ctrl.registro);
router.post('/logout', ctrl.logout);
router.post('/auth/ping', requiereSesionApi, ctrl.ping);

export default router;
