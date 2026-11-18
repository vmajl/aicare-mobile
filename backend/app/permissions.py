
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models


def exigir_acesso_ao_paciente(
    db: Session, usuario: models.User, patient_id: int
) -> models.Patient:
    """Garante que o usuário tem algum vínculo (administrador, familiar
    ou cuidador) com o paciente ativo."""
    paciente = db.get(models.Patient, patient_id)
    if paciente is None or not paciente.active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paciente não encontrado ou inativo.",
        )

    acesso = (
        db.query(models.PatientAccess)
        .filter(
            models.PatientAccess.user_id == usuario.id,
            models.PatientAccess.patient_id == patient_id,
        )
        .first()
    )
    if acesso is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem acesso a este paciente.",
        )

    return paciente


def exigir_medicamento_acessivel(
    db: Session, usuario: models.User, medication_id: int
) -> models.Medication:
    medicamento = db.get(models.Medication, medication_id)
    if medicamento is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicamento não encontrado.",
        )

    exigir_acesso_ao_paciente(db, usuario, medicamento.patient_id)
    return medicamento
