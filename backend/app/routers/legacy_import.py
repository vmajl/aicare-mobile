
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.routers.patients import _paciente_administrado
from app.schemas import LegacyImportRequest, LegacyImportResponse
from app.security import get_current_user, utcnow


router = APIRouter(tags=["Importação"])


def _utc(valor: datetime) -> datetime:
    if valor.tzinfo is not None:
        valor = valor.astimezone(timezone.utc).replace(tzinfo=None)
    return valor.replace(microsecond=0)


@router.post(
    "/patients/{patient_id}/legacy-import",
    response_model=LegacyImportResponse,
    summary="Importar medicamentos salvos localmente (versão antiga do app)",
    description=(
        "Grava medicamentos, doses e movimentações de estoque exatamente como "
        "estavam no aparelho, **sem** aplicar novamente as baixas de estoque "
        "(a quantidade enviada já é o saldo final). Tudo ou nada: se um item "
        "for inválido, nada é gravado. Somente o familiar administrador."
    ),
)
def importar_dados_locais(
    patient_id: int,
    dados: LegacyImportRequest,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _paciente_administrado(db, usuario, patient_id)

    ignorados = 0

    # Medicamentos: legacy_id do app -> registro novo.
    medicamentos: dict[str, models.Medication] = {}
    for item in dados.medications:
        campos = item.model_dump(exclude={"legacy_id"})
        medicamento = models.Medication(patient_id=patient_id, **campos)
        db.add(medicamento)
        medicamentos[item.legacy_id] = medicamento

    db.flush()

    # Doses: ignora as de medicamentos desconhecidos e as repetidas.
    doses: dict[str, models.DoseRecord] = {}
    vistos: set[tuple[int, datetime]] = set()
    total_doses = 0

    for item in dados.doses:
        medicamento = medicamentos.get(item.legacy_medication_id)
        previsto = _utc(item.scheduled_at)

        if medicamento is None or (medicamento.id, previsto) in vistos:
            ignorados += 1
            continue

        vistos.add((medicamento.id, previsto))
        registro = models.DoseRecord(
            medication_id=medicamento.id,
            scheduled_at=previsto,
            administered_at=_utc(item.administered_at),
            administered_by=usuario.id,
            stock_deducted=item.stock_deducted,
            stock_unit=item.stock_unit,
        )
        db.add(registro)
        total_doses += 1

        if item.legacy_id:
            doses[item.legacy_id] = registro

    db.flush()

    # Movimentações de estoque (histórico apenas, sem alterar o saldo).
    total_movimentos = 0
    for item in dados.movements:
        medicamento = medicamentos.get(item.legacy_medication_id)
        if medicamento is None:
            ignorados += 1
            continue

        dose = doses.get(item.legacy_dose_id) if item.legacy_dose_id else None

        db.add(
            models.InventoryMovement(
                medication_id=medicamento.id,
                type=item.type,
                quantity=item.quantity,
                unit=item.unit,
                description=item.description,
                dose_record_id=dose.id if dose else None,
                created_by=usuario.id,
                created_at=_utc(item.created_at) if item.created_at else utcnow(),
            )
        )
        total_movimentos += 1

    db.commit()

    return LegacyImportResponse(
        medications=len(medicamentos),
        doses=total_doses,
        movements=total_movimentos,
        skipped=ignorados,
    )
