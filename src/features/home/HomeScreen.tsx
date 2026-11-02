
import { Alert, View, Text, Pressable, StyleSheet } from 'react-native';
import { Camera, Clock, Pill, Plus, Check, RotateCcw } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useMedications } from '../medications/MedicationContext';
import { usePatient } from '../patients/PatientContext';

const BLUE = '#50A9C3';
const DARK = '#102F40';
const MUTED = '#6D8794';
const BORDER = '#D8E3E8';

export default function HomeScreen() {
  const router = useRouter();

  const {
    medicines,
    loading,
    getDosesForDate,
    administerDose,
    undoDose,
  } = useMedications();

  const { patient, loading: patientLoading } = usePatient();

  const activeMedicines = medicines.filter(
    (medicine) => medicine.active,
  );

  const doses = getDosesForDate();

  const administeredCount = doses.filter(
    (dose) => dose.status === 'administered',
  ).length;

  const pendingCount = doses.filter(
    (dose) => dose.status === 'pending' || dose.status === 'delayed',
  ).length;

  function goToMedicines() {
    router.push('/(tabs)/medicamentos');
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function handleAdminister(doseId: string) {
    try {
      await administerDose(doseId);
    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível registrar a administração. Tente novamente.',
      );
    }
  }

  async function handleUndo(doseId: string) {
    try {
      await undoDose(doseId);
    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível desfazer o registro. Tente novamente.',
      );
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case 'administered':
        return 'Administrado';
      case 'delayed':
        return 'Atrasado';
      default:
        return 'Aguardando horário';
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.pageHeading}>
        <Text style={styles.pageKicker}>
          Acompanhamento AICare
        </Text>

        <Text style={styles.pageTitle}>
          {patientLoading
            ? 'Carregando paciente...'
            : patient
              ? `Hoje · ${patient.name}`
              : 'Nenhum paciente cadastrado'}
        </Text>
      </View>

      {!patientLoading && !patient && (
        <Pressable
          onPress={() => router.push('/cadastro-paciente')}
          style={styles.registerPatientButton}
        >
          <Plus size={18} color={DARK} />
          <Text style={styles.registerPatientText}>
            Cadastrar paciente
          </Text>
        </Pressable>
      )}

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {medicines.length}
          </Text>
          <Text style={styles.summaryLabel}>
            Cadastrados
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {activeMedicines.length}
          </Text>
          <Text style={styles.summaryLabel}>
            Ativos
          </Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>
            {administeredCount}
          </Text>
          <Text style={styles.summaryLabel}>
            Administrados
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Camera size={21} color={BLUE} />

          <View style={styles.photoText}>
            <Text style={styles.cardTitle}>
              Registro de hoje
            </Text>

            <Text style={styles.description}>
              {patient
                ? `Adicione uma foto de ${patient.name} ao diário compartilhado.`
                : 'Cadastre um paciente para começar o acompanhamento.'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() =>
            Alert.alert(
              'Registro de foto',
              'A seleção de fotos será implementada em uma próxima etapa.',
            )
          }
          style={styles.photoButton}
        >
          <Camera size={18} color="#FFFFFF" />

          <Text style={styles.photoButtonText}>
            Registrar foto
          </Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>
          Medicamentos de hoje
        </Text>

        <Text style={styles.description}>
          Acompanhe cada dose e registre sua administração.
        </Text>
      </View>

      {loading ? (
        <View style={styles.card}>
          <Text style={styles.description}>
            Carregando medicamentos...
          </Text>
        </View>
      ) : doses.length === 0 ? (
        <View style={styles.card}>
          <Pill size={28} color={BLUE} />

          <Text style={styles.cardTitle}>
            Nenhuma dose programada
          </Text>

          <Text style={styles.description}>
            Cadastre ou ative um medicamento para visualizar os horários.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.dailyProgress}>
            <Text style={styles.progressText}>
              {administeredCount} de {doses.length} doses administradas
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      doses.length > 0
                        ? (administeredCount / doses.length) * 100
                        : 0
                    }%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.description}>
              {pendingCount} doses aguardando ou atrasadas.
            </Text>
          </View>

          {doses
            .slice()
            .sort(
              (a, b) =>
                new Date(a.scheduledAt).getTime() -
                new Date(b.scheduledAt).getTime(),
            )
            .map((dose) => {
              const isAdministered = dose.status === 'administered';
              const isFuture =
                new Date(dose.scheduledAt).getTime() > Date.now();

              return (
                <View key={dose.id} style={styles.card}>
                  <View style={styles.medicineHeader}>
                    <View style={styles.medicineIcon}>
                      <Pill size={20} color={BLUE} />
                    </View>

                    <View style={styles.medicineInfo}>
                      <Text style={styles.cardTitle}>
                        {dose.medicine.name}
                      </Text>

                      <Text style={styles.description}>
                        {dose.medicine.dosage}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isAdministered
                          ? styles.doneBadge
                          : dose.status === 'delayed'
                            ? styles.delayedBadge
                            : styles.pendingBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          isAdministered
                            ? styles.doneText
                            : dose.status === 'delayed'
                              ? styles.delayedText
                              : styles.pendingText,
                        ]}
                      >
                        {getStatusLabel(dose.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.schedule}>
                    <Clock size={16} color={MUTED} />

                    <View style={styles.scheduleInfo}>
                      <Text style={styles.scheduleTitle}>
                        Horário programado
                      </Text>

                      <Text style={styles.description}>
                        {formatTime(dose.scheduledAt)}
                      </Text>
                    </View>
                  </View>

                  {!!dose.medicine.instructions && (
                    <Text style={styles.description}>
                      Instruções: {dose.medicine.instructions}
                    </Text>
                  )}

                  {isAdministered ? (
                    <Pressable
                      style={styles.undoButton}
                      onPress={() => {
                        void handleUndo(dose.id);
                      }}
                    >
                      <RotateCcw size={16} color={DARK} />

                      <Text style={styles.undoButtonText}>
                        Desfazer administração
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[
                        styles.administerButton,
                        isFuture && styles.disabledButton,
                      ]}
                      disabled={isFuture}
                      onPress={() => {
                        void handleAdminister(dose.id);
                      }}
                    >
                      <Check size={17} color="#FFFFFF" />

                      <Text style={styles.administerButtonText}>
                        Marcar como administrada
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
        </>
      )}

      <Pressable
        style={styles.newMedicineButton}
        onPress={goToMedicines}
      >
        <Plus size={18} color={DARK} />

        <Text style={styles.newMedicineText}>
          Novo medicamento
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  pageHeading: {
    gap: 4,
  },
  pageKicker: {
    color: DARK,
    fontSize: 12,
  },
  pageTitle: {
    color: '#0A293A',
    fontSize: 27,
    fontWeight: '800',
  },
  registerPatientButton: {
    backgroundColor: '#E8F6FA',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  registerPatientText: {
    color: DARK,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  summaryNumber: {
    color: DARK,
    fontSize: 21,
    fontWeight: '800',
  },
  summaryLabel: {
    color: MUTED,
    fontSize: 11,
  },
  summaryDivider: {
    width: 1,
    height: 35,
    backgroundColor: BORDER,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 8,
    padding: 17,
    gap: 12,
  },
  cardTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '800',
  },
  description: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  photoText: {
    flex: 1,
    gap: 3,
  },
  photoButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 5,
  },
  photoButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeading: {
    gap: 4,
  },
  sectionTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '800',
  },
  dailyProgress: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 9,
  },
  progressText: {
    color: DARK,
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E8F0F3',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: BLUE,
    borderRadius: 10,
  },
  medicineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  medicineIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#E8F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medicineInfo: {
    flex: 1,
    gap: 3,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  doneBadge: {
    backgroundColor: '#E5F5EC',
  },
  delayedBadge: {
    backgroundColor: '#FCE9E7',
  },
  pendingBadge: {
    backgroundColor: '#FFF3DF',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  doneText: {
    color: '#27845A',
  },
  delayedText: {
    color: '#B64C42',
  },
  pendingText: {
    color: '#94651B',
  },
  schedule: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  scheduleInfo: {
    flex: 1,
    gap: 3,
  },
  scheduleTitle: {
    color: DARK,
    fontSize: 12,
    fontWeight: '700',
  },
  administerButton: {
    minHeight: 43,
    backgroundColor: BLUE,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  administerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  undoButton: {
    minHeight: 43,
    backgroundColor: '#E8F6FA',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  undoButtonText: {
    color: DARK,
    fontSize: 12,
    fontWeight: '800',
  },
  newMedicineButton: {
    backgroundColor: '#E8F6FA',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  newMedicineText: {
    color: DARK,
    fontWeight: '800',
  },
});
