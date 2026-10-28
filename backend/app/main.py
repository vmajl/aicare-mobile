
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app import models
from app.schemas import (
    MedicationCreate,
    MedicationResponse,
    MedicationUpdate,
    PatientCreate,
    PatientResponse,
)


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

@app.get("/")
def inicio():
    return {
        "mensagem": "API do AICare funcionando!",
        "status": "online",
    }


@app.get("/health")
def verificar_saude():
    return {"status": "ok"}


@app.get("/medications")
def listar_medicamentos(db: Session = Depends(get_db)):
    medicamentos = db.query(models.Medication).all()

    return [
        {
            "id": medicamento.id,
            "patient_id": medicamento.patient_id,
            "name": medicamento.name,
            "dosage": medicamento.dosage,
            "instructions": medicamento.instructions,
            "first_dose_at": medicamento.first_dose_at,
            "interval_hours": medicamento.interval_hours,
            "continuous": medicamento.continuous,
            "start_date": medicamento.start_date,
            "end_date": medicamento.end_date,
            "stock_quantity": medicamento.stock_quantity,
            "stock_unit": medicamento.stock_unit,
            "units_per_dose": medicamento.units_per_dose,
            "active": medicamento.active,
            "created_at": medicamento.created_at,
        }
        for medicamento in medicamentos
    ]

@app.post(
    "/medications",
    response_model=MedicationResponse,
    status_code=201,
)
def cadastrar_medicamento(
    dados: MedicationCreate,
    db: Session = Depends(get_db),
):
    paciente = db.query(models.Patient).filter(
        models.Patient.id == dados.patient_id,
        models.Patient.active == True,
    ).first()

    if paciente is None:
        raise HTTPException(
            status_code=404,
            detail="Paciente não encontrado ou inativo.",
        )

    medicamento = models.Medication(**dados.model_dump())

    db.add(medicamento)
    db.commit()
    db.refresh(medicamento)

    return medicamento


@app.put(
    "/medications/{medication_id}",
    response_model=MedicationResponse,
)
def atualizar_medicamento(
    medication_id: int,
    dados: MedicationUpdate,
    db: Session = Depends(get_db),
):
    medicamento = db.query(models.Medication).filter(
        models.Medication.id == medication_id
    ).first()

    if medicamento is None:
        raise HTTPException(
            status_code=404,
            detail="Medicamento não encontrado.",
        )

    alteracoes = dados.model_dump(exclude_unset=True)

    for campo, valor in alteracoes.items():
        setattr(medicamento, campo, valor)

    db.commit()
    db.refresh(medicamento)

    return medicamento


@app.post(
    "/patients",
    response_model=PatientResponse,
    status_code=201,
)
def cadastrar_paciente(
    dados: PatientCreate,
    db: Session = Depends(get_db),
):
    paciente = models.Patient(**dados.model_dump())

    db.add(paciente)
    db.commit()
    db.refresh(paciente)

    return paciente
