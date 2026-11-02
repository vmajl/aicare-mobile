
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';

const STORAGE_PREFIX = '@aicare:patient:';

export type Patient = {
  id: string;
  familyId: string;
  name: string;
  birthDate: string;
  relationship: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type PatientDraft = {
  name: string;
  birthDate: string;
  relationship: string;
  notes: string;
};

type PatientContextData = {
  patient: Patient | null;
  loading: boolean;
  savePatient: (data: PatientDraft) => Promise<Patient>;
  deletePatient: () => Promise<void>;
};

const PatientContext = createContext<PatientContextData | undefined>(
  undefined,
);

export function PatientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const familyId = user?.familyId;

  useEffect(() => {
    let active = true;

    async function loadPatient() {
      if (authLoading) return;

      setLoading(true);
      setPatient(null);

      if (!familyId) {
        if (active) setLoading(false);
        return;
      }

      try {
        const stored = await AsyncStorage.getItem(
          `${STORAGE_PREFIX}${familyId}`,
        );

        if (active) {
          setPatient(stored ? JSON.parse(stored) as Patient : null);
        }
      } catch (error) {
        console.error('Erro ao carregar paciente:', error);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPatient();

    return () => {
      active = false;
    };
  }, [familyId, authLoading]);

  const savePatient = useCallback(
    async (data: PatientDraft) => {
      if (!familyId) {
        throw new Error('Família não identificada.');
      }

      const now = new Date().toISOString();

      const updated: Patient = {
        id: patient?.id ?? `patient-${Date.now()}`,
        familyId,
        name: data.name.trim(),
        birthDate: data.birthDate.trim(),
        relationship: data.relationship.trim(),
        notes: data.notes.trim(),
        createdAt: patient?.createdAt ?? now,
        updatedAt: now,
      };

      await AsyncStorage.setItem(
        `${STORAGE_PREFIX}${familyId}`,
        JSON.stringify(updated),
      );

      setPatient(updated);
      return updated;
    },
    [familyId, patient],
  );

  const deletePatient = useCallback(async () => {
    if (!familyId) return;

    await AsyncStorage.removeItem(`${STORAGE_PREFIX}${familyId}`);
    setPatient(null);
  }, [familyId]);

  return (
    <PatientContext.Provider
      value={{ patient, loading: loading || authLoading, savePatient, deletePatient }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const context = useContext(PatientContext);

  if (!context) {
    throw new Error('usePatient deve ser utilizado dentro de PatientProvider.');
  }

  return context;
}
