# Clasificador de botellas - Web MVC

Arquitectura:  Navegador (camara) -> Express (MVC) -> Servicio Python (modelo)

## 1. Servicio de IA (Python 3.12 o 3.13)
    cd ia-service
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    (copia botellas.keras dentro de ia-service\modelo\)
    python app.py            -> http://127.0.0.1:5000

## 2. MongoDB
Usa MongoDB local o Atlas y pon la cadena de conexion en web\.env (MONGODB_URI).
En Atlas: agrega tu IP en Network Access.

## 3. Web (Node 18 o superior)
    cd web
    copy .env.example .env   (y edita MONGODB_URI)
    npm install
    npm run dev              -> http://localhost:3000

## API REST
    POST /api/clasificar   (multipart, campo "imagen")  -> { id, esBotella, confianza, fecha }
    GET  /api/historial?limite=20
    GET  /api/resumen
    GET  /api/estado           -> { web, ia, db }
