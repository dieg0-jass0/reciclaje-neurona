---
name: arranque-local
description: Levantar, verificar y diagnosticar en local los tres servicios de reciclaje-neurona (Flask + TensorFlow, MongoDB, Express). Usar al ejecutar la app, probar un cambio de punta a punta, o cuando algo "no funciona" (IA caída, MongoDB no conecta, cámara sin permiso, puerto ocupado).
---

# Arranque y verificación local

## Orden de arranque

El orden importa: Express sale con `process.exit(1)` si MongoDB no conecta en 5 s.

1. **MongoDB** — local (`mongod`, `mongodb://127.0.0.1:27017/reciclaje`) o Atlas (añadir la IP en *Network Access*).
2. **IA** — `cd ia-service && source venv/bin/activate && python app.py` (Windows: `venv\Scripts\activate`). Tarda varios segundos en cargar TensorFlow y el modelo.
3. **Web** — `cd web && npm run dev` (nodemon recarga al guardar).

## Verificación (hacerla siempre antes de dar algo por terminado)

```bash
curl -s localhost:5000/health                      # {"status":"ok"}
curl -s localhost:3000/api/estado                  # {"web":"ok","ia":"ok","db":"ok"}
curl -s -F imagen=@/ruta/a/foto.jpg localhost:3000/api/clasificar   # {id, esBotella, confianza, fecha}
curl -s localhost:3000/api/resumen
curl -s "localhost:3000/api/historial?limite=3"
```

Para la interfaz: abrir `http://localhost:3000` (la cámara solo funciona en `localhost` o HTTPS). En un entorno sin cámara, con Playwright lanzar Chromium con `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` y revisar que `#resultado` cambie y que el historial se llene.

## Diagnóstico rápido

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `No se pudo conectar a MongoDB` y la web se cierra | `MONGODB_URI` vacío o incorrecto, mongod parado, IP no permitida en Atlas | Revisar `web/.env`; `mongosh "$MONGODB_URI"` |
| Chip "IA: caido" | Flask no arrancó o `IA_URL` mal | `curl localhost:5000/health`; ver la consola de Flask |
| Error al cargar el modelo | Falta `modelo/botellas.keras` o versión de TF/Keras distinta | Ejecutar desde `ia-service/` (la ruta es relativa); comparar versiones con `metadata.json` del `.keras` |
| `pip install tensorflow` falla | Python fuera de 3.12/3.13 | Crear el venv con una versión compatible |
| "No se pudo acceder a la cámara" | Permiso denegado, otra app usa la cámara, o no es localhost/HTTPS | Revisar permisos del navegador |
| 502 en `/api/clasificar` | Flask devolvió error o se cayó | Mirar el traceback en la consola de Flask |
| `EADDRINUSE` | Puerto 3000 o 5000 ocupado | Cambiar `PORT` en `.env` o cerrar el proceso |
| Predicciones siempre iguales | Preprocesado alterado (doble normalización) | Ver skill `modelo-botellas` |

## Notas

- `.vscode/settings.json` activa `python.terminal.useEnvFile`.
- No hay `docker-compose` todavía; si se crea, la web debe usar `IA_URL=http://ia:5000` y `MONGODB_URI=mongodb://mongo:27017/reciclaje`, y esperar a Mongo antes de arrancar.
