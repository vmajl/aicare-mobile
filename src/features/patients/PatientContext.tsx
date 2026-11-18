
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth, type UserRole } from '../auth/AuthContext';
import { apiRequest } from '../../services/apiClient';

export type Patient = {
  /** Id do paciente na API. */
  id: string;
  familyId: string;
  name: string;
  /** DD/MM/AAAA ou vazio. */
  birthDate: string;
  relationship: string;
  notes: string;
  /** Perfil do usuário conectado em relação a este paciente. */
  accessRole: UserRole;
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
  /** Indica se o usuário conectado pode cadastrar/editar o paciente. */
  canEdit: boolean;
  savePatient: (data: PatientDraft) => Promise<Patient>;
  deletePatient: () => Promise<void>;
  refreshPatient: () => Promise<void>;
};

type ApiPatient = {
  id: number;
  name: string;
  birth_date: string | null;
  relationship: string | null;
  notes: string | null;
  active: boolean;
  access_role?: UserRole;
};

const PatientContext = createContext<PatientContextData | undefined>(
  undefined,
);

// AAAA-MM-DD (API) -> DD/MM/AAAA (app)
const fromApiDate = (value: string | null) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export function PatientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;
  const familyId = user?.familyId;
  const isFamilyAdmin = user?.role === 'family_admin';

  const toPatient = useCallback(
    (data: ApiPatient, fallbackRole: UserRole): Patient => ({
      id: String(data.id),
      familyId: familyId ?? '',
      name: data.name,
      birthDate: fromApiDate(data.birth_date),
      relationship: data.relationship ?? '',
      notes: data.notes ?? '',
      accessRole: data.access_role ?? fallbackRole,
    }),
    [familyId],
  );

  const refreshPatient = useCallback(async () => {
    if (!userId) {
      setPatient(null);
      return;
    }

    const patients = await apiRequest<ApiPatient[]>('/patients');

    // Prioriza o paciente que o usuário administra.
    const selected =
      patients.find((item) => item.access_role === 'family_admin') ??
      patients[0];

    setPatient(selected ? toPatient(selected, 'caregiver') : null);
  }, [userId, toPatient]);

  useEffect(() => {
    let active = true;

    async function loadPatient() {
      if (authLoading) return;

      setLoading(true);
      setPatient(null);

      try {
        await refreshPatient();
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
  }, [authLoading, refreshPatient]);

  const canEdit =
    isFamilyAdmin && (!patient || patient.accessRole === 'family_admin');

  const savePatient = useCallback(
    async (data: PatientDraft) => {
      if (!userId) {
        throw new Error('Entre novamente no aplicativo.');
      }

      if (!canEdit) {
        throw new Error(
          'Somente o familiar administrador pode cadastrar ou editar o paciente.',
        );
      }

      const body = {
        name: data.name.trim(),
        // A API aceita DD/MM/AAAA.
        birth_date: data.birthDate.trim() || null,
        relationship: data.relationship.trim() || null,
        notes: data.notes.trim() || null,
      };

      const saved = patient
        ? await apiRequest<ApiPatient>(`/patients/${patient.id}`, {
            method: 'PUT',
            body,
          })
        : await apiRequest<ApiPatient>('/patients', {
            method: 'POST',
            body,
          });

      const updated = toPatient(saved, 'family_admin');
      setPatient(updated);
      return updated;
    },
    [userId, canEdit, patient, toPatient],
  );

  const deletePatient = useCallback(async () => {
    if (!patient) return;

    await apiRequest<void>(`/patients/${patient.id}`, {
      method: 'DELETE',
    });
    setPatient(null);
  }, [patient]);

  return (
    <PatientContext.Provider
      value={{
        patient,
        loading: loading || authLoading,
        canEdit,
        savePatient,
        deletePatient,
        refreshPatient,
      }}
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
