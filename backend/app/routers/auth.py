
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.schemas import (
    InviteRegister,
    TokenResponse,
    UserRegister,
    UserResponse,
)
from app.security import (
    TOKEN_TYPE_INVITE,
    create_access_token,
    decode_token,
    get_current_user,
    hash_password,
    utcnow,
    verify_password,
)


router = APIRouter(prefix="/auth", tags=["Autenticação"])


def _family_id(db: Session, user: models.User) -> int:
    """Família = grupo do familiar administrador.

    Para quem entrou por convite, é o administrador que emitiu o convite.
    """
    if user.role == models.ROLE_FAMILY_ADMIN:
        return user.id

    convite = (
        db.query(models.Invitation)
        .filter(models.Invitation.accepted_by == user.id)
        .first()
    )
    return convite.invited_by if convite else user.id


def _user_response(db: Session, user: models.User) -> UserResponse:
    resposta = UserResponse.model_validate(user)
    resposta.family_id = _family_id(db, user)
    return resposta


def _token_response(db: Session, user: models.User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user),
        user=_user_response(db, user),
    )


def _garantir_email_disponivel(db: Session, email: str) -> None:
    existe = db.query(models.User).filter(models.User.email == email).first()
    if existe:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe uma conta cadastrada com esse e-mail.",
        )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar familiar administrador",
    description=(
        "Cria a conta do familiar responsável (perfil `family_admin`). "
        "Depois de autenticado, ele pode cadastrar pacientes em "
        "`POST /patients` e convidar cuidadores ou familiares."
    ),
)
def cadastrar_familiar_administrador(
    dados: UserRegister,
    db: Session = Depends(get_db),
):
    _garantir_email_disponivel(db, dados.email)

    usuario = models.User(
        name=dados.name,
        email=dados.email,
        password_hash=hash_password(dados.password),
        role=models.ROLE_FAMILY_ADMIN,
    )

    db.add(usuario)
    db.commit()
    db.refresh(usuario)

    return _token_response(db, usuario)


@router.post(
    "/register/invite",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar cuidador (ou familiar) por convite",
    description=(
        "Cria a conta a partir do token JWT gerado em "
        "`POST /patients/{patient_id}/invites` e vincula o novo usuário "
        "ao paciente do convite. Cada convite só pode ser usado uma vez."
    ),
)
def cadastrar_por_convite(
    dados: InviteRegister,
    db: Session = Depends(get_db),
):
    payload = decode_token(
        dados.invite_token,
        TOKEN_TYPE_INVITE,
        status_code=status.HTTP_400_BAD_REQUEST,
    )

    convite = (
        db.query(models.Invitation)
        .filter(models.Invitation.jti == payload.get("jti"))
        .first()
    )

    if convite is None or convite.revoked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convite inválido ou revogado.",
        )

    if convite.used_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este convite já foi utilizado.",
        )

    if convite.expires_at < utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convite expirado.",
        )

    if convite.email and convite.email != dados.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este convite foi emitido para outro e-mail.",
        )

    paciente = db.get(models.Patient, convite.patient_id)
    if paciente is None or not paciente.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O paciente deste convite não está mais ativo.",
        )

    _garantir_email_disponivel(db, dados.email)

    usuario = models.User(
        name=dados.name,
        email=dados.email,
        password_hash=hash_password(dados.password),
        role=convite.role,
    )
    db.add(usuario)
    db.flush()

    db.add(
        models.PatientAccess(
            user_id=usuario.id,
            patient_id=convite.patient_id,
            role=convite.role,
        )
    )

    convite.used_at = utcnow()
    convite.accepted_by = usuario.id

    db.commit()
    db.refresh(usuario)

    return _token_response(db, usuario)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Entrar (gera token de acesso)",
    description=(
        "Use o e-mail no campo `username`. "
        "No Swagger, use o botão **Authorize** para autenticar."
    ),
)
def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    email = form.username.strip().lower()
    usuario = db.query(models.User).filter(models.User.email == email).first()

    if (
        usuario is None
        or not usuario.active
        or not verify_password(form.password, usuario.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _token_response(db, usuario)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Dados do usuário autenticado",
)
def usuario_atual(
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _user_response(db, usuario)
