import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { engine } from 'express-handlebars';
import { conectarDB } from './config/db.js';
import apiRoutes from './routes/api.routes.js';
import viewRoutes from './routes/view.routes.js';
import authRoutes from './routes/auth.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.engine('hbs', engine({ extname: '.hbs' }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cambia-este-secreto',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 }, // 8 horas
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', apiRoutes);
app.use('/', authRoutes);
app.use('/', viewRoutes);

const PORT = process.env.PORT || 3000;

conectarDB()
  .then(() => app.listen(PORT, () => console.log(`Web en http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('No se pudo conectar a MongoDB:', err.message);
    process.exit(1);
  });
