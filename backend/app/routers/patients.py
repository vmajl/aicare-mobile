
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.schemas import (
    PatientCreate,
    PatientResponse,
    PatientUpdate,
    PatientWithAccessResponse,
)
from app.security import get_current_user, get_current_user_optional


router = APIRouter(prefix="/patients", tags=["Pacientes"])


def _paciente_administrado(
    db: Session, usuario: models.User, patient_id: int
) -> models.Patient:
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
            models.PatientAccess.role == models.ROLE_FAMILY_ADMIN,
        )
        .first()
    )
    if acesso is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Somente o familiar administrador pode alterar este paciente.",
        )

    return paciente


@router.get(
    "",
    response_model=list[PatientWithAccessResponse],
    summary="Listar pacientes do usuário autenticado",
)
def listar_pacientes(
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    linhas = (
        db.query(models.Patient, models.PatientAccess.role)
        .join(
            models.PatientAccess,
            models.PatientAccess.patient_id == models.Patient.id,
        )
        .filter(
            models.PatientAccess.user_id == usuario.id,
            models.Patient.active == True,  # noqa: E712
        )
        .order_by(models.Patient.id)
        .all()
    )

    return [
        PatientWithAccessResponse(
            **PatientResponse.model_validate(paciente).model_dump(),
            access_role=papel,
        )
        for paciente, papel in linhas
    ]


@router.post(
    "",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar paciente",
    description=(
        "Se chamado por um familiar administrador autenticado, ele passa a "
        "ser o administrador do paciente (necessário para emitir convites)."
    ),
)
def cadastrar_paciente(
    dados: PatientCreate,
    db: Session = Depends(get_db),
    usuario: models.User | None = Depends(get_current_user_optional),
):
    paciente = models.Patient(**dados.model_dump())

    db.add(paciente)
    db.flush()

    if usuario is not None and usuario.role == models.ROLE_FAMILY_ADMIN:
        db.add(
            models.PatientAccess(
                user_id=usuario.id,
                patient_id=paciente.id,
                role=models.ROLE_FAMILY_ADMIN,
            )
        )

    db.commit()
    db.refresh(paciente)

    return paciente


@router.put(
    "/{patient_id}",
    response_model=PatientResponse,
    summary="Atualizar paciente",
)
def atualizar_paciente(
    patient_id: int,
    dados: PatientUpdate,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    paciente = _paciente_administrado(db, usuario, patient_id)

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(paciente, campo, valor)

    db.commit()
    db.refresh(paciente)

    return paciente


@router.delete(
    "/{patient_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desativar paciente",
)
def desativar_paciente(
    patient_id: int,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    paciente = _paciente_administrado(db, usuario, patient_id)
    paciente.active = False
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
