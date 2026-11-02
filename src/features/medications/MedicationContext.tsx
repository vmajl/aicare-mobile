
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';

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

// ======================================================
// ARMAZENAMENTO POR FAMÍLIA
// ======================================================

const LEGACY_FAMILY_ID = 'aicare-legacy-family';

const LEGACY_STORAGE_KEYS = {
  medicines: '@aicare:medicines',
  doses: '@aicare:dose-records',
  movements: '@aicare:inventory-movements',
};

function getFamilyStorageKeys(familyId: string) {
  return {
    medicines: `@aicare:medicines:${familyId}`,
    doses: `@aicare:dose-records:${familyId}`,
    movements: `@aicare:inventory-movements:${familyId}`,
  };
}

// ======================================================
// CONTEXTO
// ======================================================

const MedicationContext = createContext<
  MedicationContextData | undefined
>(undefined);

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date | null {
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

function parseStockValue(value: string): number | null {
  const normalized = value.trim().replace(',', '.');

  if (!normalized) return null;

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function createMovement(
  data: Omit<InventoryMovement, 'id' | 'date'>,
): InventoryMovement {
  return {
    ...data,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    date: new Date().toISOString(),
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
  const { user, loading: authLoading } = useAuth();

  const familyId = user?.familyId ?? null;

  const storageKeys = familyId
    ? getFamilyStorageKeys(familyId)
    : null;

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [doseRecords, setDoseRecords] = useState<DoseRecord[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<
    InventoryMovement[]
  >([]);

  const [loading, setLoading] = useState(true);

  const requestId = useRef(0);

  // ----------------------------------------------------
  // CARREGAR DADOS DO ACOMPANHAMENTO
  // ----------------------------------------------------

  const refreshMedicines = useCallback(async () => {
    if (authLoading) return;

    const currentRequest = ++requestId.current;

    if (!familyId || !storageKeys) {
      setMedicines([]);
      setDoseRecords([]);
      setInventoryMovements([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        storedMedicines,
        storedDoses,
        storedMovements,
      ] = await Promise.all([
        AsyncStorage.getItem(storageKeys.medicines),
        AsyncStorage.getItem(storageKeys.doses),
        AsyncStorage.getItem(storageKeys.movements),
      ]);

      let medicinesData = storedMedicines;
      let dosesData = storedDoses;
      let movementsData = storedMovements;

      // Migração dos dados antigos da Maria.
      // Somente a família legada pode receber esses dados.
      if (familyId === LEGACY_FAMILY_ID) {
        if (medicinesData === null) {
          medicinesData = await AsyncStorage.getItem(
            LEGACY_STORAGE_KEYS.medicines,
          );
        }

        if (dosesData === null) {
          dosesData = await AsyncStorage.getItem(
            LEGACY_STORAGE_KEYS.doses,
          );
        }

        if (movementsData === null) {
          movementsData = await AsyncStorage.getItem(
            LEGACY_STORAGE_KEYS.movements,
          );
        }
      }

      const parsedMedicines: Medicine[] = medicinesData
        ? JSON.parse(medicinesData)
        : [];

      const normalizedMedicines = parsedMedicines.map((medicine) => ({
        ...medicine,
        minimumStock: medicine.minimumStock ?? '5',
      }));

      const parsedDoses: DoseRecord[] = dosesData
        ? JSON.parse(dosesData)
        : [];

      const parsedMovements: InventoryMovement[] = movementsData
        ? JSON.parse(movementsData)
        : [];

      // Impede que uma consulta antiga sobrescreva os dados
      // quando o usuário troca de acompanhamento durante o carregamento.
      if (currentRequest !== requestId.current) return;

      await Promise.all([
        AsyncStorage.setItem(
          storageKeys.medicines,
          JSON.stringify(normalizedMedicines),
        ),
        AsyncStorage.setItem(
          storageKeys.doses,
          JSON.stringify(parsedDoses),
        ),
        AsyncStorage.setItem(
          storageKeys.movements,
          JSON.stringify(parsedMovements),
        ),
      ]);

      if (currentRequest !== requestId.current) return;

      setMedicines(normalizedMedicines);
      setDoseRecords(parsedDoses);
      setInventoryMovements(parsedMovements);
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
  }, [authLoading, familyId]);

  // ----------------------------------------------------
  // ATUALIZAÇÃO AO TROCAR DE CONTA
  // ----------------------------------------------------

  useEffect(() => {
    if (authLoading) return;

    void refreshMedicines();

    return () => {
      requestId.current += 1;
    };
  }, [authLoading, familyId, refreshMedicines]);

  // ----------------------------------------------------
  // SALVAR DADOS
  // ----------------------------------------------------

  const saveMedicines = async (updatedMedicines: Medicine[]) => {
    if (!storageKeys || !familyId) {
      throw new Error('Nenhum acompanhamento está selecionado.');
    }

    await AsyncStorage.setItem(
      storageKeys.medicines,
      JSON.stringify(updatedMedicines),
    );

    setMedicines(updatedMedicines);
  };

  const saveDoseRecords = async (updatedRecords: DoseRecord[]) => {
    if (!storageKeys || !familyId) {
      throw new Error('Nenhum acompanhamento está selecionado.');
    }

    await AsyncStorage.setItem(
      storageKeys.doses,
      JSON.stringify(updatedRecords),
    );

    setDoseRecords(updatedRecords);
  };

  const saveInventoryMovements = async (
    updatedMovements: InventoryMovement[],
  ) => {
    if (!storageKeys || !familyId) {
      throw new Error('Nenhum acompanhamento está selecionado.');
    }

    await AsyncStorage.setItem(
      storageKeys.movements,
      JSON.stringify(updatedMovements),
    );

    setInventoryMovements(updatedMovements);
  };

  // ----------------------------------------------------
  // CADASTRAR MEDICAMENTO
  // ----------------------------------------------------

  const addMedicine = async (draft: MedicineDraft) => {
    const newMedicine: Medicine = {
      ...draft,
      id: Date.now().toString(),
      active: true,
      administered: false,
    };

    await saveMedicines([...medicines, newMedicine]);
  };

  // ----------------------------------------------------
  // EDITAR MEDICAMENTO
  // ----------------------------------------------------

  const updateMedicine = async (
    id: string,
    draft: MedicineDraft,
  ) => {
    const updatedMedicines = medicines.map((medicine) =>
      medicine.id === id
        ? { ...medicine, ...draft }
        : medicine,
    );

    await saveMedicines(updatedMedicines);
  };

  // ----------------------------------------------------
  // EXCLUIR MEDICAMENTO
  // ----------------------------------------------------

  const deleteMedicine = async (id: string) => {
    if (!storageKeys || !familyId) {
      throw new Error('Nenhum acompanhamento está selecionado.');
    }

    const updatedMedicines = medicines.filter(
      (medicine) => medicine.id !== id,
    );

    const updatedRecords = doseRecords.filter(
      (record) => record.medicineId !== id,
    );

    const updatedMovements = inventoryMovements.filter(
      (movement) => movement.medicineId !== id,
    );

    await AsyncStorage.multiSet([
      [storageKeys.medicines, JSON.stringify(updatedMedicines)],
      [storageKeys.doses, JSON.stringify(updatedRecords)],
      [storageKeys.movements, JSON.stringify(updatedMovements)],
    ]);

    setMedicines(updatedMedicines);
    setDoseRecords(updatedRecords);
    setInventoryMovements(updatedMovements);
  };

  // ----------------------------------------------------
  // ATIVAR / DESATIVAR MEDICAMENTO
  // ----------------------------------------------------

  const toggleMedicine = async (id: string) => {
    const updatedMedicines = medicines.map((medicine) =>
      medicine.id === id
        ? { ...medicine, active: !medicine.active }
        : medicine,
    );

    await saveMedicines(updatedMedicines);
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
          const id = `${medicine.id}_${scheduledAt}`;

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
  // ADMINISTRAR DOSE
  // ----------------------------------------------------

  const administerDose = async (doseId: string) => {
    if (!storageKeys || !familyId) {
      throw new Error('Nenhum acompanhamento está selecionado.');
    }

    const dose = getDosesForDate().find(
      (item) => item.id === doseId,
    );

    if (!dose) {
      throw new Error('Dose não encontrada para a data atual.');
    }

    if (doseRecords.some((record) => record.id === doseId)) {
      return;
    }

    const medicine = medicines.find(
      (item) => item.id === dose.medicine.id,
    );

    if (!medicine) {
      throw new Error('Medicamento não encontrado.');
    }

    const stock = parseStockValue(medicine.stockQuantity);
    const consumption = parseStockValue(medicine.unitsPerDose);

    let stockDeducted = 0;
    let stockUnit: string | undefined;

    const hasStockConfiguration =
      medicine.stockQuantity.trim() !== '' &&
      medicine.unitsPerDose.trim() !== '' &&
      medicine.stockUnit.trim() !== '';

    if (hasStockConfiguration) {
      if (stock === null || consumption === null || consumption <= 0) {
        throw new Error(
          'Confira a quantidade em estoque e o consumo por dose antes de administrar.',
        );
      }

      if (stock < consumption) {
        throw new Error(
          `Estoque insuficiente de ${medicine.name}. Disponível: ${stock} ${medicine.stockUnit}. Necessário: ${consumption} ${medicine.stockUnit}.`,
        );
      }

      stockDeducted = consumption;
      stockUnit = medicine.stockUnit;
    }

    const newRecord: DoseRecord = {
      id: doseId,
      medicineId: medicine.id,
      scheduledAt: dose.scheduledAt,
      administeredAt: new Date().toISOString(),
      stockDeducted,
      stockUnit,
    };

    const updatedMedicines = medicines.map((item) =>
      item.id === medicine.id
        ? {
            ...item,
            stockQuantity:
              stockDeducted > 0
                ? String(Number((stock! - stockDeducted).toFixed(4)))
                : item.stockQuantity,
          }
        : item,
    );

    let updatedMovements = inventoryMovements;

    if (stockDeducted > 0 && stockUnit) {
      updatedMovements = [
        ...inventoryMovements,
        createMovement({
          medicineId: medicine.id,
          medicineName: medicine.name,
          type: 'administration',
          quantity: stockDeducted,
          unit: stockUnit,
          description: 'Saída por administração de dose',
          doseRecordId: doseId,
        }),
      ];
    }

    const updatedRecords = [...doseRecords, newRecord];

    await AsyncStorage.multiSet([
      [storageKeys.medicines, JSON.stringify(updatedMedicines)],
      [storageKeys.doses, JSON.stringify(updatedRecords)],
      [storageKeys.movements, JSON.stringify(updatedMovements)],
    ]);

    setMedicines(updatedMedicines);
    setDoseRecords(updatedRecords);
    setInventoryMovements(updatedMovements);
  };

  // ----------------------------------------------------
  // DESFAZER ADMINISTRAÇÃO
  // ----------------------------------------------------

  const undoDose = async (doseId: string) => {
    if (!storageKeys || !familyId) {
      throw new Error('Nenhum acompanhamento está selecionado.');
    }

    const record = doseRecords.find(
      (item) => item.id === doseId,
    );

    if (!record) return;

    const updatedMedicines = medicines.map((medicine) => {
      if (
        medicine.id !== record.medicineId ||
        !record.stockDeducted ||
        record.stockDeducted <= 0
      ) {
        return medicine;
      }

      const currentStock = parseStockValue(medicine.stockQuantity);

      if (currentStock === null) {
        return medicine;
      }

      return {
        ...medicine,
        stockQuantity: String(
          Number(
            (currentStock + record.stockDeducted).toFixed(4),
          ),
        ),
      };
    });

    let updatedMovements = inventoryMovements;

    if (record.stockDeducted && record.stockDeducted > 0) {
      const medicine = medicines.find(
        (item) => item.id === record.medicineId,
      );

      if (medicine) {
        updatedMovements = [
          ...inventoryMovements,
          createMovement({
            medicineId: medicine.id,
            medicineName: medicine.name,
            type: 'reversal',
            quantity: record.stockDeducted,
            unit: record.stockUnit ?? medicine.stockUnit,
            description: 'Estorno de administração',
            doseRecordId: doseId,
          }),
        ];
      }
    }

    const updatedRecords = doseRecords.filter(
      (item) => item.id !== doseId,
    );

    await AsyncStorage.multiSet([
      [storageKeys.medicines, JSON.stringify(updatedMedicines)],
      [storageKeys.doses, JSON.stringify(updatedRecords)],
      [storageKeys.movements, JSON.stringify(updatedMovements)],
    ]);

    setMedicines(updatedMedicines);
    setDoseRecords(updatedRecords);
    setInventoryMovements(updatedMovements);
  };

  // ----------------------------------------------------
  // REPOR ESTOQUE
  // ----------------------------------------------------

  const replenishStock = async (
    medicineId: string,
    quantity: number,
    description?: string,
  ) => {
    if (!storageKeys || !familyId) {
      throw new Error('Nenhum acompanhamento está selecionado.');
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Informe uma quantidade válida para reposição.');
    }

    const medicine = medicines.find(
      (item) => item.id === medicineId,
    );

    if (!medicine) {
      throw new Error('Medicamento não encontrado.');
    }

    if (!medicine.stockUnit.trim()) {
      throw new Error(
        'Cadastre a unidade de estoque antes de fazer a reposição.',
      );
    }

    const currentStock = parseStockValue(medicine.stockQuantity);

    if (currentStock === null) {
      throw new Error(
        'A quantidade atual do estoque não é válida.',
      );
    }

    const newStock = Number((currentStock + quantity).toFixed(4));

    const updatedMedicines = medicines.map((item) =>
      item.id === medicineId
        ? { ...item, stockQuantity: String(newStock) }
        : item,
    );

    const newMovement = createMovement({
      medicineId: medicine.id,
      medicineName: medicine.name,
      type: 'entry',
      quantity,
      unit: medicine.stockUnit,
      description: description?.trim() || 'Reposição de estoque',
    });

    const updatedMovements = [
      ...inventoryMovements,
      newMovement,
    ];

    await AsyncStorage.multiSet([
      [storageKeys.medicines, JSON.stringify(updatedMedicines)],
      [storageKeys.movements, JSON.stringify(updatedMovements)],
    ]);

    setMedicines(updatedMedicines);
    setInventoryMovements(updatedMovements);
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
        loading,
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
