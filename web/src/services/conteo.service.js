// Decide cuándo una serie de frames de la cámara es UNA botella nueva.
//
// La cámara manda un frame por segundo, así que la misma botella aparece en
// muchos frames seguidos. Para no dar puntos repetidos, cada persona tiene un
// pequeño "semáforo" en memoria:
//
//   libre ──(N frames seguidos con botella)──> se cuenta la botella ──> ocupada
//   ocupada ──(M frames seguidos SIN botella: la retiró o la depositó)──> libre
//
// Mientras está "ocupada", los frames con botella se ignoran. Además hay una
// espera mínima entre dos botellas de la misma persona.
//
// Límite conocido: el modelo solo dice "botella / no botella", no reconoce
// botellas individuales. Si alguien retira la botella y la vuelve a mostrar,
// cuenta como otra. Por eso conviene que la persona la deposite en el
// contenedor justo después de que la cámara la cuente.

const num = (valor, porDefecto) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
};

export const REGLAS = {
  confianzaMin: num(process.env.CONTEO_CONFIANZA_MIN, 0.8),
  framesConfirmar: num(process.env.CONTEO_FRAMES_CONFIRMAR, 2),
  framesLiberar: num(process.env.CONTEO_FRAMES_LIBERAR, 3),
  esperaMinMs: num(process.env.CONTEO_ESPERA_SEG, 3) * 1000,
  puntosPorBotella: num(process.env.PUNTOS_POR_BOTELLA, 10),
};

// Estado por usuario: si la persona abre dos pestañas, comparten el mismo
// estado, así que tampoco puede duplicar puntos de esa forma.
const estados = new Map();
const OLVIDAR_TRAS_MS = 10 * 60 * 1000;

function estadoDe(usuarioId) {
  let e = estados.get(usuarioId);
  if (!e) {
    e = { ocupada: false, rachaSi: 0, rachaNo: 0, ultimaBotella: 0, visto: 0 };
    estados.set(usuarioId, e);
  }
  e.visto = Date.now();
  return e;
}

// Limpia estados de personas que ya no están usando la cámara
setInterval(() => {
  const limite = Date.now() - OLVIDAR_TRAS_MS;
  for (const [id, e] of estados) if (e.visto < limite) estados.delete(id);
}, 60 * 1000).unref();

/**
 * Registra el resultado de un frame y dice qué hacer con él.
 * @returns {{ accion: 'contar' | 'confirmando' | 'ya_contada' | 'esperar' | 'nada',
 *             faltan?: number, esperaMs?: number }}
 */
export function registrarFrame(usuarioId, { esBotella, confianza }) {
  const e = estadoDe(usuarioId);
  const hayBotella = esBotella && confianza >= REGLAS.confianzaMin;

  if (!hayBotella) {
    e.rachaSi = 0;
    e.rachaNo += 1;
    if (e.ocupada && e.rachaNo >= REGLAS.framesLiberar) e.ocupada = false;
    return { accion: 'nada' };
  }

  e.rachaNo = 0;
  if (e.ocupada) return { accion: 'ya_contada' };

  e.rachaSi += 1;
  if (e.rachaSi < REGLAS.framesConfirmar) {
    return { accion: 'confirmando', faltan: REGLAS.framesConfirmar - e.rachaSi };
  }

  const esperaMs = e.ultimaBotella + REGLAS.esperaMinMs - Date.now();
  if (esperaMs > 0) return { accion: 'esperar', esperaMs };

  e.ocupada = true;
  e.rachaSi = 0;
  e.ultimaBotella = Date.now();
  return { accion: 'contar' };
}

// Si no se pudo guardar la botella, se libera para que la persona no la pierda
export function deshacerConteo(usuarioId) {
  const e = estados.get(usuarioId);
  if (e) { e.ocupada = false; e.ultimaBotella = 0; }
}
