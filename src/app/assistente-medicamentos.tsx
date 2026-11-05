import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Alert } from '../utils/platformAlert';

import { useMedications } from '../features/medications/MedicationContext';
import type { MedicineDraft } from '../types/medication';

const INITIAL_DRAFT: MedicineDraft = {
  name: '',
  dosage: '',
  instructions: '',
  firstTime: '',
  intervalHours: '',
  continuous: true,
  startDate: '',
  endDate: '',
  stockQuantity: '',
  stockUnit: '',
  unitsPerDose: '',
  minimumStock: '',
};

type ChatMessage = {
  id: number;
  sender: 'assistant' | 'user';
  text: string;
};

type ChatStep =
  | 'medication'
  | 'startDate'
  | 'continuous'
  | 'endDate'
  | 'stockQuantity'
  | 'stockUnit'
  | 'unitsPerDose'
  | 'minimumStock'
  | 'instructions'
  | 'finished';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    sender: 'assistant',
    text: 'Olá! Vou ajudar você a cadastrar um medicamento. Primeiro, conte o nome, a dosagem, os horários e a frequência de uso.',
  },
  {
    id: 2,
    sender: 'assistant',
    text: 'Exemplo: "Losartana 50 mg, 1 comprimido às 08:00, de 12 em 12 horas". Você também pode usar o microfone do teclado do celular para ditar sua resposta.',
  },
];

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .trim();
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  'vinte e um': 21,
  'vinte e uma': 21,
  'vinte e dois': 22,
  'vinte e tres': 23,
  'vinte e quatro': 24,
};

function numberFromWords(value: string): number | null {
  const normalized = normalizeText(value);

  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, normalized)) {
    return NUMBER_WORDS[normalized];
  }

  const numeric = Number(normalized.replace(',', '.'));

  return Number.isFinite(numeric) ? numeric : null;
}

function extractTime(text: string): string | null {
  const normalized = normalizeText(text);

  // Exemplos: 07:00, 7:30, 19:45.
  const colonMatch = normalized.match(
    /\b([01]?\d|2[0-3])\s*:\s*([0-5]\d)\b/,
  );

  if (colonMatch) {
    return `${colonMatch[1].padStart(2, '0')}:${colonMatch[2]}`;
  }

  // Exemplos: 7h, 07h30, 7 hr, 7 horas.
  const numericTimeMatch = normalized.match(
    /\b([01]?\d|2[0-3])\s*(?:h(?:r|rs|oras?)?)\s*([0-5]\d)?\b/i,
  );

  if (numericTimeMatch) {
    const hour = numericTimeMatch[1].padStart(2, '0');
    const minutes = numericTimeMatch[2] || '00';

    return `${hour}:${minutes}`;
  }

  // Exemplos: 7 e meia, 7 da manhã, 7 da noite.
  const numberExpression =
    '(vinte e quatro|vinte e tres|vinte e dois|vinte e uma|vinte e um|dezenove|dezoito|dezessete|dezesseis|quinze|quatorze|catorze|treze|doze|onze|dez|nove|oito|sete|seis|cinco|quatro|tres|duas|dois|uma|um|zero)';

  const wordTimeRegex = new RegExp(
    `\\b(?:as?\\s+)?${numberExpression}(?:\\s+e\\s+meia|\\s+horas?)?(?:\\s+da\\s+(manha|tarde|noite))?\\b`,
    'i',
  );

  const wordTimeMatch = normalized.match(wordTimeRegex);

  if (wordTimeMatch) {
    let hour = numberFromWords(wordTimeMatch[1]);

    if (hour === null || hour > 23) {
      return null;
    }

    const hasHalf = /e\s+meia/.test(wordTimeMatch[0]);
    const period = wordTimeMatch[2];

    if ((period === 'tarde' || period === 'noite') && hour < 12) {
      hour += 12;
    }

    if (period === 'manha' && hour === 12) {
      hour = 0;
    }

    if (hour > 23) {
      return null;
    }

    return `${String(hour).padStart(2, '0')}:${hasHalf ? '30' : '00'}`;
  }

  // Exemplos: 7 e meia da manhã, 7 da noite.
  const numericPeriodMatch = normalized.match(
    /\b([01]?\d|2[0-3])(?:\s+e\s+meia)?(?:\s+da\s+(manha|tarde|noite))\b/,
  );

  if (numericPeriodMatch) {
    let hour = Number(numericPeriodMatch[1]);
    const period = numericPeriodMatch[2];
    const hasHalf = /e\s+meia/.test(numericPeriodMatch[0]);

    if ((period === 'tarde' || period === 'noite') && hour < 12) {
      hour += 12;
    }

    if (period === 'manha' && hour === 12) {
      hour = 0;
    }

    if (hour <= 23) {
      return `${String(hour).padStart(2, '0')}:${hasHalf ? '30' : '00'}`;
    }
  }

  return null;
}

function extractInterval(text: string): string {
  const normalized = normalizeText(text);

  // Exemplos: de 6 em 6 horas, 6 em 6h, a cada 8 horas.
  const numericPatterns = [
    /\bde\s*(\d{1,2})\s*em\s*\d{1,2}\s*(?:h(?:r|rs|oras?)?|horas?)\b/,
    /\b(\d{1,2})\s*em\s*\d{1,2}\s*(?:h(?:r|rs|oras?)?|horas?)\b/,
    /\ba\s*cada\s*(\d{1,2})\s*(?:h(?:r|rs|oras?)?|horas?)\b/,
    /\bcada\s*(\d{1,2})\s*(?:h(?:r|rs|oras?)?|horas?)\b/,
  ];

  for (const pattern of numericPatterns) {
    const match = normalized.match(pattern);

    if (match) {
      const interval = Number(match[1]);

      if (interval >= 1 && interval <= 24) {
        return String(interval);
      }
    }
  }

  // Exemplos: de seis em seis horas, a cada oito horas.
  const numberExpression =
    '(vinte e quatro|vinte e tres|vinte e dois|vinte e um|dezenove|dezoito|dezessete|dezesseis|quinze|quatorze|catorze|treze|doze|onze|dez|nove|oito|sete|seis|cinco|quatro|tres|duas|dois|uma|um)';

  const wordPatterns = [
    new RegExp(
      `\\bde\\s*${numberExpression}\\s*em\\s*${numberExpression}\\s*(?:horas?|h|hr|hrs)\\b`,
    ),
    new RegExp(
      `\\ba\\s*cada\\s*${numberExpression}\\s*(?:horas?|h|hr|hrs)\\b`,
    ),
    new RegExp(
      `\\bcada\\s*${numberExpression}\\s*(?:horas?|h|hr|hrs)\\b`,
    ),
  ];

  for (const pattern of wordPatterns) {
    const match = normalized.match(pattern);

    if (match) {
      const interval = numberFromWords(match[1]);

      if (interval !== null && interval >= 1 && interval <= 24) {
        return String(interval);
      }
    }
  }

  return '';
}

function extractDosage(text: string): string {
  const match = text.match(
    /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|UI|%|gotas?)(?:\s*\/\s*\d+(?:[.,]?\d+)?\s*(?:ml))?/i,
  );

  return match ? match[0].trim() : '';
}

function extractConsumption(text: string) {
  const normalized = normalizeText(text);

  const match = normalized.match(
    /\b(\d+(?:[.,]\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\s*(comprimidos?|capsulas?|gotas?|ml|g|ampolas?|frascos?|unidades?|caixas?)\b/i,
  );

  if (!match) {
    return null;
  }

  const quantityValue = numberFromWords(match[1]);

  if (quantityValue === null) {
    return null;
  }

  const unit = match[2];

  const unitMap: Record<string, string> = {
    comprimido: 'comprimidos',
    comprimidos: 'comprimidos',
    capsula: 'cápsulas',
    capsulas: 'cápsulas',
    gota: 'gotas',
    gotas: 'gotas',
    ml: 'ml',
    g: 'g',
    ampola: 'ampolas',
    ampolas: 'ampolas',
    frasco: 'frascos',
    frascos: 'frascos',
    unidade: 'unidades',
    unidades: 'unidades',
    caixa: 'caixas',
    caixas: 'caixas',
  };

  return {
    quantity: String(quantityValue),
    unit: unitMap[unit] || unit,
  };
}

function parseMedicationMessage(
  message: string,
  current: MedicineDraft,
): MedicineDraft {
  const result = { ...current };
  const text = message.trim();

  const extractedTime = extractTime(text);

  if (extractedTime) {
    result.firstTime = extractedTime;
  }

  const interval = extractInterval(text);

  if (interval) {
    result.intervalHours = interval;
  }

  const dosage = extractDosage(text);

  if (dosage) {
    result.dosage = dosage;
  }

  const consumption = extractConsumption(text);

  if (consumption) {
    result.unitsPerDose = consumption.quantity;
    result.stockUnit = consumption.unit;
  }

  const nameMatch = text.match(
    /(?:medicamento\s*:?\s*|rem[eé]dio\s*:?\s*|tomar\s+|tomo\s+|uso\s+)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9-]*)?)/i,
  );

  if (nameMatch) {
    result.name = nameMatch[1].trim();
  } else if (!result.name && dosage) {
    const dosageIndex = text.toLowerCase().indexOf(dosage.toLowerCase());
    const beforeDosage = text.slice(0, dosageIndex).trim();

    const cleanedName = beforeDosage
      .replace(/^(?:o|a|meu|minha|medicamento|remédio)\s+/i, '')
      .replace(/[,:;.\-]+$/, '')
      .trim();

    if (cleanedName && cleanedName.length <= 50) {
      result.name = cleanedName;
    }
  }

  return result;
}

function isNegativeAnswer(text: string): boolean {
  return /\b(não|nao|não quero|nao quero|sem estoque|não controlar|nao controlar|pular|ignorar)\b/i.test(
    text,
  );
}

function isPositiveAnswer(text: string): boolean {
  return /\b(sim|s|contínuo|continuo|uso contínuo|uso continuo|indefinido|sempre)\b/i.test(
    text,
  );
}

function isValidDate(text: string): boolean {
  return /^([0-2]\d|3[01])\/(0\d|1[0-2])\/\d{4}$/.test(text.trim());
}

function addDaysToConversation(
  currentMessages: ChatMessage[],
  userText: string,
  assistantText: string,
): ChatMessage[] {
  const now = Date.now();

  return [
    ...currentMessages,
    {
      id: now,
      sender: 'user',
      text: userText,
    },
    {
      id: now + 1,
      sender: 'assistant',
      text: assistantText,
    },
  ];
}

export default function AssistenteMedicamentosScreen() {
  const { addMedicine } = useMedications();

  const [draft, setDraft] = useState<MedicineDraft>(INITIAL_DRAFT);
  const [showReview, setShowReview] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [chatStep, setChatStep] = useState<ChatStep>('medication');

  const updateField = <K extends keyof MedicineDraft>(
    field: K,
    value: MedicineDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const appendConversation = (userText: string, assistantText: string) => {
    setMessages((current) =>
      addDaysToConversation(current, userText, assistantText),
    );
  };

  const advanceToStock = (userText: string) => {
    setChatStep('stockQuantity');

    appendConversation(
      userText,
      'Entendi. Agora vamos falar sobre o estoque. Quantas unidades desse medicamento você tem atualmente? Se não quiser controlar o estoque, responda "não controlar".',
    );
  };

  const finishStockQuestions = (userText: string) => {
    setChatStep('instructions');

    appendConversation(
      userText,
      'Agora, para finalizar: existe alguma instrução adicional de uso que você gostaria de registrar? Por exemplo, tomar após as refeições ou não administrar em jejum. Se não houver nenhuma, responda "não".',
    );
  };

  const askMinimumStock = (userText: string) => {
    setChatStep('minimumStock');

    appendConversation(
      userText,
      'A partir de qual quantidade restante você deseja receber um aviso de estoque baixo? Por exemplo: 5. Se não quiser esse aviso, responda "não".',
    );
  };

  const processChatAnswer = (text: string) => {
    const answer = text.trim();

    if (chatStep === 'medication') {
      const updatedDraft = parseMedicationMessage(answer, draft);

      setDraft(updatedDraft);
      setChatStep('startDate');

      appendConversation(
        answer,
        'Certo! Agora, qual é a data de início do uso desse medicamento? Informe no formato DD/MM/AAAA.',
      );
      return;
    }

    if (chatStep === 'startDate') {
      if (!isValidDate(answer)) {
        appendConversation(
          answer,
          'Não consegui reconhecer essa data. Informe no formato DD/MM/AAAA, por exemplo: 03/11/2026.',
        );
        return;
      }

      updateField('startDate', answer);
      setChatStep('continuous');

      appendConversation(
        answer,
        'O medicamento será de uso contínuo, sem uma data prevista para terminar?',
      );
      return;
    }

    if (chatStep === 'continuous') {
      if (isPositiveAnswer(answer)) {
        setDraft((current) => ({
          ...current,
          continuous: true,
          endDate: '',
        }));

        advanceToStock(answer);
        return;
      }

      if (isNegativeAnswer(answer)) {
        setDraft((current) => ({
          ...current,
          continuous: false,
          endDate: '',
        }));

        setChatStep('endDate');

        appendConversation(
          answer,
          'Entendi. Então qual será a data de término do tratamento? Informe no formato DD/MM/AAAA.',
        );
        return;
      }

      appendConversation(
        answer,
        'Só para confirmar: o uso será contínuo ou terá uma data para terminar? Responda "contínuo" ou "terá data de término".',
      );
      return;
    }

    if (chatStep === 'endDate') {
      if (!isValidDate(answer)) {
        appendConversation(
          answer,
          'Não consegui reconhecer essa data. Informe no formato DD/MM/AAAA, por exemplo: 20/11/2026.',
        );
        return;
      }

      updateField('endDate', answer);
      advanceToStock(answer);
      return;
    }

    if (chatStep === 'stockQuantity') {
      if (isNegativeAnswer(answer)) {
        setDraft((current) => ({
          ...current,
          stockQuantity: '',
          stockUnit: '',
          unitsPerDose: '',
          minimumStock: '',
        }));

        finishStockQuestions(answer);
        return;
      }

      const quantityMatch = answer.match(/\d+(?:[.,]\d+)?/);

      if (!quantityMatch) {
        appendConversation(
          answer,
          'Informe uma quantidade numérica, por exemplo: 30. Se não quiser acompanhar o estoque, responda "não controlar".',
        );
        return;
      }

      updateField(
        'stockQuantity',
        quantityMatch[0].replace(',', '.'),
      );

      if (draft.stockUnit && draft.unitsPerDose) {
        askMinimumStock(answer);
        return;
      }

      setChatStep('stockUnit');

      appendConversation(
        answer,
        'Qual é a unidade dessa quantidade? Por exemplo: comprimidos, cápsulas, frascos, caixas ou ml.',
      );
      return;
    }

    if (chatStep === 'stockUnit') {
      const normalized = normalizeText(answer);

      const unitMap: Record<string, string> = {
        comprimido: 'comprimidos',
        comprimidos: 'comprimidos',
        capsula: 'cápsulas',
        capsulas: 'cápsulas',
        gota: 'gotas',
        gotas: 'gotas',
        ampola: 'ampolas',
        ampolas: 'ampolas',
        frasco: 'frascos',
        frascos: 'frascos',
        caixa: 'caixas',
        caixas: 'caixas',
        unidade: 'unidades',
        unidades: 'unidades',
        ml: 'ml',
        g: 'g',
      };

      updateField('stockUnit', unitMap[normalized] || answer);

      if (draft.unitsPerDose) {
        askMinimumStock(answer);
        return;
      }

      setChatStep('unitsPerDose');

      appendConversation(
        answer,
        'Quantas unidades são utilizadas em cada dose? Por exemplo: 1 comprimido ou 2 cápsulas.',
      );
      return;
    }

    if (chatStep === 'unitsPerDose') {
      const consumption = extractConsumption(answer);
      const consumptionMatch = answer.match(
        /\d+(?:[.,]\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez/i,
      );

      if (!consumptionMatch) {
        appendConversation(
          answer,
          'Informe a quantidade utilizada por dose, por exemplo: 1. Você também pode responder "não sei" e preencher depois.',
        );
        return;
      }

      const quantity = numberFromWords(consumptionMatch[0]);

      if (quantity === null) {
        appendConversation(
          answer,
          'Não consegui reconhecer essa quantidade. Informe um número, por exemplo: 1 ou 2.',
        );
        return;
      }

      setDraft((current) => ({
        ...current,
        unitsPerDose: String(quantity),
        ...(consumption ? { stockUnit: consumption.unit } : {}),
      }));

      askMinimumStock(answer);
      return;
    }

    if (chatStep === 'minimumStock') {
      if (isNegativeAnswer(answer)) {
        updateField('minimumStock', '');
      } else {
        const minimumMatch = answer.match(/\d+(?:[.,]\d+)?/);

        if (!minimumMatch) {
          appendConversation(
            answer,
            'Informe uma quantidade numérica, por exemplo: 5. Se não quiser receber avisos, responda "não".',
          );
          return;
        }

        updateField(
          'minimumStock',
          minimumMatch[0].replace(',', '.'),
        );
      }

      finishStockQuestions(answer);
      return;
    }

    if (chatStep === 'instructions') {
      updateField(
        'instructions',
        isNegativeAnswer(answer)
          ? 'Sem instruções adicionais'
          : answer,
      );

      setChatStep('finished');

      appendConversation(
        answer,
        'Pronto! Reuni as informações do medicamento, do período de uso e do estoque. Agora você pode conferir os dados e completar o que faltar antes de salvar.',
      );
      return;
    }

    appendConversation(
      answer,
      'As perguntas foram concluídas. Você já pode conferir o cadastro.',
    );
  };

  const sendMessage = () => {
    const text = messageInput.trim();

    if (!text) {
      return;
    }

    processChatAnswer(text);
    setMessageInput('');
  };

  const validateDraft = () => {
    if (!draft.name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do medicamento.');
      return false;
    }

    if (!draft.dosage.trim()) {
      Alert.alert('Campo obrigatório', 'Informe a dosagem.');
      return false;
    }

    if (!draft.instructions.trim()) {
      Alert.alert(
        'Campo obrigatório',
        'Informe as instruções de uso.',
      );
      return false;
    }

    if (!draft.firstTime.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o primeiro horário.');
      return false;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.firstTime)) {
      Alert.alert(
        'Horário inválido',
        'Informe o horário no formato HH:MM. Exemplo: 08:00.',
      );
      return false;
    }

    const interval = Number(draft.intervalHours);

    if (
      !draft.intervalHours.trim() ||
      !Number.isFinite(interval) ||
      interval <= 0 ||
      interval > 24
    ) {
      Alert.alert(
        'Intervalo inválido',
        'Informe um intervalo entre 1 e 24 horas.',
      );
      return false;
    }

    if (!draft.startDate.trim() || !isValidDate(draft.startDate)) {
      Alert.alert(
        'Data de início inválida',
        'Informe a data de início no formato DD/MM/AAAA.',
      );
      return false;
    }

    if (!draft.continuous && !isValidDate(draft.endDate)) {
      Alert.alert(
        'Data de término inválida',
        'Informe a data de término no formato DD/MM/AAAA.',
      );
      return false;
    }

    if (
      draft.stockQuantity.trim() &&
      (!draft.stockUnit.trim() || !draft.unitsPerDose.trim())
    ) {
      Alert.alert(
        'Estoque incompleto',
        'Informe a unidade de estoque e o consumo por dose.',
      );
      return false;
    }

    return true;
  };

  const openReview = () => {
    if (!validateDraft()) {
      setShowForm(true);
      setShowReview(false);
      return;
    }

    setShowReview(true);
  };

  const handleSave = async () => {
    if (!validateDraft()) {
      setShowReview(false);
      setShowForm(true);
      return;
    }

    try {
      setSaving(true);

      await addMedicine({
        ...draft,
        name: draft.name.trim(),
        dosage: draft.dosage.trim(),
        instructions: draft.instructions.trim(),
        firstTime: draft.firstTime.trim(),
        intervalHours: draft.intervalHours.trim(),
        startDate: draft.startDate.trim(),
        endDate: draft.continuous ? '' : draft.endDate.trim(),
        stockQuantity: draft.stockQuantity.trim(),
        stockUnit: draft.stockUnit.trim(),
        unitsPerDose: draft.unitsPerDose.trim(),
        minimumStock: draft.minimumStock.trim(),
      });

      Alert.alert(
        'Medicamento cadastrado',
        `${draft.name} foi adicionado à lista de medicamentos.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setDraft(INITIAL_DRAFT);
              setShowReview(false);
              setShowForm(false);
              setChatStep('medication');
              setMessages(INITIAL_MESSAGES);
              setMessageInput('');
            },
          },
        ],
      );
    } catch (error) {
      console.error('Erro ao cadastrar medicamento:', error);

      Alert.alert(
        'Não foi possível salvar',
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro ao cadastrar o medicamento.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (
    label: string,
    field: keyof MedicineDraft,
    placeholder: string,
    options?: {
      keyboardType?: 'default' | 'numeric';
      multiline?: boolean;
      helper?: string;
    },
  ) => (
    <View style={styles.field} key={field}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={[
          styles.input,
          options?.multiline && styles.multilineInput,
        ]}
        value={String(draft[field])}
        onChangeText={(value) => updateField(field, value as never)}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={options?.keyboardType ?? 'default'}
        multiline={options?.multiline}
        textAlignVertical={options?.multiline ? 'top' : 'center'}
      />

      {options?.helper ? (
        <Text style={styles.helper}>{options.helper}</Text>
      ) : null}
    </View>
  );

  const reviewRow = (label: string, value: string) => (
    <View style={styles.reviewRow} key={label}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>
        {value || 'Não informado'}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>✦</Text>
          </View>

          <Text style={styles.title}>Assistente de Medicamentos</Text>

          <Text style={styles.subtitle}>
            Vamos cadastrar o medicamento por meio de uma conversa. Ao final,
            você poderá conferir todas as informações.
          </Text>
        </View>

        {!showForm && !showReview ? (
          <View style={styles.chatCard}>
            <View style={styles.chatHeader}>
              <View style={styles.assistantAvatar}>
                <Text style={styles.assistantAvatarText}>✦</Text>
              </View>

              <View style={styles.chatHeaderText}>
                <Text style={styles.chatTitle}>Assistente AICare</Text>
                <Text style={styles.chatStatus}>
                  Pronto para ajudar
                </Text>
              </View>
            </View>

            <View style={styles.chatMessages}>
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    message.sender === 'user' && styles.userMessageRow,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      message.sender === 'user'
                        ? styles.userBubble
                        : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        message.sender === 'user' &&
                          styles.userMessageText,
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {chatStep === 'finished' ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setShowForm(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryButtonText}>
                  Conferir cadastro
                </Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.chatHint}>
                  Responda à pergunta acima para continuar o cadastro.
                </Text>

                <View style={styles.messageComposer}>
                  <TextInput
                    style={styles.messageInput}
                    value={messageInput}
                    onChangeText={setMessageInput}
                    placeholder="Digite ou dite sua resposta..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    maxLength={1000}
                  />

                  <TouchableOpacity
                    style={[
                      styles.sendButton,
                      !messageInput.trim() &&
                        styles.sendButtonDisabled,
                    ]}
                    onPress={sendMessage}
                    disabled={!messageInput.trim()}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.sendButtonText}>Enviar</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <Text style={styles.chatDisclaimer}>
              Esta versão utiliza uma interpretação demonstrativa. Confira
              sempre os dados com a receita ou orientação profissional.
            </Text>
          </View>
        ) : null}

        {showForm && !showReview ? (
          <View style={styles.card}>
            <View style={styles.formHeader}>
              <Text style={styles.sectionTitle}>
                Informações do medicamento
              </Text>

              <TouchableOpacity
                onPress={() => setShowForm(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.backToChat}>
                  Voltar à conversa
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionDescription}>
              Os dados coletados na conversa foram preenchidos quando
              possível. Confira e complete o que estiver faltando.
            </Text>

            {renderInput(
              'Nome do medicamento *',
              'name',
              'Ex.: Losartana',
            )}

            {renderInput('Dosagem *', 'dosage', 'Ex.: 50 mg')}

            {renderInput(
              'Instruções de uso *',
              'instructions',
              'Ex.: Tomar após as refeições',
              { multiline: true },
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>
              Horários e frequência
            </Text>

            {renderInput(
              'Primeiro horário *',
              'firstTime',
              'Ex.: 08:00',
              {
                helper: 'Use o formato de 24 horas.',
              },
            )}

            {renderInput(
              'Intervalo entre as doses (horas) *',
              'intervalHours',
              'Ex.: 8',
              { keyboardType: 'numeric' },
            )}

            <View style={styles.switchRow}>
              <View style={styles.switchTextContainer}>
                <Text style={styles.label}>Uso contínuo</Text>
                <Text style={styles.helper}>
                  O medicamento não possui data de término definida.
                </Text>
              </View>

              <Switch
                value={draft.continuous}
                onValueChange={(value) => {
                  updateField('continuous', value);

                  if (value) {
                    updateField('endDate', '');
                  }
                }}
                trackColor={{
                  false: '#CBD5E1',
                  true: '#8CCBC1',
                }}
                thumbColor={
                  draft.continuous ? '#238477' : '#F8FAFC'
                }
              />
            </View>

            {renderInput(
              'Data de início *',
              'startDate',
              'DD/MM/AAAA',
            )}

            {!draft.continuous &&
              renderInput(
                'Data de término *',
                'endDate',
                'DD/MM/AAAA',
              )}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>
              Controle de estoque
            </Text>

            <Text style={styles.sectionDescription}>
              Estes campos são opcionais.
            </Text>

            {renderInput(
              'Quantidade atual',
              'stockQuantity',
              'Ex.: 30',
              { keyboardType: 'numeric' },
            )}

            {renderInput(
              'Unidade de estoque',
              'stockUnit',
              'Ex.: comprimidos, caixas ou ml',
            )}

            {renderInput(
              'Consumo por dose',
              'unitsPerDose',
              'Ex.: 1',
              { keyboardType: 'numeric' },
            )}

            {renderInput(
              'Estoque mínimo',
              'minimumStock',
              'Ex.: 5',
              { keyboardType: 'numeric' },
            )}

            <Text style={styles.requiredNote}>
              * Campos obrigatórios.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={openReview}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>
                Revisar informações
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showReview ? (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View>
                <Text style={styles.reviewTitle}>
                  Confirme os dados
                </Text>
                <Text style={styles.reviewSubtitle}>
                  Confira antes de cadastrar.
                </Text>
              </View>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Em revisão</Text>
              </View>
            </View>

            <View style={styles.medicineNameBox}>
              <Text style={styles.medicineNameLabel}>
                Medicamento
              </Text>
              <Text style={styles.medicineName}>{draft.name}</Text>
              <Text style={styles.medicineDosage}>
                {draft.dosage}
              </Text>
            </View>

            <Text style={styles.reviewSectionTitle}>
              Uso do medicamento
            </Text>

            {reviewRow('Instruções', draft.instructions)}
            {reviewRow('Primeiro horário', draft.firstTime)}
            {reviewRow(
              'Intervalo',
              `${draft.intervalHours} hora(s)`,
            )}
            {reviewRow(
              'Tipo de uso',
              draft.continuous
                ? 'Contínuo'
                : 'Por período determinado',
            )}
            {reviewRow('Data de início', draft.startDate)}

            {!draft.continuous &&
              reviewRow('Data de término', draft.endDate)}

            <View style={styles.divider} />

            <Text style={styles.reviewSectionTitle}>
              Estoque
            </Text>

            {reviewRow(
              'Quantidade atual',
              draft.stockQuantity
                ? `${draft.stockQuantity} ${draft.stockUnit}`
                : 'Não controlar estoque',
            )}
            {reviewRow(
              'Consumo por dose',
              draft.unitsPerDose,
            )}
            {reviewRow('Estoque mínimo', draft.minimumStock)}

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Confira se as informações correspondem à receita ou à
                orientação recebida. O medicamento só será cadastrado após
                sua confirmação.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                setShowReview(false);
                setShowForm(true);
              }}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>
                Voltar e editar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                saving && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Confirmar e salvar
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.footer}>
          AICare · Cuidado e acompanhamento
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F8',
  },
  content: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#DDF1ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  headerIconText: {
    fontSize: 28,
    color: '#238477',
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#183B45',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 320,
  },
  chatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 18,
  },
  assistantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#DDF1ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantAvatarText: {
    color: '#238477',
    fontSize: 22,
  },
  chatHeaderText: {
    marginLeft: 11,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#183B45',
  },
  chatStatus: {
    fontSize: 12,
    color: '#238477',
    marginTop: 3,
  },
  chatMessages: {
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assistantBubble: {
    backgroundColor: '#EDF4F4',
    borderBottomLeftRadius: 5,
  },
  userBubble: {
    backgroundColor: '#238477',
    borderBottomRightRadius: 5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  chatHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 20,
    marginBottom: 10,
  },
  messageComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 13,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  messageInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 110,
    paddingHorizontal: 7,
    paddingVertical: 9,
    color: '#183B45',
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#238477',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  chatDisclaimer: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  formHeader: {
    gap: 10,
    marginBottom: 6,
  },
  backToChat: {
    color: '#238477',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 5,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#183B45',
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 20,
  },
  field: {
    marginBottom: 17,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 11,
    paddingHorizontal: 13,
    fontSize: 15,
    color: '#183B45',
    backgroundColor: '#FFFFFF',
  },
  multilineInput: {
    minHeight: 85,
    paddingTop: 12,
  },
  helper: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  switchTextContainer: {
    flex: 1,
  },
  requiredNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 18,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#238477',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.65,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#D5E8E4',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  reviewTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#183B45',
  },
  reviewSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 5,
  },
  statusBadge: {
    backgroundColor: '#FFF2D9',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    color: '#946200',
    fontSize: 11,
    fontWeight: '700',
  },
  medicineNameBox: {
    backgroundColor: '#EDF7F5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 22,
  },
  medicineNameLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 5,
  },
  medicineName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#183B45',
  },
  medicineDosage: {
    fontSize: 14,
    color: '#238477',
    marginTop: 4,
    fontWeight: '600',
  },
  reviewSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#183B45',
    marginBottom: 12,
  },
  reviewRow: {
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reviewLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 5,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 20,
  },
  warningBox: {
    backgroundColor: '#FFF8E8',
    borderRadius: 12,
    padding: 13,
    marginTop: 20,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#805B16',
    lineHeight: 19,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#238477',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#238477',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 24,
  },
});