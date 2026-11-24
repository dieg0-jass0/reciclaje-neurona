import mongoose from 'mongoose';

export async function conectarDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('Falta MONGODB_URI en el archivo .env');

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('MongoDB conectado');
}

export const dbActiva = () => mongoose.connection.readyState === 1;
