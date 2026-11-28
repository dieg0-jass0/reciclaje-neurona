import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { engine } from 'express-handlebars';
import { conectarDB } from './config/db.js';
import apiRoutes from './routes/api.routes.js';
import viewRoutes from './routes/view.routes.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { cargarSesion } from './middleware/auth.js';
import Usuario from './models/usuario.model.js';
import Deteccion from './models/deteccion.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cargarSesion);
app.use('/', authRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);
app.use('/', viewRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
    return res.status(500).json({ error: 'Error interno', detalle: err.message });
  }
  res.status(500).send('Error interno del servidor');
});

const PORT = process.env.PORT || 3000;

conectarDB()
  .then(async () => {
    const n = await Usuario.completarTotales(() => Deteccion.conteoPorUsuario());
    if (n) console.log(`Totales de botellas y puntos calculados para ${n} usuario(s)`);
  })
  .then(() => app.listen(PORT, () => console.log(`Web en http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err.message);
    process.exit(1);
  });