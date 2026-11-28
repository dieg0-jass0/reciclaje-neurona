import mongoose from 'mongoose';

const esquema = new mongoose.Schema(
  {
    esBotella: { type: Boolean, required: true },
    confianza: { type: Number, required: true, min: 0, max: 1 },
    fecha: { type: Date, default: Date.now, index: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', index: true },
  },
  { versionKey: false }
);

const Modelo = mongoose.model('Deteccion', esquema);

const aPlano = (doc) => ({
  id: String(doc._id),
  esBotella: doc.esBotella,
  confianza: doc.confianza,
  fecha: doc.fecha,
});

export default {
  async guardar({ esBotella, confianza, usuarioId }) {
    const doc = await Modelo.create({ esBotella, confianza, usuarioId });
    return aPlano(doc);
  },

  async listar(limite = 20) {
    const docs = await Modelo.find().sort({ fecha: -1 }).limit(limite).lean();
    return docs.map(aPlano);
  },

  async resumen() {
    const [total, botellas] = await Promise.all([
      Modelo.countDocuments(),
      Modelo.countDocuments({ esBotella: true }),
    ]);
    return { total, botellas, noBotellas: total - botellas };
  },

  // { usuarioId: { total, botellas } }
  async conteoPorUsuario() {
    const filas = await Modelo.aggregate([
      { $match: { usuarioId: { $ne: null } } },
      { $group: { _id: '$usuarioId', total: { $sum: 1 }, botellas: { $sum: { $cond: ['$esBotella', 1, 0] } } } },
    ]);
    return Object.fromEntries(filas.map((f) => [String(f._id), { total: f.total, botellas: f.botellas }]));
  },
};