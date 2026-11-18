
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, adicionar_colunas_ausentes, engine
from app import models  # noqa: F401  (registra as tabelas no Base)
from app.routers import auth as auth_routes
from app.routers import diary as diary_routes
from app.routers import invites as invite_routes
from app.routers import legacy_import as legacy_import_routes
from app.routers import medications as medication_routes
from app.routers import patients as patient_routes


app = FastAPI(
    title="AICare API",
    description="API do aplicativo AICare para gerenciamento de cuidados e medicamentos.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
Base.metadata.create_all(bind=engine)
adicionar_colunas_ausentes("patients", {"relationship": "VARCHAR(60)"})
adicionar_colunas_ausentes("invitations", {"name": "VARCHAR(120)"})
adicionar_colunas_ausentes("medications", {"minimum_stock": "FLOAT"})

app.include_router(auth_routes.router)
app.include_router(patient_routes.router)
app.include_router(invite_routes.router)
app.include_router(medication_routes.router)
app.include_router(diary_routes.router)
app.include_router(legacy_import_routes.router)


@app.get("/")
def inicio():
    return {
        "mensagem": "API do AICare funcionando!",
        "status": "online",
    }


@app.get("/health")
def verificar_saude():
    return {"status": "ok"}
