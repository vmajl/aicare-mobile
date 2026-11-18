
import base64
import binascii
import re
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.permissions import exigir_acesso_ao_paciente
from app.schemas import DiaryEntryResponse, DiaryEntryUpsert
from app.security import get_current_user, utcnow


router = APIRouter(tags=["Diário"])

MAX_PHOTO_BYTES = 8 * 1024 * 1024
DATA_URL_REGEX = re.compile(
    r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL
)


def _url_da_foto(entrada: models.DiaryEntry) -> str | None:
    if not entrada.photo_key:
        return None
    return f"/diary/photos/{entrada.photo_key}"


def _resposta(entrada: models.DiaryEntry) -> DiaryEntryResponse:
    return DiaryEntryResponse(
        id=entrada.id,
        patient_id=entrada.patient_id,
        date=entrada.entry_date,
        observation=entrada.observation or "",
        photo_url=_url_da_foto(entrada),
        created_by=entrada.created_by,
        created_at=entrada.created_at,
        updated_at=entrada.updated_at,
    )


def _decodificar_foto(data_url: str) -> tuple[bytes, str]:
    correspondencia = DATA_URL_REGEX.match(data_url.strip())
    if not correspondencia:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de foto inválido. Envie uma imagem em data URL (base64).",
        )

    mime, conteudo = correspondencia.groups()

    try:
        dados = base64.b64decode(re.sub(r"\s", "", conteudo), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível ler a foto enviada.",
        )

    if len(dados) > MAX_PHOTO_BYTES:
        raise HTTPException(
            status_code=413,
            detail="A foto é muito grande (máximo de 8 MB).",
        )

    return dados, mime


def _buscar_entrada(
    db: Session, patient_id: int, entry_date: date
) -> models.DiaryEntry | None:
    return (
        db.query(models.DiaryEntry)
        .filter(
            models.DiaryEntry.patient_id == patient_id,
            models.DiaryEntry.entry_date == entry_date,
        )
        .first()
    )


@router.get(
    "/patients/{patient_id}/diary",
    response_model=list[DiaryEntryResponse],
    summary="Listar publicações do diário",
)
def listar_diario(
    patient_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exigir_acesso_ao_paciente(db, usuario, patient_id)

    consulta = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.patient_id == patient_id
    )
    if date_from:
        consulta = consulta.filter(models.DiaryEntry.entry_date >= date_from)
    if date_to:
        consulta = consulta.filter(models.DiaryEntry.entry_date <= date_to)

    return [
        _resposta(entrada)
        for entrada in consulta.order_by(models.DiaryEntry.entry_date).all()
    ]


@router.put(
    "/patients/{patient_id}/diary/{entry_date}",
    response_model=DiaryEntryResponse,
    summary="Criar ou atualizar a publicação de uma data",
    description=(
        "Uma publicação por dia. `photo_data` omitido mantém a foto atual; "
        "`null` remove a foto."
    ),
)
def salvar_publicacao(
    patient_id: int,
    entry_date: date,
    dados: DiaryEntryUpsert,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exigir_acesso_ao_paciente(db, usuario, patient_id)

    entrada = _buscar_entrada(db, patient_id, entry_date)
    nova = entrada is None

    if nova:
        entrada = models.DiaryEntry(
            patient_id=patient_id,
            entry_date=entry_date,
            created_by=usuario.id,
        )
        db.add(entrada)
    else:
        entrada.updated_at = utcnow()

    entrada.observation = dados.observation.strip()

    if "photo_data" in dados.model_fields_set:
        if dados.photo_data:
            foto, mime = _decodificar_foto(dados.photo_data)
            entrada.photo = foto
            entrada.photo_mime = mime
            entrada.photo_key = uuid.uuid4().hex
        else:
            entrada.photo = None
            entrada.photo_mime = None
            entrada.photo_key = None

    if not entrada.observation and entrada.photo is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Adicione um comentário ou uma foto antes de publicar.",
        )

    db.commit()
    db.refresh(entrada)

    return _resposta(entrada)


@router.delete(
    "/patients/{patient_id}/diary/{entry_date}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Excluir a publicação de uma data",
)
def excluir_publicacao(
    patient_id: int,
    entry_date: date,
    usuario: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exigir_acesso_ao_paciente(db, usuario, patient_id)

    entrada = _buscar_entrada(db, patient_id, entry_date)
    if entrada is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Publicação não encontrada.",
        )

    db.delete(entrada)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/diary/photos/{photo_key}",
    summary="Foto de uma publicação",
    description=(
        "Endereço público, mas impossível de adivinhar (chave aleatória de "
        "128 bits), para que o componente `<Image>` do app carregue a foto "
        "sem cabeçalho de autenticação."
    ),
    response_class=Response,
)
def obter_foto(photo_key: str, db: Session = Depends(get_db)):
    entrada = (
        db.query(models.DiaryEntry)
        .filter(models.DiaryEntry.photo_key == photo_key)
        .first()
    )
    if entrada is None or entrada.photo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Foto não encontrada.",
        )

    return Response(
        content=entrada.photo,
        media_type=entrada.photo_mime or "image/jpeg",
        # A chave muda quando a foto muda, então o cache pode ser longo.
        headers={"Cache-Control": "private, max-age=31536000, immutable"},
    )
