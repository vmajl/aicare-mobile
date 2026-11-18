
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { usePatient } from '../patients/PatientContext';
import { useLegacyMigration } from '../migration/LegacyMigrationContext';
import { apiRequest, parseApiDate } from '../../services/apiClient';
import { dateKey, parseDate, toApiPayload } from './medicationPayload';

import type {
  Medicine,
  MedicineDraft,
  DoseRecord,
  MedicineDose,
  InventoryMovement,
} from '../../types/medication';

// ======================================================
// TIPOS
// ======================================================

type MedicationContextData = {
  medicines: Medicine[];
  doseRecords: DoseRecord[];
  inventoryMovements: InventoryMovement[];
  loading: boolean;
  refreshMedicines: () => Promise<void>;
  addMedicine: (draft: MedicineDraft) => Promise<void>;
  updateMedicine: (id: string, draft: MedicineDraft) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  toggleMedicine: (id: string) => Promise<void>;
  getDosesForDate: (date?: Date) => MedicineDose[];
  administerDose: (doseId: string) => Promise<void>;
  undoDose: (doseId: string) => Promise<void>;
  replenishStock: (
    medicineId: string,
    quantity: number,
    description?: string,
  ) => Promise<void>;
};

// Formatos devolvidos pela API (backend/app/schemas.py).

type ApiMedication = {
  id: number;
  patient_id: number;
  name: string;
  dosage: string;
  instructions: string | null;
  first_dose_at: string | null;
  interval_hours: number | null;
  continuous: boolean;
  start_date: string | null;
  end_date: string | null;
  stock_quantity: number | null;
  stock_unit: string | null;
  units_per_dose: number | null;
  minimum_stock: number | null;
  active: boolean;
  created_at: string;
};

type ApiDoseRecord = {
  id: number;
  medication_id: number;
  scheduled_at: string;
  administered_at: string;
  administered_by: number | null;
  stock_deducted: number;
  stock_unit: string | null;
};

type ApiMovement = {
  id: number;
  medication_id: number;
  medication_name: string;
  type: InventoryMovement['type'];
  quantity: number;
  unit: string;
  description: string | null;
  dose_record_id: number | null;
  created_at: string;
};

// ======================================================
// CONTEXTO
// ======================================================

const MedicationContext = createContext<
  MedicationContextData | undefined
>(undefined);

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function createLocalDateTime(date: Date, time: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);

  return result;
}

function isMedicineScheduledOnDate(
  medicine: Medicine,
  date: Date,
): boolean {
  const targetDate = dateKey(date);

  const startDate = parseDate(medicine.startDate);
  const endDate = parseDate(medicine.endDate);

  if (startDate && targetDate < dateKey(startDate)) {
    return false;
  }

  if (!medicine.continuous && endDate && targetDate > dateKey(endDate)) {
    return false;
  }

  return true;
}

const numberToText = (value: number | null) =>
  value === null || value === undefined ? '' : String(value);

/** AAAA-MM-DD (API) -> DD/MM/AAAA (app). */
function fromApiDate(value: string | null) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

/** Identificador da dose no app: medicamento + horário previsto (UTC). */
const doseKey = (medicineId: string | number, scheduledAt: string) =>
  `${medicineId}_${scheduledAt}`;

function toMedicine(data: ApiMedication): Medicine {
  return {
    id: String(data.id),
    name: data.name,
    dosage: data.dosage,
    instructions: data.instructions ?? '',
    // first_dose_at é a data/hora local da primeira dose: usa só HH:MM.
    firstTime: data.first_dose_at ? data.first_dose_at.slice(11, 16) : '',
    intervalHours: numberToText(data.interval_hours),
    continuous: data.continuous,
    startDate: fromApiDate(data.start_date),
    endDate: fromApiDate(data.end_date),
    stockQuantity: numberToText(data.stock_quantity),
    stockUnit: data.stock_unit ?? '',
    unitsPerDose: numberToText(data.units_per_dose),
    minimumStock: numberToText(data.minimum_stock ?? 5),
    active: data.active,
    administered: false,
  };
}

function toDoseRecord(data: ApiDoseRecord): DoseRecord {
  const scheduledAt = parseApiDate(data.scheduled_at).toISOString();

  return {
    id: doseKey(data.medication_id, scheduledAt),
    apiId: data.id,
    medicineId: String(data.medication_id),
    scheduledAt,
    administeredAt: parseApiDate(data.administered_at).toISOString(),
    stockDeducted: data.stock_deducted,
    stockUnit: data.stock_unit ?? undefined,
  };
}

function toMovement(data: ApiMovement): InventoryMovement {
  return {
    id: String(data.id),
    medicineId: String(data.medication_id),
    medicineName: data.medication_name,
    type: data.type,
    quantity: data.quantity,
    unit: data.unit,
    date: parseApiDate(data.created_at).toISOString(),
    description: data.description ?? undefined,
    doseRecordId:
      data.dose_record_id !== null ? String(data.dose_record_id) : undefined,
  };
}

// ======================================================
// PROVIDER
// ======================================================

export function MedicationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { patient, loading: patientLoading } = usePatient();
  const { version: legacyImportVersion } = useLegacyMigration();

  const patientId = patient?.id ?? null;

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [doseRecords, setDoseRecords] = useState<DoseRecord[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<
    InventoryMovement[]
  >([]);

  const [loading, setLoading] = useState(true);

  const requestId = useRef(0);

  const requirePatient = () => {
    if (!patientId) {
      throw new Error(
        'Cadastre o paciente acompanhado antes de gerenciar medicamentos.',
      );
    }
    return patientId;
  };

  // ----------------------------------------------------
  // CARREGAR DADOS DO PACIENTE
  // ----------------------------------------------------

  const refreshMedicines = useCallback(async () => {
    if (patientLoading) return;

    const currentRequest = ++requestId.current;

    if (!patientId) {
      setMedicines([]);
      setDoseRecords([]);
      setInventoryMovements([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [apiMedicines, apiDoses, apiMovements] = await Promise.all([
        apiRequest<ApiMedication[]>(`/patients/${patientId}/medications`),
        apiRequest<ApiDoseRecord[]>(`/patients/${patientId}/doses`),
        apiRequest<ApiMovement[]>(
          `/patients/${patientId}/inventory-movements`,
        ),
      ]);

      // Impede que uma consulta antiga sobrescreva os dados
      // quando o paciente muda durante o carregamento.
      if (currentRequest !== requestId.current) return;

      setMedicines(apiMedicines.map(toMedicine));
      setDoseRecords(apiDoses.map(toDoseRecord));
      setInventoryMovements(apiMovements.map(toMovement));
    } catch (error) {
      console.error('Erro ao carregar medicamentos:', error);

      if (currentRequest === requestId.current) {
        setMedicines([]);
        setDoseRecords([]);
        setInventoryMovements([]);
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, [patientLoading, patientId]);

  // ----------------------------------------------------
  // ATUALIZAÇÃO AO TROCAR DE CONTA / PACIENTE
  // ----------------------------------------------------

  useEffect(() => {
    if (patientLoading) return;

    void refreshMedicines();

    return () => {
      requestId.current += 1;
    };
    // legacyImportVersion: recarrega após importar dados antigos do aparelho.
  }, [patientLoading, patientId, legacyImportVersion, refreshMedicines]);

  // ----------------------------------------------------
  // CADASTRAR / EDITAR / EXCLUIR
  // ----------------------------------------------------

  const addMedicine = async (draft: MedicineDraft) => {
    const id = requirePatient();

    const created = await apiRequest<ApiMedication>(
      `/patients/${id}/medications`,
      { method: 'POST', body: toApiPayload(draft) },
    );

    setMedicines((current) => [...current, toMedicine(created)]);
  };

  const updateMedicine = async (id: string, draft: MedicineDraft) => {
    const updated = await apiRequest<ApiMedication>(`/medications/${id}`, {
      method: 'PUT',
      body: toApiPayload(draft),
    });

    setMedicines((current) =>
      current.map((medicine) =>
        medicine.id === id ? toMedicine(updated) : medicine,
      ),
    );
  };

  const deleteMedicine = async (id: string) => {
    await apiRequest<void>(`/medications/${id}`, { method: 'DELETE' });

    // A API também remove o histórico de doses e de estoque.
    setMedicines((current) => current.filter((item) => item.id !== id));
    setDoseRecords((current) =>
      current.filter((record) => record.medicineId !== id),
    );
    setInventoryMovements((current) =>
      current.filter((movement) => movement.medicineId !== id),
    );
  };

  const toggleMedicine = async (id: string) => {
    const medicine = medicines.find((item) => item.id === id);
    if (!medicine) return;

    const updated = await apiRequest<ApiMedication>(`/medications/${id}`, {
      method: 'PUT',
      body: { active: !medicine.active },
    });

    setMedicines((current) =>
      current.map((item) => (item.id === id ? toMedicine(updated) : item)),
    );
  };

  // ----------------------------------------------------
  // DOSES DO DIA
  // ----------------------------------------------------

  const getDosesForDate = (date: Date = new Date()): MedicineDose[] => {
    const doses: MedicineDose[] = [];
    const now = new Date();

    medicines
      .filter((medicine) => medicine.active)
      .filter((medicine) => isMedicineScheduledOnDate(medicine, date))
      .forEach((medicine) => {
        const interval = Number(medicine.intervalHours);

        if (
          !Number.isFinite(interval) ||
          interval <= 0 ||
          interval > 24
        ) {
          return;
        }

        const firstDose = createLocalDateTime(
          date,
          medicine.firstTime,
        );

        if (!firstDose) return;

        const intervalMinutes = interval * 60;

        for (
          let minutes = 0;
          minutes < 24 * 60;
          minutes += intervalMinutes
        ) {
          const scheduledDate = new Date(
            firstDose.getTime() + minutes * 60 * 1000,
          );

          if (dateKey(scheduledDate) !== dateKey(date)) {
            continue;
          }

          const scheduledAt = scheduledDate.toISOString();
          const id = doseKey(medicine.id, scheduledAt);

          const record = doseRecords.find(
            (item) => item.id === id,
          );

          let status: MedicineDose['status'] = 'pending';

          if (record) {
            status = 'administered';
          } else if (scheduledDate.getTime() < now.getTime()) {
            status = 'delayed';
          }

          doses.push({
            id,
            medicine,
            scheduledAt,
            administeredAt: record?.administeredAt ?? null,
            status,
          });
        }
      });

    return doses.sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() -
        new Date(b.scheduledAt).getTime(),
    );
  };

  // ----------------------------------------------------
  // ADMINISTRAR / DESFAZER DOSE
  // ----------------------------------------------------

  const administerDose = async (doseId: string) => {
    requirePatient();

    const dose = getDosesForDate().find(
      (item) => item.id === doseId,
    );

    if (!dose) {
      throw new Error('Dose não encontrada para a data atual.');
    }

    if (doseRecords.some((record) => record.id === doseId)) {
      return;
    }

    // A API registra a dose e dá baixa no estoque na mesma operação.
    await apiRequest<ApiDoseRecord>(
      `/medications/${dose.medicine.id}/doses`,
      { method: 'POST', body: { scheduled_at: dose.scheduledAt } },
    );

    await refreshMedicines();
  };

  const undoDose = async (doseId: string) => {
    const record = doseRecords.find(
      (item) => item.id === doseId,
    );

    if (!record?.apiId) return;

    await apiRequest<void>(`/doses/${record.apiId}`, {
      method: 'DELETE',
    });

    await refreshMedicines();
  };

  // ----------------------------------------------------
  // REPOR ESTOQUE
  // ----------------------------------------------------

  const replenishStock = async (
    medicineId: string,
    quantity: number,
    description?: string,
  ) => {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Informe uma quantidade válida para reposição.');
    }

    await apiRequest<ApiMovement>(
      `/medications/${medicineId}/stock-entries`,
      {
        method: 'POST',
        body: { quantity, description: description?.trim() || null },
      },
    );

    await refreshMedicines();
  };

  // ====================================================
  // VALOR DO CONTEXTO
  // ====================================================

  return (
    <MedicationContext.Provider
      value={{
        medicines,
        doseRecords,
        inventoryMovements,
        loading: loading || patientLoading,
        refreshMedicines,
        addMedicine,
        updateMedicine,
        deleteMedicine,
        toggleMedicine,
        getDosesForDate,
        administerDose,
        undoDose,
        replenishStock,
      }}
    >
      {children}
    </MedicationContext.Provider>
  );
}

// ======================================================
// HOOK
// ======================================================

export function useMedications() {
  const context = useContext(MedicationContext);

  if (!context) {
    throw new Error(
      'useMedications deve ser usado dentro de MedicationProvider.',
    );
  }

  return context;
}
