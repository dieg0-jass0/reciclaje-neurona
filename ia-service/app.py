import numpy as np
import tensorflow as tf
from flask import Flask, jsonify, request
from PIL import Image

app = Flask(__name__)
model = tf.keras.models.load_model("modelo/botellas.keras")


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.post("/predict")
def predict():
    archivo = request.files.get("imagen")
    if archivo is None:
        return jsonify(error="Falta el campo 'imagen'"), 400

    img = Image.open(archivo.stream).convert("RGB").resize((224, 224))
    x = np.expand_dims(np.array(img, dtype="float32"), 0)

    p = float(model(x, training=False)[0][0])  # probabilidad de "no_botellas"
    es_botella = p < 0.5
    confianza = (1 - p) if es_botella else p
    return jsonify(esBotella=es_botella, confianza=round(confianza, 4))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000)
