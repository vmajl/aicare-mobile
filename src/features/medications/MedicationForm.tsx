
import {
  useEffect,
  useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../utils/platformAlert';

import type { Medicine, MedicineDraft } from '../../types/medication';

type Props = {
  initialData?: Medicine | null;
  onSave: (draft: MedicineDraft) => Promise<void>;
  onCancel: () => void;
};

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
};

const COLORS = {
  blue: '#50A9C3',
  dark: '#102F40',
  muted: '#6D8794',
  border: '#D8E3E8',
  background: '#F4FAFC',
};

const emptyDraft: MedicineDraft = {
  name: '',
  dosage: '',
  instructions: '',
  firstTime: '08:00',
  intervalHours: '24',
  continuous: false,
  startDate: '',
  endDate: '',
  stockQuantity: '',
  stockUnit: 'comprimidos',
  unitsPerDose: '1',
  minimumStock: '5',
};

// Componente declarado fora de MedicationForm para preservar o foco.
function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

export default function MedicationForm({
  initialData,
  onSave,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<MedicineDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      const { id, active, administered, ...formData } = initialData;

      setDraft({
        ...formData,
        minimumStock: formData.minimumStock ?? '5',
      });
    } else {
      setDraft(emptyDraft);
    }
  }, [initialData]);

  function update<K extends keyof MedicineDraft>(
    field: K,
    value: MedicineDraft[K],
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave() {
    if (
      !draft.name.trim() ||
      !draft.dosage.trim() ||
      !draft.firstTime.trim() ||
      !draft.startDate.trim()
    ) {
      Alert.alert(
        'Campos obrigatórios',
        'Preencha nome, dosagem, horário e data de início.',
      );
      return;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.firstTime)) {
      Alert.alert('Horário inválido', 'Use o formato HH:MM.');
      return;
    }

    const interval = Number(draft.intervalHours);
    const units = Number(draft.unitsPerDose);

    const stock = draft.stockQuantity.trim()
      ? Number(draft.stockQuantity.replace(',', '.'))
      : null;

    const minimumStock = draft.minimumStock.trim()
      ? Number(draft.minimumStock.replace(',', '.'))
      : 0;

    if (!Number.isFinite(interval) || interval < 1 || interval > 24) {
      Alert.alert(
        'Intervalo inválido',
        'Informe um intervalo entre 1 e 24 horas.',
      );
      return;
    }

    if (!Number.isFinite(units) || units <= 0) {
      Alert.alert(
        'Quantidade inválida',
        'Informe uma quantidade por dose maior que zero.',
      );
      return;
    }

    if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
      Alert.alert(
        'Estoque inválido',
        'Informe um estoque igual ou maior que zero.',
      );
      return;
    }

    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      Alert.alert(
        'Estoque mínimo inválido',
        'Informe um limite igual ou maior que zero.',
      );
      return;
    }

    if (!draft.continuous && !draft.endDate.trim()) {
      Alert.alert(
        'Data obrigatória',
        'Informe a data final do tratamento.',
      );
      return;
    }

    setSaving(true);

    try {
      await onSave(draft);
    } catch (error) {
      Alert.alert(
        'Não foi possível salvar',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.formTitle}>
        {initialData ? 'Editar medicamento' : 'Novo medicamento'}
      </Text>

      <Field
        label="Nome do medicamento *"
        value={draft.name}
        onChangeText={(value) => update('name', value)}
        placeholder="Ex.: Losartana"
      />

      <Field
        label="Dosagem *"
        value={draft.dosage}
        onChangeText={(value) => update('dosage', value)}
        placeholder="Ex.: 50 mg"
      />

      <Field
        label="Instruções de uso"
        value={draft.instructions}
        onChangeText={(value) => update('instructions', value)}
        placeholder="Ex.: Administrar após o almoço"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Field
            label="Primeiro horário *"
            value={draft.firstTime}
            onChangeText={(value) => update('firstTime', value)}
            placeholder="08:00"
          />
        </View>

        <View style={styles.half}>
          <Field
            label="Intervalo (horas) *"
            value={draft.intervalHours}
            onChangeText={(value) => update('intervalHours', value)}
            keyboardType="numeric"
            placeholder="8"
          />
        </View>
      </View>

      <Field
        label="Data de início *"
        value={draft.startDate}
        onChangeText={(value) => update('startDate', value)}
        placeholder="DD/MM/AAAA"
      />

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.label}>Uso contínuo</Text>

          <Text style={styles.helper}>
            O medicamento não possui data de término.
          </Text>
        </View>

        <Switch
          value={draft.continuous}
          onValueChange={(value) => update('continuous', value)}
          trackColor={{ false: COLORS.border, true: COLORS.blue }}
        />
      </View>

      {!draft.continuous && (
        <Field
          label="Data de término *"
          value={draft.endDate}
          onChangeText={(value) => update('endDate', value)}
          placeholder="DD/MM/AAAA"
        />
      )}

      <Field
        label="Quantidade por dose *"
        value={draft.unitsPerDose}
        onChangeText={(value) => update('unitsPerDose', value)}
        keyboardType="numeric"
        placeholder="1"
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Field
            label="Quantidade em estoque"
            value={draft.stockQuantity}
            onChangeText={(value) => update('stockQuantity', value)}
            keyboardType="numeric"
            placeholder="Ex.: 30"
          />
        </View>

        <View style={styles.half}>
          <Text style={styles.label}>Unidade</Text>

          <View style={styles.unitOptions}>
            {['comprimidos', 'cápsulas', 'gotas', 'ml', 'caixas'].map(
              (unit) => (
                <Pressable
                  key={unit}
                  onPress={() => update('stockUnit', unit)}
                  style={[
                    styles.unitOption,
                    draft.stockUnit === unit && styles.unitSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.unitText,
                      draft.stockUnit === unit && styles.unitTextSelected,
                    ]}
                  >
                    {unit}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        </View>
      </View>

      <Field
        label={`Estoque mínimo para alerta (${draft.stockUnit})`}
        value={draft.minimumStock}
        onChangeText={(value) => update('minimumStock', value)}
        keyboardType="numeric"
        placeholder="Ex.: 5"
      />

      <Text style={styles.helper}>
        O alerta será exibido quando o estoque atingir esse limite ou ficar abaixo dele.
      </Text>

      <View style={styles.buttons}>
        <Pressable
          onPress={onCancel}
          disabled={saving}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveButton, saving && styles.disabled]}
        >
          <Text style={styles.saveText}>
            {saving ? 'Salvando...' : 'Salvar medicamento'}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.helper}>* Campos obrigatórios</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  formTitle: {
    color: COLORS.dark,
    fontSize: 20,
    fontWeight: '800',
  },
  field: {
    flex: 1,
    gap: 7,
  },
  label: {
    color: COLORS.dark,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    color: COLORS.dark,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  half: {
    flex: 1,
    gap: 7,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchText: {
    flex: 1,
    gap: 4,
  },
  helper: {
    color: COLORS.muted,
    fontSize: 11,
  },
  unitOptions: {
    gap: 6,
  },
  unitOption: {
    padding: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 7,
  },
  unitSelected: {
    backgroundColor: '#E8F6FA',
    borderColor: COLORS.blue,
  },
  unitText: {
    color: COLORS.muted,
    fontSize: 12,
  },
  unitTextSelected: {
    color: COLORS.dark,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
  },
  cancelText: {
    color: COLORS.dark,
    fontWeight: '700',
  },
  saveButton: {
    flex: 2,
    padding: 13,
    alignItems: 'center',
    backgroundColor: COLORS.blue,
    borderRadius: 8,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.5,
  },
});
