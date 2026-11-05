
import {
  useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../utils/platformAlert';
import { useRouter } from 'expo-router';
import { usePatient } from './PatientContext';

const BLUE = '#50A9C3';
const DARK = '#102F40';
const MUTED = '#6D8794';
const BORDER = '#D8E3E8';

export default function PatientFormScreen() {
  const router = useRouter();
  const { patient, savePatient } = usePatient();

  const [name, setName] = useState(patient?.name ?? '');
  const [birthDate, setBirthDate] = useState(patient?.birthDate ?? '');
  const [relationship, setRelationship] = useState(
    patient?.relationship ?? '',
  );
  const [notes, setNotes] = useState(patient?.notes ?? '');
  const [saving, setSaving] = useState(false);

  function formatBirthDate(value: string) {
    const numbers = value.replace(/\D/g, '').slice(0, 8);

    if (numbers.length <= 2) return numbers;

    if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    }

    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4)}`;
  }

  function isValidDate(value: string) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return false;
    }

    const [day, month, year] = value.split('/').map(Number);
    const date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      year >= 1900 &&
      date <= new Date()
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do paciente.');
      return;
    }

    if (birthDate && !isValidDate(birthDate)) {
      Alert.alert(
        'Data inválida',
        'Informe uma data válida no formato DD/MM/AAAA.',
      );
      return;
    }

    if (!relationship.trim()) {
      Alert.alert(
        'Campo obrigatório',
        'Informe o vínculo do paciente com o cuidador.',
      );
      return;
    }

    try {
      setSaving(true);

      await savePatient({
        name,
        birthDate,
        relationship,
        notes,
      });

      Alert.alert(
        'Cadastro salvo',
        'Os dados do paciente foram salvos para esta família.',
        [
          {
            text: 'Continuar',
            onPress: () => router.replace('/(tabs)'),
          },
        ],
      );
    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível salvar o cadastro. Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={styles.kicker}>AICare · Cadastro</Text>

          <Text style={styles.title}>
            {patient ? 'Editar paciente' : 'Quem será acompanhado?'}
          </Text>

          <Text style={styles.subtitle}>
            Informe os dados da pessoa que receberá os cuidados. Essas
            informações ficarão disponíveis aos integrantes da família.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nome completo *</Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nome do paciente"
            placeholderTextColor="#9AABB3"
            style={styles.input}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.label}>Data de nascimento</Text>

          <TextInput
            value={birthDate}
            onChangeText={(value) => setBirthDate(formatBirthDate(value))}
            placeholder="DD/MM/AAAA"
            placeholderTextColor="#9AABB3"
            style={styles.input}
            keyboardType="number-pad"
            maxLength={10}
          />

          <Text style={styles.label}>Vínculo com o cuidador *</Text>

          <TextInput
            value={relationship}
            onChangeText={setRelationship}
            placeholder="Ex.: mãe, pai, avó, cônjuge..."
            placeholderTextColor="#9AABB3"
            style={styles.input}
            autoCapitalize="sentences"
          />

          <Text style={styles.label}>Observações importantes</Text>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Informações relevantes sobre o paciente..."
            placeholderTextColor="#9AABB3"
            style={[styles.input, styles.textArea]}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.requiredNote}>
            * Campos obrigatórios
          </Text>
        </View>

        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          style={[styles.saveButton, saving && styles.disabledButton]}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Salvando...' : 'Salvar cadastro'}
          </Text>
        </Pressable>

        {patient && (
          <Pressable
            onPress={() => router.back()}
            style={styles.cancelButton}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4FAFC',
  },
  content: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
    gap: 22,
  },
  heading: {
    gap: 9,
  },
  kicker: {
    color: BLUE,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: DARK,
    fontSize: 27,
    fontWeight: '800',
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 18,
    gap: 10,
  },
  label: {
    color: DARK,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 105,
    paddingTop: 12,
  },
  requiredNote: {
    color: MUTED,
    fontSize: 11,
    marginTop: 5,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 9,
    backgroundColor: BLUE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: 'center',
    
    alignItems: 'center',
  },
  cancelButtonText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '700',
  },
});
