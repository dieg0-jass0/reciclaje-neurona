import mongoose from 'mongoose';
import { cifrarPassword, verificarPassword } from '../utils/password.js';
import { ROLES } from '../config/admin.js';

export const CARRERAS = [
  'Ingeniería en Sistemas Computacionales',
  'Ingeniería en Mecatrónica',
  'Contador Público',
  'Ciencia de Datos',
];

const esquema = new mongoose.Schema(
  {
    numeroControl: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nombreCompleto: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // 'usuario' (alumno) o 'admin' (jefe de carrera)
    rol: { type: String, enum: Object.values(ROLES), default: ROLES.USUARIO, index: true },
    // La carrera solo se pide a los usuarios, no a los administradores
    carrera: {
      type: String,
      enum: CARRERAS,
      required: function () { return this.rol !== ROLES.ADMIN; },
    },
    passwordHash: { type: String, required: true },
    // Totales de reciclaje. Se suman cada vez que la cámara cuenta una botella.
    // botellas: nunca baja. puntos: saldo actual; el futuro sistema de canje
    // de premios restará de aquí (el detalle de cada botella vive en Deteccion).
    botellas: { type: Number, default: 0, min: 0 },
    puntos: { type: Number, default: 0, min: 0 },
    creado: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

const Modelo = mongoose.model('Usuario', esquema);

// Ajusta los indices de la coleccion a este esquema
// (quita indices viejos que podrian causar errores de "duplicado")
Modelo.syncIndexes().catch((err) => console.error('No se pudieron sincronizar indices de usuarios:', err.message));

export class UsuarioExisteError extends Error {}

const aPlano = (doc) => ({
  id: String(doc._id),
  numeroControl: doc.numeroControl,
  nombre: doc.nombreCompleto,
  correo: doc.correo,
  rol: doc.rol || ROLES.USUARIO,
  carrera: doc.carrera || '',
  botellas: doc.botellas || 0,
  puntos: doc.puntos || 0,
  creado: doc.creado,
});

const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Los registros viejos no tienen rol: cuentan como 'usuario'
const filtroRol = (rol) => (rol === ROLES.ADMIN ? ROLES.ADMIN : { $ne: ROLES.ADMIN });

export default {
  async crear({ numeroControl, nombreCompleto, correo, rol = ROLES.USUARIO, carrera, password }) {
    try {
      const doc = await Modelo.create({
        numeroControl,
        nombreCompleto,
        correo,
        rol,
        carrera: rol === ROLES.ADMIN ? undefined : carrera,
        passwordHash: await cifrarPassword(password),
      });
      return aPlano(doc);
    } catch (err) {
      if (err.code === 11000) {
        const campo = Object.keys(err.keyValue || err.keyPattern || {})[0];
        if (campo === 'correo') throw new UsuarioExisteError('Ese correo ya está registrado');
        throw new UsuarioExisteError('Ese número de control ya está registrado');
      }
      throw err;
    }
  },

  // Devuelve el usuario si las credenciales son correctas, o null
  async autenticar(numeroControl, password) {
    const doc = await Modelo.findOne({ numeroControl: String(numeroControl).toUpperCase().trim() }).lean();
    if (!doc || !(await verificarPassword(password, doc.passwordHash))) return null;
    return aPlano(doc);
  },

  // Lista para el administrador, con filtros opcionales
  async listar({ rol, carrera, buscar } = {}) {
    const filtro = {};
    if (rol) filtro.rol = filtroRol(rol);
    if (carrera) filtro.carrera = carrera;
    if (buscar) {
      const re = new RegExp(escaparRegex(buscar), 'i');
      filtro.$or = [{ numeroControl: re }, { nombreCompleto: re }, { correo: re }];
    }
    const docs = await Modelo.find(filtro).sort({ creado: -1 }).lean();
    return docs.map(aPlano);
  },

  async contarPorRol() {
    const [admins, total] = await Promise.all([
      Modelo.countDocuments({ rol: ROLES.ADMIN }),
      Modelo.countDocuments({}),
    ]);
    return { admins, usuarios: total - admins };
  },

  // Solo cuenta usuarios (los admins no tienen carrera)
  async contarPorCarrera() {
    const filas = await Modelo.aggregate([
      { $match: { rol: { $ne: ROLES.ADMIN } } },
      { $group: { _id: '$carrera', total: { $sum: 1 } } },
    ]);
    const mapa = Object.fromEntries(filas.map((f) => [f._id, f.total]));
    return CARRERAS.map((nombre) => ({ nombre, total: mapa[nombre] || 0 }));
  },

  // Suma una botella y sus puntos de forma atómica; devuelve los totales nuevos
  async sumarBotella(id, puntos) {
    const doc = await Modelo.findByIdAndUpdate(
      id,
      { $inc: { botellas: 1, puntos } },
      { new: true, projection: { botellas: 1, puntos: 1 } }
    ).lean();
    if (!doc) throw new Error('El usuario ya no existe');
    return { botellas: doc.botellas, puntos: doc.puntos };
  },

  // Deshace sumarBotella si no se pudo guardar el detalle de la botella
  async restarBotella(id, puntos) {
    await Modelo.updateOne({ _id: id }, { $inc: { botellas: -1, puntos: -puntos } });
  },

  async totales(id) {
    if (!mongoose.isValidObjectId(id)) return { botellas: 0, puntos: 0 };
    const doc = await Modelo.findById(id, { botellas: 1, puntos: 1 }).lean();
    return { botellas: doc?.botellas || 0, puntos: doc?.puntos || 0 };
  },

  // Migración única: a los usuarios creados antes de estos campos les calcula
  // sus totales a partir de las botellas ya guardadas en Deteccion.
  async completarTotales(conteoPorUsuario) {
    const pendientes = await Modelo.find({ botellas: { $exists: false } }, { _id: 1 }).lean();
    if (!pendientes.length) return 0;
    const conteo = await conteoPorUsuario();
    await Modelo.bulkWrite(pendientes.map(({ _id }) => ({
      updateOne: {
        filter: { _id },
        update: { $set: { botellas: conteo[String(_id)]?.botellas || 0, puntos: conteo[String(_id)]?.puntos || 0 } },
      },
    })));
    return pendientes.length;
  },

  async buscarPorId(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Modelo.findById(id).lean();
    return doc ? aPlano(doc) : null;
  },

  async eliminar(id) {
    if (!mongoose.isValidObjectId(id)) return;
    await Modelo.deleteOne({ _id: id });
  },
};