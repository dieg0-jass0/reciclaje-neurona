// Cierre de sesion por inactividad.
// Si el usuario no mueve el mouse, no teclea, no hace clic ni toca la pantalla
// durante INACTIVIDAD_MS, se cierra la sesion y se le manda al login.
// El analisis automatico de la camara NO cuenta como actividad.
(() => {
  const aviso = document.getElementById('avisoSesion');
  const INACTIVIDAD_MS = Number(aviso?.dataset.inactividadMs) || 60000;
  const AVISO_ANTES_MS = 10000; // mostrar cuenta regresiva los ultimos 10 s
  const PING_CADA_MS = 5000;    // avisar al servidor como maximo cada 5 s

  let ultimaActividad = Date.now();
  let ultimoPing = Date.now();
  let cerrando = false;

  const fetchOriginal = window.fetch.bind(window);

  function irALogin() {
    if (cerrando) return;
    cerrando = true;
    window.location.href = '/login?expirada=1';
  }

  // Si cualquier peticion responde 401, la sesion ya no existe en el servidor
  window.fetch = async (...args) => {
    const resp = await fetchOriginal(...args);
    if (resp.status === 401) irALogin();
    return resp;
  };

  function avisarServidor() {
    ultimoPing = Date.now();
    fetchOriginal('/auth/ping', { method: 'POST' })
      .then((r) => { if (r.status === 401) irALogin(); })
      .catch(() => {});
  }

  function registrarActividad() {
    if (cerrando) return;
    ultimaActividad = Date.now();
    if (aviso) aviso.hidden = true;
    if (Date.now() - ultimoPing >= PING_CADA_MS) avisarServidor();
  }

  async function cerrarPorInactividad() {
    cerrando = true;
    try {
      await fetchOriginal('/logout', { method: 'POST', keepalive: true });
    } catch {
      // Aunque falle, el servidor vencera la sesion por su cuenta
    }
    window.location.href = '/login?expirada=1';
  }

  ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart']
    .forEach((evento) => window.addEventListener(evento, registrarActividad, { passive: true }));

  setInterval(() => {
    if (cerrando) return;
    const restante = INACTIVIDAD_MS - (Date.now() - ultimaActividad);
    if (restante <= 0) {
      cerrarPorInactividad();
    } else if (restante <= AVISO_ANTES_MS && aviso) {
      aviso.hidden = false;
      aviso.textContent = `Sin actividad: la sesión se cerrará en ${Math.ceil(restante / 1000)} s. `
        + 'Mueve el mouse o presiona una tecla para continuar.';
    }
  }, 500);
})();
