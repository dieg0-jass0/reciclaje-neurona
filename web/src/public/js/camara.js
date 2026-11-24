const video = document.getElementById('video');
const selCam = document.getElementById('camaras');
const resultado = document.getElementById('resultado');
const canvas = document.createElement('canvas');
const INTERVALO_MS = 1000;
let ocupado = false;

async function listarCamaras() {
  // Se pide permiso primero; sin permiso el navegador no muestra los nombres
  const temporal = await navigator.mediaDevices.getUserMedia({ video: true });
  temporal.getTracks().forEach((t) => t.stop());

  const dispositivos = (await navigator.mediaDevices.enumerateDevices())
    .filter((d) => d.kind === 'videoinput');

  selCam.innerHTML = dispositivos
    .map((d, i) => `<option value="${d.deviceId}">${d.label || 'Cámara ' + (i + 1)}</option>`)
    .join('');

  await iniciarCamara(selCam.value);
}

async function iniciarCamara(deviceId) {
  if (video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
  });
}

async function analizarFrame() {
  if (ocupado || !video.videoWidth) return;
  ocupado = true;
  try {
    const ancho = Math.min(video.videoWidth, 480);
    canvas.width = ancho;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * ancho);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    const form = new FormData();
    form.append('imagen', blob, 'frame.jpg');

    const resp = await fetch('/api/clasificar', { method: 'POST', body: form });
    const datos = await resp.json();
    if (!resp.ok) throw new Error(datos.error || 'Error');

    const pct = Math.round(datos.confianza * 100);
    resultado.textContent = datos.esBotella ? `BOTELLA (${pct}%)` : `NO BOTELLA (${pct}%)`;
    resultado.className = 'resultado ' + (datos.esBotella ? 'si' : 'no');
    await actualizarPanel();
  } catch (err) {
    resultado.textContent = err.message;
    resultado.className = 'resultado';
  } finally {
    ocupado = false;
  }
}

async function actualizarPanel() {
  const [res, hist] = await Promise.all([
    fetch('/api/resumen').then((r) => r.json()),
    fetch('/api/historial?limite=8').then((r) => r.json()),
  ]);
  document.getElementById('total').textContent = res.total;
  document.getElementById('botellas').textContent = res.botellas;
  document.getElementById('noBotellas').textContent = res.noBotellas;
  document.getElementById('historial').innerHTML = hist
    .map((h) => `<li>#${String(h.id).slice(-4)} · ${h.esBotella ? 'Botella' : 'No botella'} · ${Math.round(h.confianza * 100)}% · ${new Date(h.fecha).toLocaleTimeString()}</li>`)
    .join('');
}

async function actualizarEstadoIA() {
  const el = document.getElementById('estadoIA');
  try {
    const e = await fetch('/api/estado').then((r) => r.json());
    el.textContent = 'IA: ' + e.ia;
  } catch {
    el.textContent = 'IA: sin conexión';
  }
}

selCam.addEventListener('change', () => iniciarCamara(selCam.value));

listarCamaras().then(() => {
  setInterval(analizarFrame, INTERVALO_MS);
  setInterval(actualizarEstadoIA, 5000);
  actualizarEstadoIA();
}).catch((err) => {
  resultado.textContent = 'No se pudo acceder a la cámara: ' + err.message;
});
