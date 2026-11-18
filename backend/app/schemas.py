
import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from pydantic import field_validator


EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalizar_email(valor: str) -> str:
    valor = valor.strip().lower()
    if not EMAIL_REGEX.match(valor):
        raise ValueError("E-mail inválido.")
    return valor


# ======================================================
# USUÁRIOS / AUTENTICAÇÃO
# ======================================================

UserRole = Literal["family_admin", "family", "caregiver"]
InviteRole = Literal["caregiver", "family"]


class UserRegister(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=255, examples=["maria@email.com"])
    password: str = Field(min_length=6, max_length=72)

    @field_validator("name")
    @classmethod
    def limpar_nome(cls, valor: str) -> str:
        valor = valor.strip()
        if not valor:
            raise ValueError("Informe o nome.")
        return valor

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str) -> str:
        return normalizar_email(valor)

    @field_validator("password")
    @classmethod
    def validar_senha(cls, valor: str) -> str:
        # O bcrypt aceita no máximo 72 bytes.
        if len(valor.encode("utf-8")) > 72:
            raise ValueError("A senha deve ter no máximo 72 bytes.")
        return valor


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: UserRole
    active: bool
    created_at: datetime
    family_id: int | None = Field(
        default=None,
        description=(
            "Identificador da família: id do familiar administrador "
            "responsável (o próprio usuário, se for administrador)."
        ),
    )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class InviteCreate(BaseModel):
    role: InviteRole = "caregiver"
    name: str | None = Field(
        default=None,
        max_length=120,
        description="Nome da pessoa convidada (apenas informativo).",
    )
    email: str | None = Field(
        default=None,
        max_length=255,
        description="Se informado, somente este e-mail poderá usar o convite.",
    )
    expires_in_hours: int = Field(default=72, gt=0, le=720)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str | None) -> str | None:
        return normalizar_email(valor) if valor else None


class InviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    role: InviteRole
    name: str | None
    email: str | None
    expires_at: datetime
    used_at: datetime | None
    revoked: bool
    created_at: datetime


class InviteCreatedResponse(InviteResponse):
    invite_token: str


class InviteRegister(UserRegister):
    invite_token: str = Field(min_length=1)


# ======================================================
# MEDICAMENTOS
# ======================================================


def _data_opcional(valor):
    """Aceita AAAA-MM-DD, DD/MM/AAAA ou vazio."""
    if isinstance(valor, str):
        valor = valor.strip()
        if valor == "":
            return None
        if "/" in valor:
            return date.fromisoformat("-".join(reversed(valor.split("/"))))
    return valor


class MedicationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    dosage: str = Field(min_length=1, max_length=100)
    instructions: str | None = None

    first_dose_at: datetime | None = Field(
        default=None,
        description="Data/hora local da primeira dose (o app usa o horário).",
    )
    interval_hours: float | None = Field(default=None, gt=0, le=24)
    continuous: bool = False
    start_date: date | None = None
    end_date: date | None = None

    stock_quantity: float | None = Field(default=None, ge=0)
    stock_unit: str | None = Field(default=None, max_length=30)
    units_per_dose: float | None = Field(default=None, gt=0)
    minimum_stock: float | None = Field(default=None, ge=0)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def aceitar_data_brasileira(cls, valor):
        return _data_opcional(valor)

    @model_validator(mode="after")
    def validar_datas(self):
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError(
                    "A data final não pode ser anterior à data inicial."
                )
        return self


class MedicationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    dosage: str | None = Field(default=None, min_length=1, max_length=100)
    instructions: str | None = None

    first_dose_at: datetime | None = None
    interval_hours: float | None = Field(default=None, gt=0, le=24)
    continuous: bool | None = None
    start_date: date | None = None
    end_date: date | None = None

    stock_quantity: float | None = Field(default=None, ge=0)
    stock_unit: str | None = Field(default=None, max_length=30)
    units_per_dose: float | None = Field(default=None, gt=0)
    minimum_stock: float | None = Field(default=None, ge=0)
    active: bool | None = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def aceitar_data_brasileira(cls, valor):
        return _data_opcional(valor)

    @model_validator(mode="after")
    def validar_datas(self):
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError(
                    "A data final não pode ser anterior à data inicial."
                )
        return self


class MedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    name: str
    dosage: str
    instructions: str | None
    first_dose_at: datetime | None
    interval_hours: float | None
    continuous: bool
    start_date: date | None
    end_date: date | None
    stock_quantity: float | None
    stock_unit: str | None
    units_per_dose: float | None
    minimum_stock: float | None = None
    active: bool
    created_at: datetime


class DoseCreate(BaseModel):
    scheduled_at: datetime = Field(
        description="Horário previsto da dose (ISO 8601, de preferência em UTC)."
    )


class DoseRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medication_id: int
    scheduled_at: datetime
    administered_at: datetime
    administered_by: int | None
    stock_deducted: float
    stock_unit: str | None


MovementType = Literal["entry", "administration", "reversal"]


class StockEntryCreate(BaseModel):
    quantity: float = Field(gt=0)
    description: str | None = Field(default=None, max_length=300)


class InventoryMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    medication_id: int
    medication_name: str = ""
    type: MovementType
    quantity: float
    unit: str
    description: str | None
    dose_record_id: int | None
    created_at: datetime


# ======================================================
# IMPORTAÇÃO DE DADOS LOCAIS ANTIGOS
# ======================================================


class LegacyMedicationImport(MedicationCreate):
    legacy_id: str = Field(min_length=1, max_length=100)
    active: bool = True


class LegacyDoseImport(BaseModel):
    legacy_id: str | None = Field(default=None, max_length=200)
    legacy_medication_id: str = Field(min_length=1, max_length=100)
    scheduled_at: datetime
    administered_at: datetime
    stock_deducted: float = Field(default=0, ge=0)
    stock_unit: str | None = Field(default=None, max_length=30)


class LegacyMovementImport(BaseModel):
    legacy_medication_id: str = Field(min_length=1, max_length=100)
    legacy_dose_id: str | None = Field(default=None, max_length=200)
    type: MovementType
    quantity: float = Field(ge=0)
    unit: str = Field(max_length=30)
    description: str | None = Field(default=None, max_length=300)
    created_at: datetime | None = None


class LegacyImportRequest(BaseModel):
    medications: list[LegacyMedicationImport] = Field(default_factory=list)
    doses: list[LegacyDoseImport] = Field(default_factory=list)
    movements: list[LegacyMovementImport] = Field(default_factory=list)


class LegacyImportResponse(BaseModel):
    medications: int
    doses: int
    movements: int
    skipped: int


# ======================================================
# DIÁRIO
# ======================================================


class DiaryEntryUpsert(BaseModel):
    observation: str = Field(default="", max_length=5000)
    photo_data: str | None = Field(
        default=None,
        description=(
            "Foto em data URL (`data:image/jpeg;base64,...`). "
            "Omitir mantém a foto atual; `null` remove a foto."
        ),
    )


class DiaryEntryResponse(BaseModel):
    id: int
    patient_id: int
    date: date
    observation: str
    photo_url: str | None
    created_by: int | None
    created_at: datetime
    updated_at: datetime | None


def _data_brasileira(valor):
    if isinstance(valor, str) and "/" in valor:
        return date.fromisoformat("-".join(reversed(valor.split("/"))))
    if valor == "":
        return None
    return valor


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    birth_date: date | None = None
    relationship: str | None = Field(default=None, max_length=60)
    notes: str | None = None

    @field_validator("birth_date", mode="before")
    @classmethod
    def aceitar_data_brasileira(cls, valor):
        return _data_brasileira(valor)


class PatientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    birth_date: date | None = None
    relationship: str | None = Field(default=None, max_length=60)
    notes: str | None = None

    @field_validator("birth_date", mode="before")
    @classmethod
    def aceitar_data_brasileira(cls, valor):
        return _data_brasileira(valor)


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    birth_date: date | None
    relationship: str | None = None
    notes: str | None
    active: bool


class PatientWithAccessResponse(PatientResponse):
    access_role: UserRole
