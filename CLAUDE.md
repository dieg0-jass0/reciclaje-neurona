# Reciclaje Neurona — Clasificador de botellas

App web que usa la cámara del navegador para detectar si un objeto es una botella de plástico, con un modelo de IA, y guarda cada detección en MongoDB.

## Arquitectura

```
Navegador (camara.js)  --POST /api/clasificar (frame JPEG, 1/seg)-->  Express :3000 (web/)
Express  --POST /predict (multipart "imagen")-->  Flask :5000 (ia-service/)
Express  --Mongoose-->  MongoDB (modelo Mongoose "Deteccion")
```

| Carpeta | Qué hay |
|---|---|
| `web/` | Node 18+, ES modules, Express 4, express-handlebars, Mongoose 8, multer |
| `web/src/routes/` | `api.routes.js` (REST) y `view.routes.js` (dashboard) |
| `web/src/controllers/` | Lógica HTTP: validar, llamar al servicio, responder |
| `web/src/services/ia.service.js` | Único punto que habla con Flask (`IA_URL`) |
| `web/src/models/deteccion.model.js` | Esquema + funciones `guardar`, `listar`, `resumen`; devuelve objetos planos con `id` |
| `web/src/views/` | Plantillas Handlebars (`layouts/main.hbs`, `dashboard.hbs`) |
| `web/src/public/` | `css/estilos.css` y `js/camara.js` (JS sin framework, sin build) |
| `ia-service/app.py` | Flask: `GET /health`, `POST /predict` |
| `ia-service/modelo/botellas.keras` | Modelo MobileNetV2 (ver skill `modelo-botellas`) |

## Comandos

```bash
# IA (Python 3.12/3.13)
cd ia-service && python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt && python app.py

# Web
cd web && cp .env.example .env && npm install && npm run dev
```

Variables (`web/.env`): `PORT` (3000), `IA_URL` (http://127.0.0.1:5000), `MONGODB_URI`.

Comprobar que todo vive: `curl localhost:3000/api/estado` → `{"web":"ok","ia":"ok","db":"ok"}`.

## Convenciones

- Código, nombres y mensajes en **español** sin tildes en identificadores (`clasificarImagen`, `esBotella`, `noBotellas`).
- Respetar las capas: ruta → controlador → servicio/modelo. Los controladores no usan `fetch` ni Mongoose directamente.
- Errores de la API como `{ error, detalle? }` con código HTTP: 400 entrada inválida, 502 IA caída, 500 fallo de BD.
- El contrato JSON de la API está documentado en la skill `api-reciclaje`; no cambiar nombres de campos sin actualizar `camara.js`.
- No subir `.env` ni `node_modules`. El modelo `.keras` pesa ~11 MB.

## Estado actual / pendientes conocidos

- Sin tests, linter ni Docker todavía.
- Flask corre con el servidor de desarrollo (una petición a la vez).
- Si MongoDB no conecta al arrancar, `app.js` cierra el proceso.

## Skills del proyecto (`.claude/skills/`)

- `modelo-botellas` — entrada/salida del modelo, umbral, reentrenar o reemplazar.
- `api-reciclaje` — contrato REST y flujo de datos completo.
- `arranque-local` — levantar y verificar los tres servicios, diagnosticar fallos.
- `frontend-design` — dirección visual para rediseñar el dashboard.
