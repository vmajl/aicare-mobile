
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from pydantic import field_validator


class MedicationCreate(BaseModel):
    patient_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=150)
    dosage: str = Field(min_length=1, max_length=100)
    instructions: str | None = None

    first_dose_at: datetime | None = None
    interval_hours: int | None = Field(default=None, gt=0)
    continuous: bool = False
    start_date: date | None = None
    end_date: date | None = None

    stock_quantity: int | None = Field(default=None, ge=0)
    stock_unit: str | None = Field(default=None, max_length=30)
    units_per_dose: int | None = Field(default=None, gt=0)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def aceitar_data_brasileira(cls, valor):
        if isinstance(valor, str) and "/" in valor:
            return date.fromisoformat(
                "-".join(reversed(valor.split("/")))
            )
        return valor
    
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
    interval_hours: int | None = Field(default=None, gt=0)
    continuous: bool | None = None
    start_date: date | None = None
    end_date: date | None = None

    stock_quantity: int | None = Field(default=None, ge=0)
    stock_unit: str | None = Field(default=None, max_length=30)
    units_per_dose: int | None = Field(default=None, gt=0)
    active: bool | None = None

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def aceitar_data_brasileira(cls, valor):
        if isinstance(valor, str) and "/" in valor:
            return date.fromisoformat(
                "-".join(reversed(valor.split("/")))
            )
        return valor

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
    interval_hours: int | None
    continuous: bool
    start_date: date | None
    end_date: date | None
    stock_quantity: int | None
    stock_unit: str | None
    units_per_dose: int | None
    active: bool
    created_at: datetime


class PatientCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    birth_date: date | None = None
    notes: str | None = None


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    birth_date: date | None
    notes: str | None
    active: bool
