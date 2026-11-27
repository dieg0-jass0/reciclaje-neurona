import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/clasificacion.controller.js';
import { requiereSesionApi } from '../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    cb(null, file.mimetype.startsWith('image/')),
});

const router = Router();

// Publica: estado de los servicios
router.get('/estado', ctrl.estado);

// Todo lo demas requiere sesion iniciada.
// Estas llamadas (que la camara hace cada segundo) NO renuevan la sesion:
// solo cuenta la actividad real del usuario.
router.use(requiereSesionApi);
router.post('/clasificar', upload.single('imagen'), ctrl.clasificar);
router.get('/historial', ctrl.historial);
router.get('/resumen', ctrl.resumen);

export default router;