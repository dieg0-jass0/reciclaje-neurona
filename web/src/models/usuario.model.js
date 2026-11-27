import mongoose from 'mongoose';

const esquema = new mongoose.Schema(
  {
    numeroControl: { type: String, required: true, unique: true, trim: true, uppercase: true },
    nombreCompleto: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, trim: true, lowercase: true },
    carrera: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    creado: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.model('Usuario', esquema);
