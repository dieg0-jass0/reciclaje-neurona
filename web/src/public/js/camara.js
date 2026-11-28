const $ = (id) => document.getElementById(id);

const video = $('video');
const selCam = $('camaras');
const btnPausa = $('pausa');
const visor = document.querySelector('.visor');
const veredicto = $('veredicto');
const nivel = $('nivel');
const canvas = document.createElement('canvas');

const INTERVALO_MS = 1000;
// Coordenadas de la silueta en el SVG (viewBox 0 0 120 300)
const FONDO_BOTELLA = 294;
const ALTO_BOTELLA = 294 - 22;

let ocupado = false;
let pausado = false;
let ultimoId = null;
let retenerHasta = 0;        // mantiene visible el aviso de "botella contada"
const RETENER_MS = 2500;

const FORMA_BOTELLA = 'M20 6h10v8c0 3 7 5 7 11v40c0 3-2 5-5 5H18c-3 0-5-2-5-5V25c0-6 7-8 7-11z';

// ---------- Veredicto y botella guía ----------
function mostrar(tipo, titular, porcentaje, destino) {
  veredicto.dataset.tipo = tipo;
  visor.dataset.tipo = tipo;
  $('titular').textContent = titular;
  $('porcentaje').textContent = porcentaje == null ? '—' : `${porcentaje}%`;
  $('destino').textContent = destino;

  const lleno = porcentaje == null ? 0 : porcentaje / 100;
  nivel.setAttribute('y', FONDO_BOTELLA - lleno * ALTO_BOTELLA);
}

// La respuesta trae { esBotella, confianza, accion } (ver conteo.service.js)
function mostrarResultado(d) {
  const pct = Math.round(d.confianza * 100);

  if (d.accion === 'contar') {
    const puntos = d.entrega?.puntos ?? 0;
    mostrar('contada', 'Botella contada', pct, `+${puntos} puntos. Deposítala en el contenedor de plásticos.`);
    celebrar(puntos);
    retenerHasta = Date.now() + RETENER_MS;
    return;
  }
  if (Date.now() < retenerHasta) return;

  switch (d.accion) {
    case 'confirmando':
      return mostrar('botella', 'Botella de plástico', pct, 'Mantenla quieta un momento para contarla.');
    case 'ya_contada':
      return mostrar('botella', 'Esta botella ya se contó', pct, 'Deposítala en el contenedor y muestra la siguiente.');
    case 'esperar':
      return mostrar('botella', 'Botella de plástico', pct, 'Espera un momento antes de mostrar la siguiente.');
    default:
      if (d.esBotella) {
        return mostrar('otro', 'No se ve con claridad', pct, 'Acerca la botella o gírala para que la cámara la vea mejor.');
      }
      return mostrar('otro', 'No es una botella', pct, 'Este objeto no suma puntos ni va al contenedor de plásticos.');
  }
}

function celebrar(puntos) {
  const suma = $('sumaPuntos');
  const marcador = $('puntos');
  suma.textContent = `+${puntos}`;
  for (const el of [suma, marcador]) {
    el.classList.remove(el === suma ? 'visible' : 'sube');
    void el.offsetWidth; // reinicia la animación
    el.classList.add(el === suma ? 'visible' : 'sube');
  }
}

// ---------- Cámara ----------
async function listarCamaras() {
  // Se pide permiso primero; sin permiso el navegador no muestra los nombres
  const temporal = await navigator.mediaDevices.getUserMedia({ video: true });
  temporal.getTracks().forEach((t) => t.stop());

  const dispositivos = (await navigator.mediaDevices.enumerateDevices())
    .filter((d) => d.kind === 'videoinput');

  selCam.replaceChildren(...dispositivos.map((d, i) => {
    const op = document.createElement('option');
    op.value = d.deviceId;
    op.textContent = d.label || `Cámara ${i + 1}`;
    return op;
  }));

  await iniciarCamara(selCam.value);
}

async function iniciarCamara(deviceId) {
  if (video.srcObject) video.srcObject.getTracks().forEach((t) => t.stop());
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: { exact: deviceId } },
  });
  mostrar('espera', 'Analizando…', null, 'Muestra una botella a la cámara.');
}

async function analizarFrame() {
  if (ocupado || pausado || !video.videoWidth) return;
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
    if (!resp.ok) throw new Error(datos.error || `El servidor respondió ${resp.status}`);

    if (!pausado) mostrarResultado(datos);
    if (datos.accion === 'contar') await actualizarPanel();
  } catch (err) {
    mostrar('error', 'Sin resultado', null, err.message);
  } finally {
    ocupado = false;
  }
}

// ---------- Cinta y puntaje ----------
function crearFicha(h, esNueva) {
  const li = document.createElement('li');
  li.className = 'ficha' + (esNueva ? ' nueva' : '');

  const hora = new Date(h.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  li.setAttribute('aria-label', `Botella, ${h.puntos} puntos, ${hora}`);
  li.title = li.getAttribute('aria-label');

  li.innerHTML = `<svg viewBox="0 0 50 72" aria-hidden="true"><path class="forma" d="${FORMA_BOTELLA}"/></svg>`;

  const fuerte = document.createElement('strong');
  fuerte.textContent = `+${h.puntos}`;
  const tiempo = document.createElement('span');
  tiempo.textContent = hora;
  li.append(fuerte, tiempo);
  return li;
}

async function actualizarPanel() {
  const [res, hist] = await Promise.all([
    fetch('/api/resumen').then((r) => r.json()),
    fetch('/api/historial?limite=14').then((r) => r.json()),
  ]);

  $('puntos').textContent = res.puntos;
  $('botellas').textContent = res.botellas;
  $('puntosPorBotella').textContent = res.puntosPorBotella;

  const nuevoId = hist[0]?.id ?? null;
  $('historial').replaceChildren(...hist.map((h, i) => crearFicha(h, i === 0 && ultimoId !== null && nuevoId !== ultimoId)));
  ultimoId = nuevoId;
  $('cintaVacia').hidden = hist.length > 0;
}

// ---------- Servicios ----------
async function actualizarEstado() {
  try {
    const e = await fetch('/api/estado').then((r) => r.json());
    $('luzIA').dataset.estado = e.ia;
    $('luzDB').dataset.estado = e.db;
    $('luzIA').title = e.ia === 'ok' ? 'IA funcionando' : 'La IA no responde';
    $('luzDB').title = e.db === 'ok' ? 'Base de datos conectada' : 'Base de datos sin conexión';
  } catch {
    $('luzIA').dataset.estado = 'caido';
    $('luzDB').dataset.estado = 'caido';
  }
}

// ---------- Constancia por correo ----------
async function pedirConstancia() {
  const boton = $('enviarConstancia');
  const estado = $('estadoConstancia');
  boton.disabled = true;
  boton.textContent = 'Enviando…';
  estado.hidden = true;
  try {
    const resp = await fetch('/api/constancia', { method: 'POST' });
    const datos = await resp.json();
    if (!resp.ok) throw new Error(datos.error || `El servidor respondió ${resp.status}`);
    estado.dataset.tipo = 'ok';
    estado.textContent = `Constancia enviada a ${datos.correo}.`;
  } catch (err) {
    estado.dataset.tipo = 'error';
    estado.textContent = err.message;
  } finally {
    estado.hidden = false;
    boton.disabled = false;
    boton.textContent = 'Enviar mi constancia a mi correo';
  }
}

// ---------- Eventos ----------
$('enviarConstancia').addEventListener('click', pedirConstancia);
selCam.addEventListener('change', () => iniciarCamara(selCam.value));

btnPausa.addEventListener('click', () => {
  pausado = !pausado;
  btnPausa.setAttribute('aria-pressed', String(pausado));
  btnPausa.textContent = pausado ? 'Reanudar análisis' : 'Pausar análisis';
  if (pausado) mostrar('pausa', 'En pausa', null, 'Pulsa «Reanudar análisis» para seguir contando botellas.');
  else mostrar('espera', 'Analizando…', null, 'Muestra una botella a la cámara.');
});

actualizarEstado();
setInterval(actualizarEstado, 5000);
actualizarPanel().catch(() => {});

listarCamaras()
  .then(() => setInterval(analizarFrame, INTERVALO_MS))
  .catch((err) => {
    mostrar('error', 'Sin cámara', null, `No se pudo acceder a la cámara: ${err.message}. Revisa el permiso del navegador.`);
  });
