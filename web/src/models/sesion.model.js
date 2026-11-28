import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { INACTIVIDAD_MS, MARGEN_SERVIDOR_MS } from '../config/sesion.js';

const esquema = new mongoose.Schema(
  {
    // Solo se guarda el hash del token; el token real vive en la cookie
    tokenHash: { type: String, required: true, unique: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    nombre: { type: String, required: true },
    numeroControl: { type: String },
    rol: { type: String },
    // Indice TTL: MongoDB borra las sesiones vencidas por su cuenta
    expira: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false }
);

const Modelo = mongoose.model('Sesion', esquema);

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const nuevaExpiracion = () => new Date(Date.now() + INACTIVIDAD_MS + MARGEN_SERVIDOR_MS);

export default {
  // Crea una sesion y devuelve el token que va en la cookie
  async crear(usuario) {
    const token = crypto.randomBytes(32).toString('hex');
    await Modelo.create({
      tokenHash: hashToken(token),
      usuarioId: usuario.id,
      nombre: usuario.nombre,
      numeroControl: usuario.numeroControl,
      rol: usuario.rol, 
      expira: nuevaExpiracion(),
    });
    return token;
  },

  // { estado: 'activa', sesion } | { estado: 'expirada' } | { estado: 'ninguna' }
  async buscar(token) {
    if (!token) return { estado: 'ninguna' };
    const doc = await Modelo.findOne({ tokenHash: hashToken(token) }).lean();
    // El TTL de MongoDB puede tardar hasta 60 s en borrar, por eso se revisa aqui tambien
    if (!doc || doc.expira <= new Date()) {
      if (doc) await Modelo.deleteOne({ _id: doc._id });
      return { estado: 'expirada' };
    }
    return { estado: 'activa', sesion: {
      id: String(doc._id),
      usuarioId: String(doc.usuarioId),
      nombre: doc.nombre,
      numeroControl: doc.numeroControl || '',
      rol: doc.rol || 'usuario',
    } };
  },

  // Extiende la sesion: el usuario mostro actividad
  async renovar(id) {
    await Modelo.updateOne({ _id: id }, { expira: nuevaExpiracion() });
  },

  // Cierra todas las sesiones de un usuario (al eliminarlo)
  async eliminarDeUsuario(usuarioId) {
    await Modelo.deleteMany({ usuarioId });
  },

  async eliminar(token) {
    if (token) await Modelo.deleteOne({ tokenHash: hashToken(token) });
  },
};