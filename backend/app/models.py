
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


# Perfis de acesso (usados em User.role, PatientAccess.role e Invitation.role).
ROLE_FAMILY_ADMIN = "family_admin"
ROLE_FAMILY = "family"
ROLE_CAREGIVER = "caregiver"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    relationship: Mapped[str | None] = mapped_column(String(60), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class PatientAccess(Base):
    __tablename__ = "patient_access"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False)


class Invitation(Base):
    """Convite emitido por um familiar administrador.

    O token JWT entregue ao convidado carrega o `jti` deste registro,
    o que permite marcar o convite como utilizado ou revogá-lo.
    """

    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    jti: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invited_by: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    accepted_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    dosage: Mapped[str] = mapped_column(String(100), nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Data/hora local da primeira dose (o app usa apenas o horário HH:MM).
    first_dose_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    interval_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    continuous: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Quantidades fracionadas são permitidas (ex.: meio comprimido).
    stock_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    stock_unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    units_per_dose: Mapped[float | None] = mapped_column(Float, nullable=True)
    minimum_stock: Mapped[float | None] = mapped_column(Float, nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class DoseRecord(Base):
    """Registro de uma dose administrada."""

    __tablename__ = "dose_records"
    __table_args__ = (
        UniqueConstraint("medication_id", "scheduled_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    medication_id: Mapped[int] = mapped_column(
        ForeignKey("medications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Datas em UTC (sem fuso).
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    administered_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False
    )
    administered_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    stock_deducted: Mapped[float] = mapped_column(
        Float, default=0, nullable=False
    )
    stock_unit: Mapped[str | None] = mapped_column(String(30), nullable=True)


class InventoryMovement(Base):
    """Entrada ou saída de estoque de um medicamento."""

    __tablename__ = "inventory_movements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    medication_id: Mapped[int] = mapped_column(
        ForeignKey("medications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # entry | administration | reversal
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Sem chave estrangeira: o registro da dose pode ser desfeito.
    dose_record_id: Mapped[int | None] = mapped_column(nullable=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )


class DiaryEntry(Base):
    """Publicação diária (comentário e/ou foto) sobre o paciente."""

    __tablename__ = "diary_entries"
    __table_args__ = (UniqueConstraint("patient_id", "entry_date"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    observation: Mapped[str] = mapped_column(Text, default="", nullable=False)

    photo: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    photo_mime: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Chave aleatória usada na URL pública da foto (muda a cada nova foto).
    photo_key: Mapped[str | None] = mapped_column(
        String(64), unique=True, index=True, nullable=True
    )

    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
