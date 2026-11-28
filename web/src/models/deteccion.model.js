import mongoose from 'mongoose';

// Cada documento es UNA botella reciclada por una persona (no un frame).
// Los registros antiguos (un documento por frame) no tienen puntos: se ignoran
// en el puntaje y en los conteos porque repetían la misma botella muchas veces.
const ENTREGA = { esBotella: true, puntos: { $gt: 0 } };
const esquema = new mongoose.Schema(
  {
    esBotella: { type: Boolean, required: true },
    confianza: { type: Number, required: true, min: 0, max: 1 },
    puntos: { type: Number, default: 0, min: 0 },
    fecha: { type: Date, default: Date.now, index: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', index: true },
  },
  { versionKey: false }
);

esquema.index({ usuarioId: 1, fecha: -1 });

const Modelo = mongoose.model('Deteccion', esquema);

const aPlano = (doc) => ({
  id: String(doc._id),
  esBotella: doc.esBotella,
  confianza: doc.confianza,
  puntos: doc.puntos || 0,
  fecha: doc.fecha,
});

const idValido = (id) => mongoose.isValidObjectId(id);

export default {
  async guardar({ esBotella, confianza, puntos = 0, usuarioId }) {
    const doc = await Modelo.create({ esBotella, confianza, puntos, usuarioId });
    return aPlano(doc);
  },

  // Botellas recicladas, más recientes primero. Con usuarioId: solo las de esa persona.
  async listar(limite = 20, usuarioId) {
    const filtro = { ...ENTREGA };
    if (usuarioId && idValido(usuarioId)) filtro.usuarioId = usuarioId;
    const docs = await Modelo.find(filtro).sort({ fecha: -1 }).limit(limite).lean();
    return docs.map(aPlano);
  },

  // Totales generales (panel de administrador)
  async resumen() {
    const [fila] = await Modelo.aggregate([
      { $match: ENTREGA },
      { $group: { _id: null, botellas: { $sum: 1 }, puntos: { $sum: { $ifNull: ['$puntos', 0] } } } },
    ]);
    return { botellas: fila?.botellas || 0, puntos: fila?.puntos || 0 };
  },

  // Puntaje de una persona
  async resumenUsuario(usuarioId) {
    if (!idValido(usuarioId)) return { botellas: 0, puntos: 0 };
    const [fila] = await Modelo.aggregate([
      { $match: { ...ENTREGA, usuarioId: new mongoose.Types.ObjectId(usuarioId) } },
      { $group: { _id: null, botellas: { $sum: 1 }, puntos: { $sum: { $ifNull: ['$puntos', 0] } } } },
    ]);
    return { botellas: fila?.botellas || 0, puntos: fila?.puntos || 0 };
  },

  // { usuarioId: { botellas, puntos } }
  async conteoPorUsuario() {
    const filas = await Modelo.aggregate([
      { $match: { ...ENTREGA, usuarioId: { $ne: null } } },
      { $group: { _id: '$usuarioId', botellas: { $sum: 1 }, puntos: { $sum: { $ifNull: ['$puntos', 0] } } } },
    ]);
    return Object.fromEntries(filas.map((f) => [String(f._id), { botellas: f.botellas, puntos: f.puntos }]));
  },
};
