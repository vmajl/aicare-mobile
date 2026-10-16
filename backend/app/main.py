
from fastapi import FastAPI

from app.database import Base, engine
from app import models

app = FastAPI(
    title="AICare API",
    description="API do aplicativo AICare para gerenciamento de cuidados e medicamentos.",
    version="0.1.0",
)

Base.metadata.create_all(bind=engine)

@app.get("/")
def inicio():
    return {
        "mensagem": "API do AICare funcionando!",
        "status": "online",
    }


@app.get("/health")
def verificar_saude():
    return {"status": "ok"}
