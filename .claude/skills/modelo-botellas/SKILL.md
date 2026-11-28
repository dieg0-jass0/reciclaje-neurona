---
name: modelo-botellas
description: Contrato del modelo de IA botellas.keras (MobileNetV2) y del servicio Flask ia-service. Usar al tocar ia-service/app.py, cambiar el umbral o la confianza, reentrenar o reemplazar el modelo, depurar predicciones raras, o añadir nuevas clases de residuo.
---

# Modelo de botellas

## Arquitectura (verificada en `config.json` del `.keras`, Keras 3.15)

```
Input (224, 224, 3)  RGB, valores 0–255 float32
→ Aumento de datos (RandomFlip, RandomRotation, RandomZoom)  — solo activo en entrenamiento
→ Rescaling(scale=1/127.5, offset=-1)  → rango [-1, 1]
→ MobileNetV2 (ImageNet, congelado: trainable=False)
→ GlobalAveragePooling2D → Dense 128 relu → Dropout 0.3 → Dense 64 relu
→ Dense 1 sigmoid
```

## Contrato de entrada/salida

- **Entrada:** el modelo normaliza por dentro. Enviar píxeles crudos 0–255. **No** dividir entre 255 ni aplicar `preprocess_input` en `app.py`: se normalizaría dos veces y las predicciones se degradan sin dar error.
- Redimensionado actual: `resize((224, 224))` sin conservar proporción (estira la imagen). Si se cambia a recorte central, comprobar que coincide con cómo se entrenó.
- **Salida:** un número `p` = probabilidad de la clase **"no_botellas"** (orden alfabético de carpetas de Keras: `botellas`=0, `no_botellas`=1).
  - `esBotella = p < 0.5`
  - `confianza = 1 - p` si es botella, si no `p` → siempre ≥ 0.5.
- Llamar con `model(x, training=False)` para desactivar aumento y dropout.

## Respuesta del servicio

`POST /predict` (multipart, campo `imagen`) → `{"esBotella": bool, "confianza": float 0.5–1, 4 decimales}`; 400 si falta `imagen`.
`GET /health` → `{"status": "ok"}`. El servicio web considera la IA caída si `/health` tarda >1,5 s.

Si cambias estos campos, actualiza también `web/src/models/deteccion.model.js` y `web/src/public/js/camara.js` (ver skill `api-reciclaje`).

## Cambiar el umbral

El 0.5 está en `app.py`. Para priorizar no confundir basura con botellas, bajar el umbral (p. ej. `p < 0.35`) y recalcular la confianza con el mismo criterio. Hacerlo configurable por variable de entorno en vez de hardcodearlo.

## Reemplazar o reentrenar

1. Mantener entrada 224×224×3 con la capa `Rescaling` dentro del modelo, o cambiar el preprocesado de `app.py` a la vez.
2. Guardar en formato `.keras` con la misma versión mayor de Keras que `tensorflow` en `requirements.txt`.
3. Verificar antes de dar por bueno: cargar el modelo, predecir sobre 2–3 fotos conocidas de cada clase y revisar que `esBotella` sea correcto.
4. Para varias clases (vidrio, lata, cartón…): última capa `Dense(n, softmax)`, devolver `{clase, confianza}` y migrar el esquema Mongoose (`esBotella` → `clase`) y la UI. Es un cambio de contrato: planificarlo entero.

## Inspeccionar el modelo sin instalar TensorFlow

El `.keras` es un zip con `config.json`, `metadata.json` y `model.weights.h5`:

```bash
python3 -c "import zipfile,json; c=json.loads(zipfile.ZipFile('ia-service/modelo/botellas.keras').read('config.json')); print([l['class_name'] for l in c['config']['layers']])"
```

## Rendimiento

- `app.run` es el servidor de desarrollo de Flask, un solo hilo. Para producción usar `waitress` (Windows) o `gunicorn` (Linux) con 1 worker por núcleo; cada worker carga TensorFlow y el modelo (cientos de MB de RAM por worker).
- El navegador ya reduce el frame a ≤480 px de ancho antes de enviarlo.
