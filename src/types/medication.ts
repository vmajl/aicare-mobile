export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  instructions: string;
  firstTime: string;
  intervalHours: string;
  continuous: boolean;
  startDate: string;
  endDate: string;
  stockQuantity: string;
  stockUnit: string;
  unitsPerDose: string;
  minimumStock: string;
  active: boolean;
  administered: boolean;
};

export type MedicineDraft = {
  name: string;
  dosage: string;
  instructions: string;
  firstTime: string;
  intervalHours: string;
  continuous: boolean;
  startDate: string;
  endDate: string;
  stockQuantity: string;
  stockUnit: string;
  unitsPerDose: string;
  minimumStock: string;
};

export type DoseRecord = {
  /** Medicamento + horário previsto (usado para casar com as doses do dia). */
  id: string;
  /** Id do registro na API. */
  apiId?: number;
  medicineId: string;
  scheduledAt: string;
  administeredAt: string;
  stockDeducted?: number;
  stockUnit?: string;
};

export type MedicineDose = {
  id: string;
  medicine: Medicine;
  scheduledAt: string;
  administeredAt: string | null;
  status: 'pending' | 'administered' | 'delayed';
};

export type InventoryMovement = {
  id: string;
  medicineId: string;
  medicineName: string;
  type: 'entry' | 'administration' | 'reversal';
  quantity: number;
  unit: string;
  date: string;
  description?: string;
  doseRecordId?: string;
};