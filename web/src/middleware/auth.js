// Protege paginas: si no hay sesion, manda al login
export function requiereSesion(req, res, next) {
  if (req.session?.usuario) return next();
  res.redirect('/login');
}

// Protege la API: responde 401 en JSON
export function requiereSesionApi(req, res, next) {
  if (req.session?.usuario) return next();
  res.status(401).json({ error: 'Debes iniciar sesion' });
}

// Si ya inicio sesion, no tiene sentido ver login/registro
export function soloInvitados(req, res, next) {
  if (req.session?.usuario) return res.redirect('/');
  next();
}
