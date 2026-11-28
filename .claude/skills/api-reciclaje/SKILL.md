---
name: api-reciclaje
description: Contrato REST de la web Express y flujo de datos cámara → Express → Flask → MongoDB del proyecto reciclaje-neurona. Usar al añadir o modificar endpoints, controladores, el modelo Mongoose, camara.js o el dashboard, para no romper los campos que consume cada capa.
---

# API y flujo de datos

## Flujo de una clasificación

1. `camara.js` toma un frame del `<video>` cada `INTERVALO_MS` (1000 ms), lo reduce a ≤480 px de ancho y lo manda como JPEG. Si la petición anterior sigue en curso (`ocupado`), salta el frame.
2. `POST /api/clasificar` (requiere sesión) → multer en memoria (máx. 3 MB, solo `image/*`) → `clasificacion.controller.clasificar`.
3. El controlador llama a `ia.service.clasificarImagen` → Flask `/predict`.
4. `conteo.service.registrarFrame(usuarioId, resultado)` decide si el frame es una botella **nueva** de esa persona (semáforo en memoria, por usuario):
   - `confirmando`: botella vista, faltan frames seguidos (`CONTEO_FRAMES_CONFIRMAR`).
   - `contar`: botella nueva → se guarda UNA `Deteccion` con `puntos = PUNTOS_POR_BOTELLA`.
   - `ya_contada`: la misma botella sigue frente a la cámara; no suma.
   - `esperar`: aún no pasa `CONTEO_ESPERA_SEG` desde la última botella.
   - `nada`: no hay botella (o seguridad < `CONTEO_CONFIANZA_MIN`). Tras `CONTEO_FRAMES_LIBERAR` frames así, se puede contar otra.
5. Solo en `contar` se escribe en MongoDB. `camara.js` muestra el mensaje según `accion` y refresca `/api/resumen` y `/api/historial`.

Límite: el modelo no distingue botellas individuales; retirar y volver a mostrar la misma botella cuenta como otra. El flujo correcto es depositarla tras el conteo. El estado vive en memoria: reiniciar el servidor lo reinicia (no borra puntos).

## Endpoints

| Método y ruta | Respuesta OK | Errores |
|---|---|---|
| `POST /api/clasificar` (multipart `imagen`) | `{ esBotella, confianza, accion, faltan?, esperaMs?, entrega? }`; `entrega = { id, esBotella, confianza, puntos, fecha }` solo si `accion = "contar"` | 400 · 401 · 502 · 500 |
| `GET /api/historial?limite=N` | Botellas contadas de la persona con sesión: `[{ id, esBotella, confianza, puntos, fecha }]` (1–100, por defecto 20) | 401 · 500 |
| `GET /api/resumen` | `{ botellas, puntos, puntosPorBotella }` de la persona con sesión | 401 · 500 |
| `GET /api/estado` (pública) | `{ web: "ok", ia: "ok"\|"caido", db: "ok"\|"caido" }` | — |
| `GET /` | Dashboard HTML (requiere sesión) | redirige a `/login` |
| `GET /reporte.pdf` | PDF con puntos, botellas, gráfica de 14 días y últimas 200 botellas de la persona con sesión (`utils/reporte-pdf.js`, pdfkit) | redirige a `/login` |
| `GET /admin/usuarios/:id/reporte.pdf` | El mismo reporte de cualquier usuario (solo admin) | 403 · 404 |

Formato de error: `{ error: "mensaje para el usuario", detalle?: "err.message" }`.

## Base de datos

`Deteccion` = una botella reciclada: `{ esBotella: true, confianza, puntos, usuarioId, fecha }`. Los puntajes se calculan sumando `puntos` (no hay un campo de puntos en `Usuario`, así no se desincroniza). Los documentos antiguos (uno por frame, sin `puntos`) se ignoran con el filtro `ENTREGA = { esBotella: true, puntos: { $gt: 0 } }`.

## Quién consume cada campo

| Campo | Lo produce | Lo usan |
|---|---|---|
| `esBotella`, `confianza` | Flask `app.py` | `conteo.service.js`, `camara.js` |
| `accion` | `conteo.service.js` | `camara.js` (mensaje del veredicto) |
| `puntos` | controlador (`REGLAS.puntosPorBotella`) | marcador y cinta en `camara.js`, panel y PDF de admin |
| `botellas/puntos` (resumen) | `Deteccion.resumenUsuario()` | `#puntos`, `#botellas` en `dashboard.hbs` |

Renombrar un campo exige cambiar todas las columnas de su fila.

## Cómo añadir un endpoint

1. Función en el modelo (`deteccion.model.js`) que devuelva objetos planos vía `aPlano` (nunca documentos Mongoose).
2. Controlador `async (req, res)` con `try/catch` y el formato de error anterior.
3. Ruta en `api.routes.js`.
4. Validar y acotar parámetros de query (como `limite` en `historial`).
5. Documentarlo en `README.md` y en la tabla de arriba.

## Cuidados conocidos

- Para texto externo en `camara.js`, usar `textContent` / `createElement`, nunca `innerHTML`.
- La API requiere sesión pero no tiene límite de peticiones.
- `ia.service.clasificarImagen` no tiene timeout: si Flask se cuelga, la petición espera indefinidamente (el navegador no enviará más frames por `ocupado`). Usar `AbortSignal.timeout(...)`.
