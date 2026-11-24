const IA_URL = () => process.env.IA_URL || 'http://127.0.0.1:5000';

export async function clasificarImagen(buffer, mimetype) {
  const form = new FormData();
  form.append('imagen', new Blob([buffer], { type: mimetype }), 'frame.jpg');

  const res = await fetch(`${IA_URL()}/predict`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`IA respondio ${res.status}`);
  return res.json();
}

export async function iaDisponible() {
  try {
    const res = await fetch(`${IA_URL()}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}
