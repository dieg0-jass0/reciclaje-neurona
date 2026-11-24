import mongoose from 'mongoose';

const esquema = new mongoose.Schema(
  {
    esBotella: { type: Boolean, required: true },
    confianza: { type: Number, required: true, min: 0, max: 1 },
    fecha: { type: Date, default: Date.now, index: true },
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
  async guardar({ esBotella, confianza }) {
    const doc = await Modelo.create({ esBotella, confianza });
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
};
