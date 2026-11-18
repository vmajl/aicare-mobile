
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.schemas import InviteCreate, InviteCreatedResponse, InviteResponse
from app.security import create_invite_token, get_current_user, utcnow


router = APIRouter(
    prefix="/patients/{patient_id}/invites",
    tags=["Convites"],
)


def exigir_administrador_do_paciente(
    patient_id: int,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
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
            detail=(
                "Somente o familiar administrador do paciente "
                "pode gerenciar convites."
            ),
        )

    return usuario


@router.post(
    "",
    response_model=InviteCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gerar convite (JWT) para cuidador ou familiar",
    description=(
        "Gera um token JWT de convite. Envie o `invite_token` ao convidado, "
        "que deve usá-lo em `POST /auth/register/invite`."
    ),
)
def criar_convite(
    patient_id: int,
    dados: InviteCreate,
    usuario: models.User = Depends(exigir_administrador_do_paciente),
    db: Session = Depends(get_db),
):
    convite = models.Invitation(
        jti=uuid.uuid4().hex,
        patient_id=patient_id,
        role=dados.role,
        name=dados.name.strip() if dados.name and dados.name.strip() else None,
        email=dados.email,
        invited_by=usuario.id,
        expires_at=utcnow() + timedelta(hours=dados.expires_in_hours),
    )

    db.add(convite)
    db.commit()
    db.refresh(convite)

    return _com_token(convite)


def _com_token(convite: models.Invitation) -> InviteCreatedResponse:
    return InviteCreatedResponse(
        **InviteResponse.model_validate(convite).model_dump(),
        invite_token=create_invite_token(convite),
    )


@router.get(
    "",
    response_model=list[InviteCreatedResponse],
    summary="Listar convites do paciente",
    description="Inclui o `invite_token` para que o convite possa ser compartilhado novamente.",
)
def listar_convites(
    patient_id: int,
    _: models.User = Depends(exigir_administrador_do_paciente),
    db: Session = Depends(get_db),
):
    convites = (
        db.query(models.Invitation)
        .filter(models.Invitation.patient_id == patient_id)
        .order_by(models.Invitation.created_at.desc())
        .all()
    )
    return [_com_token(convite) for convite in convites]


@router.delete(
    "/{invite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revogar convite",
)
def revogar_convite(
    patient_id: int,
    invite_id: int,
    _: models.User = Depends(exigir_administrador_do_paciente),
    db: Session = Depends(get_db),
):
    convite = (
        db.query(models.Invitation)
        .filter(
            models.Invitation.id == invite_id,
            models.Invitation.patient_id == patient_id,
        )
        .first()
    )
    if convite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Convite não encontrado.",
        )
    if convite.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Convite já utilizado não pode ser revogado.",
        )

    convite.revoked = True
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
