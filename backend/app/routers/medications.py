
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.permissions import (
    exigir_acesso_ao_paciente,
    exigir_medicamento_acessivel,
)
from app.schemas import (
    DoseCreate,
    DoseRecordResponse,
    InventoryMovementResponse,
    MedicationCreate,
    MedicationResponse,
    MedicationUpdate,
    StockEntryCreate,
)
from app.security import get_current_user, utcnow


router = APIRouter(tags=["Medicamentos"])


# ======================================================
# AUXILIARES
# ======================================================

def _para_utc_sem_fuso(valor: datetime) -> datetime:
    """Normaliza para UTC sem fuso, o padrão gravado no banco."""
    if valor.tzinfo is not None:
        valor = valor.astimezone(timezone.utc).replace(tzinfo=None)
    return valor.replace(microsecond=0)


def _arredondar(valor: float) -> float:
    return round(valor, 4)


def _tem_controle_de_estoque(medicamento: models.Medication) -> bool:
    return (
        medicamento.stock_quantity is not None
        and medicamento.units_per_dose is not None
        and bool((medicamento.stock_unit or "").strip())
    )


def _formatar_quantidade(valor: float) -> str:
    return f"{valor:g}".replace(".", ",")


def _movimento_response(
    movimento: models.InventoryMovement, nome: str
) -> InventoryMovementResponse:
    resposta = InventoryMovementResponse.model_validate(movimento)
    resposta.medication_name = nome
    return resposta


# ======================================================
# MEDICAMENTOS
# ======================================================

@router.get(
    "/patients/{patient_id}/medications",
    response_model=list[MedicationResponse],
    summary="Listar medicamentos do paciente",
)
def listar_medicamentos(
    patient_id: int,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exigir_acesso_ao_paciente(db, usuario, patient_id)

    return (
        db.query(models.Medication)
        .filter(models.Medication.patient_id == patient_id)
        .order_by(models.Medication.id)
        .all()
    )


@router.post(
    "/patients/{patient_id}/medications",
    response_model=MedicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar medicamento",
)
def cadastrar_medicamento(
    patient_id: int,
    dados: MedicationCreate,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exigir_acesso_ao_paciente(db, usuario, patient_id)

    medicamento = models.Medication(patient_id=patient_id, **dados.model_dump())

    db.add(medicamento)
    db.commit()
    db.refresh(medicamento)

    return medicamento


@router.put(
    "/medications/{medication_id}",
    response_model=MedicationResponse,
    summary="Atualizar medicamento",
)
def atualizar_medicamento(
    medication_id: int,
    dados: MedicationUpdate,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medicamento = exigir_medicamento_acessivel(db, usuario, medication_id)

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(medicamento, campo, valor)

    if (
        medicamento.start_date
        and medicamento.end_date
        and medicamento.end_date < medicamento.start_date
    ):
        raise HTTPException(
            status_code=422,
            detail="A data final não pode ser anterior à data inicial.",
        )

    db.commit()
    db.refresh(medicamento)

    return medicamento


@router.delete(
    "/medications/{medication_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir medicamento",
    description="Remove também o histórico de doses e de estoque do medicamento.",
)
def excluir_medicamento(
    medication_id: int,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medicamento = exigir_medicamento_acessivel(db, usuario, medication_id)

    db.delete(medicamento)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ======================================================
# DOSES
# ======================================================

@router.get(
    "/patients/{patient_id}/doses",
    response_model=list[DoseRecordResponse],
    summary="Listar doses administradas do paciente",
)
def listar_doses(
    patient_id: int,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exigir_acesso_ao_paciente(db, usuario, patient_id)

    return (
        db.query(models.DoseRecord)
        .join(
            models.Medication,
            models.Medication.id == models.DoseRecord.medication_id,
        )
        .filter(models.Medication.patient_id == patient_id)
        .order_by(models.DoseRecord.scheduled_at)
        .all()
    )


@router.post(
    "/medications/{medication_id}/doses",
    response_model=DoseRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar dose administrada",
    description=(
        "Registra a administração da dose prevista em `scheduled_at` e, se o "
        "medicamento tiver controle de estoque, dá baixa na quantidade por dose."
    ),
)
def administrar_dose(
    medication_id: int,
    dados: DoseCreate,
    response: Response,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medicamento = exigir_medicamento_acessivel(db, usuario, medication_id)
    previsto = _para_utc_sem_fuso(dados.scheduled_at)

    existente = (
        db.query(models.DoseRecord)
        .filter(
            models.DoseRecord.medication_id == medication_id,
            models.DoseRecord.scheduled_at == previsto,
        )
        .first()
    )
    if existente is not None:
        # Idempotente: a dose já havia sido registrada.
        response.status_code = status.HTTP_200_OK
        return existente

    baixa = 0.0
    unidade = None

    if _tem_controle_de_estoque(medicamento):
        estoque = medicamento.stock_quantity or 0
        consumo = medicamento.units_per_dose or 0

        if estoque < consumo:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Estoque insuficiente de {medicamento.name}. "
                    f"Disponível: {_formatar_quantidade(estoque)} {medicamento.stock_unit}. "
                    f"Necessário: {_formatar_quantidade(consumo)} {medicamento.stock_unit}."
                ),
            )

        baixa = consumo
        unidade = medicamento.stock_unit
        medicamento.stock_quantity = _arredondar(estoque - consumo)

    registro = models.DoseRecord(
        medication_id=medication_id,
        scheduled_at=previsto,
        administered_at=utcnow().replace(microsecond=0),
        administered_by=usuario.id,
        stock_deducted=baixa,
        stock_unit=unidade,
    )
    db.add(registro)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta dose já foi registrada.",
        )

    if baixa > 0 and unidade:
        db.add(
            models.InventoryMovement(
                medication_id=medication_id,
                type="administration",
                quantity=baixa,
                unit=unidade,
                description="Saída por administração de dose",
                dose_record_id=registro.id,
                created_by=usuario.id,
            )
        )

    db.commit()
    db.refresh(registro)

    return registro


@router.delete(
    "/doses/{dose_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desfazer registro de dose",
    description="Remove o registro e devolve ao estoque a quantidade baixada.",
)
def desfazer_dose(
    dose_id: int,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    registro = db.get(models.DoseRecord, dose_id)
    if registro is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de dose não encontrado.",
        )

    medicamento = exigir_medicamento_acessivel(
        db, usuario, registro.medication_id
    )

    if registro.stock_deducted and registro.stock_deducted > 0:
        if medicamento.stock_quantity is not None:
            medicamento.stock_quantity = _arredondar(
                medicamento.stock_quantity + registro.stock_deducted
            )

        db.add(
            models.InventoryMovement(
                medication_id=medicamento.id,
                type="reversal",
                quantity=registro.stock_deducted,
                unit=registro.stock_unit or medicamento.stock_unit or "",
                description="Estorno de administração",
                dose_record_id=registro.id,
                created_by=usuario.id,
            )
        )

    db.delete(registro)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ======================================================
# ESTOQUE
# ======================================================

@router.get(
    "/patients/{patient_id}/inventory-movements",
    response_model=list[InventoryMovementResponse],
    summary="Listar movimentações de estoque do paciente",
)
def listar_movimentacoes(
    patient_id: int,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exigir_acesso_ao_paciente(db, usuario, patient_id)

    linhas = (
        db.query(models.InventoryMovement, models.Medication.name)
        .join(
            models.Medication,
            models.Medication.id == models.InventoryMovement.medication_id,
        )
        .filter(models.Medication.patient_id == patient_id)
        .order_by(models.InventoryMovement.created_at)
        .all()
    )

    return [_movimento_response(movimento, nome) for movimento, nome in linhas]


@router.post(
    "/medications/{medication_id}/stock-entries",
    response_model=InventoryMovementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Repor estoque",
)
def repor_estoque(
    medication_id: int,
    dados: StockEntryCreate,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    medicamento = exigir_medicamento_acessivel(db, usuario, medication_id)

    if not (medicamento.stock_unit or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cadastre a unidade de estoque antes de fazer a reposição.",
        )

    if medicamento.stock_quantity is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A quantidade atual do estoque não é válida.",
        )

    medicamento.stock_quantity = _arredondar(
        medicamento.stock_quantity + dados.quantity
    )

    movimento = models.InventoryMovement(
        medication_id=medication_id,
        type="entry",
        quantity=dados.quantity,
        unit=medicamento.stock_unit,
        description=(dados.description or "").strip() or "Reposição de estoque",
        created_by=usuario.id,
    )
    db.add(movimento)
    db.commit()
    db.refresh(movimento)

    return _movimento_response(movimento, medicamento.name)
