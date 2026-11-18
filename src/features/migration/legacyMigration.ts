/**
 * Migração dos dados que a versão anterior do app guardava apenas no
 * aparelho (AsyncStorage) para a API.
 *
 * - Os dados antigos são localizados pelo e-mail da conta local antiga.
 * - Cada conjunto é importado uma única vez (marcadores no AsyncStorage).
 * - Nada é apagado do aparelho.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, apiRequest } from '../../services/apiClient';
import { toApiPayload } from '../medications/medicationPayload';
import type { PatientDraft } from '../patients/PatientContext';
import type {
  DoseRecord,
  InventoryMovement,
  Medicine,
  MedicineDraft,
} from '../../types/medication';
import {
  listDiaryRecords,
  photoToDataUrl,
  saveDiaryRecord,
} from '../diary/diaryApi';

// Chaves usadas pela versão anterior do app.
const LEGACY_FAMILY_ID = 'aicare-legacy-family';
const LEGACY_USERS_KEY = '@aicare:demo-users';
const LEGACY_DIARY_KEY = '@aicare:diary-records';
const LEGACY_PATIENT_PREFIX = '@aicare:patient:';
const LEGACY_GLOBAL_KEYS = {
  medicines: '@aicare:medicines',
  doses: '@aicare:dose-records',
  movements: '@aicare:inventory-movements',
};

// Marcadores de importação já realizada.
const MARKER_PREFIX = '@aicare:legacy-import:';
const medicationsMarker = (familyId: string) =>
  `${MARKER_PREFIX}medications:${familyId}`;
const DIARY_MARKER = `${MARKER_PREFIX}diary`;

const MOVEMENT_TYPES: InventoryMovement['type'][] = [
  'entry',
  'administration',
  'reversal',
];

// ======================================================
// LEITURA DO ARMAZENAMENTO ANTIGO
// ======================================================

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function readList<T>(key: string): Promise<T[]> {
  const data = await readJson<unknown>(key);
  return Array.isArray(data) ? (data as T[]) : [];
}

async function markDone(key: string, details: Record<string, unknown>) {
  await AsyncStorage.setItem(
    key,
    JSON.stringify({ ...details, at: new Date().toISOString() }),
  );
}

async function isDone(key: string) {
  return (await AsyncStorage.getItem(key)) !== null;
}

/** Família local antiga da conta com o mesmo e-mail, se existir. */
export async function findLegacyFamilyId(
  email: string,
): Promise<string | null> {
  const users = await readList<{ email?: string; familyId?: string }>(
    LEGACY_USERS_KEY,
  );
  const normalized = email.trim().toLowerCase();

  const match = users.find(
    (item) => (item.email ?? '').trim().toLowerCase() === normalized,
  );

  if (!match) return null;
  return match.familyId || LEGACY_FAMILY_ID;
}

export async function readLegacyPatient(
  familyId: string,
): Promise<PatientDraft | null> {
  const data = await readJson<Partial<PatientDraft>>(
    `${LEGACY_PATIENT_PREFIX}${familyId}`,
  );

  if (!data?.name?.trim()) return null;

  return {
    name: data.name,
    birthDate: data.birthDate ?? '',
    relationship: data.relationship ?? '',
    notes: data.notes ?? '',
  };
}

async function readFamilyList<T>(
  familyId: string,
  kind: keyof typeof LEGACY_GLOBAL_KEYS,
): Promise<T[]> {
  const familyKey = `${LEGACY_GLOBAL_KEYS[kind]}:${familyId}`;
  const raw = await AsyncStorage.getItem(familyKey);

  // A família "legada" usava chaves sem sufixo antes da separação por família.
  if (raw === null && familyId === LEGACY_FAMILY_ID) {
    return readList<T>(LEGACY_GLOBAL_KEYS[kind]);
  }

  return readList<T>(familyKey);
}

// ======================================================
// MEDICAMENTOS, DOSES E ESTOQUE
// ======================================================

const text = (value: unknown) =>
  value === null || value === undefined ? '' : String(value);

function toLegacyMedicationPayload(medicine: Partial<Medicine>) {
  const draft: MedicineDraft = {
    name: text(medicine.name),
    dosage: text(medicine.dosage),
    instructions: text(medicine.instructions),
    firstTime: text(medicine.firstTime),
    intervalHours: text(medicine.intervalHours),
    continuous: Boolean(medicine.continuous),
    startDate: text(medicine.startDate),
    endDate: text(medicine.endDate),
    stockQuantity: text(medicine.stockQuantity),
    stockUnit: text(medicine.stockUnit),
    unitsPerDose: text(medicine.unitsPerDose),
    minimumStock: text(medicine.minimumStock ?? '5'),
  };

  const payload = toApiPayload(draft);

  // Ajusta valores que a API recusaria, para não perder o medicamento.
  const positive = (value: number | null) =>
    value !== null && value > 0 ? value : null;
  const nonNegative = (value: number | null) =>
    value !== null && value >= 0 ? value : null;

  return {
    ...payload,
    dosage: payload.dosage || '-',
    interval_hours:
      payload.interval_hours !== null &&
      payload.interval_hours > 0 &&
      payload.interval_hours <= 24
        ? payload.interval_hours
        : null,
    stock_quantity: nonNegative(payload.stock_quantity),
    units_per_dose: positive(payload.units_per_dose),
    minimum_stock: nonNegative(payload.minimum_stock),
    end_date:
      payload.end_date &&
      payload.start_date &&
      payload.end_date < payload.start_date
        ? null
        : payload.end_date,
    legacy_id: text(medicine.id),
    active: medicine.active !== false,
  };
}

const isValidDate = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime());

export type MedicationImportResult = {
  medications: number;
  doses: number;
  movements: number;
};

/** Importa os medicamentos da família antiga. Retorna null se não havia nada a fazer. */
export async function migrateLegacyMedications(
  familyId: string,
  patientId: string,
): Promise<MedicationImportResult | null> {
  const marker = medicationsMarker(familyId);
  if (await isDone(marker)) return null;

  const [medicines, doses, movements] = await Promise.all([
    readFamilyList<Partial<Medicine>>(familyId, 'medicines'),
    readFamilyList<Partial<DoseRecord>>(familyId, 'doses'),
    readFamilyList<Partial<InventoryMovement>>(familyId, 'movements'),
  ]);

  const validMedicines = medicines.filter(
    (item) => text(item.id) && text(item.name).trim(),
  );

  if (validMedicines.length === 0) {
    await markDone(marker, { patientId, medications: 0 });
    return null;
  }

  const body = {
    medications: validMedicines.map(toLegacyMedicationPayload),
    doses: doses
      .filter(
        (item) =>
          text(item.medicineId) &&
          isValidDate(item.scheduledAt),
      )
      .map((item) => ({
        legacy_id: text(item.id) || null,
        legacy_medication_id: text(item.medicineId),
        scheduled_at: item.scheduledAt,
        administered_at: isValidDate(item.administeredAt)
          ? item.administeredAt
          : item.scheduledAt,
        stock_deducted: Math.max(0, Number(item.stockDeducted) || 0),
        stock_unit: item.stockUnit || null,
      })),
    movements: movements
      .filter(
        (item) =>
          text(item.medicineId) &&
          MOVEMENT_TYPES.includes(item.type as InventoryMovement['type']),
      )
      .map((item) => ({
        legacy_medication_id: text(item.medicineId),
        legacy_dose_id: item.doseRecordId || null,
        type: item.type,
        quantity: Math.abs(Number(item.quantity) || 0),
        unit: text(item.unit).slice(0, 30),
        description: item.description?.slice(0, 300) || null,
        created_at: isValidDate(item.date) ? item.date : null,
      })),
  };

  const result = await apiRequest<MedicationImportResult & { skipped: number }>(
    `/patients/${patientId}/legacy-import`,
    { method: 'POST', body },
  );

  await markDone(marker, { patientId, ...result });

  return result;
}

// ======================================================
// DIÁRIO
// ======================================================

type LegacyDiaryRecord = {
  date?: string;
  imageUri?: string | null;
  observation?: string;
};

export type DiaryImportResult = {
  entries: number;
  photosNotFound: number;
};

/** Importa as publicações do diário salvas no aparelho. */
export async function migrateLegacyDiary(
  patientId: string,
): Promise<DiaryImportResult | null> {
  if (await isDone(DIARY_MARKER)) return null;

  const records = await readList<LegacyDiaryRecord>(LEGACY_DIARY_KEY);

  if (records.length === 0) {
    await markDone(DIARY_MARKER, { patientId, entries: 0 });
    return null;
  }

  // Não sobrescreve publicações que já existem na API.
  const existing = new Set(
    (await listDiaryRecords(patientId)).map((record) => record.date),
  );

  let entries = 0;
  let photosNotFound = 0;

  for (const record of records) {
    const date = record.date ?? '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || existing.has(date)) {
      continue;
    }

    const observation = (record.observation ?? '').trim();
    let photo: string | undefined;

    if (record.imageUri) {
      try {
        photo = await photoToDataUrl(record.imageUri);
      } catch {
        // Arquivo da foto não existe mais no aparelho.
        photosNotFound += 1;
      }
    }

    if (!observation && !photo) continue;

    try {
      await saveDiaryRecord(patientId, date, observation, photo);
      entries += 1;
    } catch (error) {
      // Falha de conexão/servidor: interrompe e tenta de novo depois
      // (as datas já importadas serão ignoradas na próxima tentativa).
      if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) {
        throw error;
      }
      // Publicação recusada pela API (ex.: foto grande demais): segue adiante.
      console.warn(`Publicação de ${date} não importada:`, error.message);
    }
  }

  await markDone(DIARY_MARKER, { patientId, entries });

  return { entries, photosNotFound };
}
