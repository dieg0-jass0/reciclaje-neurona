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
router.use(requiereSesionApi);

router.post('/clasificar', upload.single('imagen'), ctrl.clasificar);
router.get('/historial', ctrl.historial);
router.get('/resumen', ctrl.resumen);
router.get('/estado', ctrl.estado);

export default router;
