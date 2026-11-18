
import os
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt
from sqlalchemy.orm import Session

from app import models
from app.database import get_db


# Defina AICARE_SECRET_KEY no ambiente fora do desenvolvimento local.
SECRET_KEY = os.getenv(
    "AICARE_SECRET_KEY", "aicare-dev-secret-altere-em-producao"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    # Padrão de 7 dias: o app não possui fluxo de refresh token.
    os.getenv("AICARE_ACCESS_TOKEN_MINUTES", str(60 * 24 * 7))
)

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_INVITE = "invite"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/auth/login", auto_error=False
)


# ======================================================
# DATAS
# ======================================================

def utcnow() -> datetime:
    """Data/hora atual em UTC sem fuso (mesmo padrão salvo no banco)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ======================================================
# SENHAS
# ======================================================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"), password_hash.encode("utf-8")
        )
    except ValueError:
        return False


# ======================================================
# TOKENS JWT
# ======================================================

def create_access_token(user: models.User) -> str:
    agora = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "type": TOKEN_TYPE_ACCESS,
        "iat": agora,
        "exp": agora + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_invite_token(invite: models.Invitation) -> str:
    payload = {
        "jti": invite.jti,
        "patient_id": invite.patient_id,
        "role": invite.role,
        "type": TOKEN_TYPE_INVITE,
        "iat": datetime.now(timezone.utc),
        "exp": invite.expires_at.replace(tzinfo=timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(
    token: str,
    expected_type: str,
    status_code: int = status.HTTP_401_UNAUTHORIZED,
) -> dict:
    headers = (
        {"WWW-Authenticate": "Bearer"}
        if status_code == status.HTTP_401_UNAUTHORIZED
        else None
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status_code,
            detail="Token expirado.",
            headers=headers,
        )
    except JWTError:
        raise HTTPException(
            status_code=status_code,
            detail="Token inválido.",
            headers=headers,
        )

    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status_code,
            detail="Tipo de token inválido.",
            headers=headers,
        )

    return payload


# ======================================================
# DEPENDÊNCIAS
# ======================================================

def _user_from_token(token: str, db: Session) -> models.User:
    payload = decode_token(token, TOKEN_TYPE_ACCESS)

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        user_id = None

    user = db.get(models.User, user_id) if user_id else None

    if user is None or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário não encontrado ou inativo.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    return _user_from_token(token, db)


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> models.User | None:
    if token is None:
        return None
    return _user_from_token(token, db)
