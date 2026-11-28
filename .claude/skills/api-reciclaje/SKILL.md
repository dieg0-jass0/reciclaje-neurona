---
name: api-reciclaje
description: Contrato REST de la web Express y flujo de datos cámara → Express → Flask → MongoDB del proyecto reciclaje-neurona. Usar al añadir o modificar endpoints, controladores, el modelo Mongoose, camara.js o el dashboard, para no romper los campos que consume cada capa.
---

# API y flujo de datos

## Flujo de una clasificación

1. `camara.js` toma un frame del `<video>` cada `INTERVALO_MS` (1000 ms), lo reduce a ≤480 px de ancho y lo manda como JPEG (calidad 0.85). Si la petición anterior sigue en curso (`ocupado`), salta el frame.
2. `POST /api/clasificar` → multer en memoria (máx. 3 MB, solo `image/*`) → `clasificacion.controller.clasificar`.
3. El controlador llama a `ia.service.clasificarImagen(buffer, mimetype)` → Flask `/predict`.
4. Guarda con `Deteccion.guardar({ esBotella, confianza })` y responde el registro.
5. `camara.js` muestra el resultado y refresca `/api/resumen` y `/api/historial?limite=8`.

## Endpoints

| Método y ruta | Respuesta OK | Errores |
|---|---|---|
| `POST /api/clasificar` (multipart `imagen`) | `{ id, esBotella, confianza, fecha }` | 400 sin imagen o no es imagen · 502 IA no respondió · 500 MongoDB |
| `GET /api/historial?limite=N` | `[{ id, esBotella, confianza, fecha }]` más recientes primero (por defecto 20) | 500 |
| `GET /api/resumen` | `{ total, botellas, noBotellas }` | 500 |
| `GET /api/estado` | `{ web: "ok", ia: "ok"\|"caido", db: "ok"\|"caido" }` | — |
| `GET /` | Dashboard HTML (Handlebars) | — |

Formato de error: `{ error: "mensaje para el usuario", detalle?: "err.message" }`.

## Quién consume cada campo

| Campo | Lo produce | Lo usan |
|---|---|---|
| `esBotella`, `confianza` | Flask `app.py` | `deteccion.model.js` (esquema), `camara.js` (texto y color `.si`/`.no`) |
| `id` | `aPlano()` en el modelo (`String(_id)`) | `camara.js` (últimos 4 caracteres en el historial) |
| `fecha` | Mongoose (`default: Date.now`, con índice) | historial, orden |
| `total/botellas/noBotellas` | `Deteccion.resumen()` | `#total`, `#botellas`, `#noBotellas` en `dashboard.hbs` |

Renombrar un campo exige cambiar todas las columnas de su fila.

## Cómo añadir un endpoint

1. Función en el modelo (`deteccion.model.js`) que devuelva objetos planos vía `aPlano` (nunca documentos Mongoose).
2. Controlador `async (req, res)` con `try/catch` y el formato de error anterior.
3. Ruta en `api.routes.js`.
4. Validar y acotar parámetros de query (p. ej. `limite`: entero entre 1 y 100) — hoy `historial` acepta cualquier número.
5. Documentarlo en `README.md` y en la tabla de arriba.

## Cuidados conocidos

- `camara.js` arma HTML con `innerHTML` usando `d.label` (nombre de la cámara) y datos de la API. Para texto externo preferir `textContent` / `createElement`.
- La API no tiene autenticación ni límite de peticiones; cualquiera en la red puede llenar la BD.
- `ia.service.clasificarImagen` no tiene timeout: si Flask se cuelga, la petición espera indefinidamente (el navegador no enviará más frames por `ocupado`). Usar `AbortSignal.timeout(...)`.
