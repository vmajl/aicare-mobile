import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../auth/AuthContext';
import { usePatient } from '../patients/PatientContext';
import { Alert } from '../../utils/platformAlert';
import {
  findLegacyFamilyId,
  migrateLegacyDiary,
  migrateLegacyMedications,
  readLegacyPatient,
} from './legacyMigration';

type LegacyMigrationData = {
  /** Incrementado quando dados antigos são importados (telas devem recarregar). */
  version: number;
  running: boolean;
};

const LegacyMigrationContext = createContext<LegacyMigrationData>({
  version: 0,
  running: false,
});

const plural = (count: number, singular: string, pluralText: string) =>
  `${count} ${count === 1 ? singular : pluralText}`;

/**
 * Importa para a API, uma única vez, os dados que a versão anterior do app
 * guardava somente neste aparelho. Executa apenas para o familiar
 * administrador cuja conta local antiga tinha o mesmo e-mail.
 */
export function LegacyMigrationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { patient, loading: patientLoading, savePatient } = usePatient();

  const [version, setVersion] = useState(0);
  const [running, setRunning] = useState(false);

  // Evita execuções repetidas para o mesmo usuário nesta sessão.
  const attemptedFor = useRef<string | null>(null);

  useEffect(() => {
    if (patientLoading || !user || user.role !== 'family_admin') return;
    if (patient && patient.accessRole !== 'family_admin') return;
    if (attemptedFor.current === user.id) return;

    attemptedFor.current = user.id;

    const run = async () => {
      const familyId = await findLegacyFamilyId(user.email);
      if (!familyId) return;

      setRunning(true);

      try {
        let patientId = patient?.id ?? null;
        let patientCreated = false;

        if (!patientId) {
          const legacyPatient = await readLegacyPatient(familyId);
          if (!legacyPatient) return;

          patientId = (await savePatient(legacyPatient)).id;
          patientCreated = true;
        }

        const medications = await migrateLegacyMedications(
          familyId,
          patientId,
        );
        const diary = await migrateLegacyDiary(patientId);

        const parts: string[] = [];
        if (patientCreated) parts.push('o cadastro do paciente');
        if (medications?.medications) {
          parts.push(
            plural(medications.medications, 'medicamento', 'medicamentos'),
          );
        }
        if (medications?.doses) {
          parts.push(
            plural(medications.doses, 'dose registrada', 'doses registradas'),
          );
        }
        if (diary?.entries) {
          parts.push(
            plural(
              diary.entries,
              'publicação do diário',
              'publicações do diário',
            ),
          );
        }

        if (parts.length > 0) {
          setVersion((current) => current + 1);

          const photoWarning = diary?.photosNotFound
            ? `\n\n${plural(diary.photosNotFound, 'foto não foi encontrada', 'fotos não foram encontradas')} no aparelho e não ${diary.photosNotFound === 1 ? 'foi importada' : 'foram importadas'}.`
            : '';

          Alert.alert(
            'Dados importados',
            `Os dados salvos neste aparelho pela versão anterior do AICare foram enviados para a sua conta: ${parts.join(', ')}.${photoWarning}`,
          );
        }
      } catch (error) {
        // Tenta novamente na próxima vez que o app for aberto.
        attemptedFor.current = null;
        console.warn('Não foi possível importar os dados locais antigos:', error);
      } finally {
        setRunning(false);
      }
    };

    void run();
  }, [patientLoading, user, patient, savePatient]);

  return (
    <LegacyMigrationContext.Provider value={{ version, running }}>
      {children}
    </LegacyMigrationContext.Provider>
  );
}

export function useLegacyMigration() {
  return useContext(LegacyMigrationContext);
}
