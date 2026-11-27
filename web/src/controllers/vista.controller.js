export function dashboard(req, res) {
  res.render('dashboard', { titulo: 'Clasificador de botellas', usuario: req.session.usuario });
}
