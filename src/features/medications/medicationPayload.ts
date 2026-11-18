import type { MedicineDraft } from '../../types/medication';

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/** Aceita AAAA-MM-DD ou DD/MM/AAAA. */
export function parseDate(value: string): Date | null {
  if (!value) return null;

  let year: number;
  let month: number;
  let day: number;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    [year, month, day] = value.split('-').map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    [day, month, year] = value.split('/').map(Number);
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Número digitado no app ("1,5") -> número ou null. */
export function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(',', '.');

  if (!normalized) return null;

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

/** DD/MM/AAAA ou AAAA-MM-DD (app) -> AAAA-MM-DD (API). */
export function toApiDate(value: string) {
  const date = parseDate(value.trim());
  return date ? dateKey(date) : null;
}

/** Formulário de medicamento (app) -> corpo esperado pela API. */
export function toApiPayload(draft: MedicineDraft) {
  const startDate = toApiDate(draft.startDate);
  const firstTime = draft.firstTime.trim();

  return {
    name: draft.name.trim(),
    dosage: draft.dosage.trim(),
    instructions: draft.instructions.trim() || null,
    first_dose_at:
      startDate && /^\d{2}:\d{2}$/.test(firstTime)
        ? `${startDate}T${firstTime}:00`
        : null,
    interval_hours: parseNumber(draft.intervalHours),
    continuous: draft.continuous,
    start_date: startDate,
    end_date: draft.continuous ? null : toApiDate(draft.endDate),
    stock_quantity: parseNumber(draft.stockQuantity),
    stock_unit: draft.stockUnit.trim() || null,
    units_per_dose: parseNumber(draft.unitsPerDose),
    minimum_stock: parseNumber(draft.minimumStock),
  };
}
