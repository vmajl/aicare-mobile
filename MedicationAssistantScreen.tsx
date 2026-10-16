import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Bot,
  CircleStop,
  Mic,
  Send,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react-native';
import {
  RecordingPresets,
  useAudioRecorder,
} from 'expo-audio';

type Message = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

export type AssistantMedicationDraft = Partial<{
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
  duration: string;
}>;

type Props = {
  onBack: () => void;
  onComplete: (draft: AssistantMedicationDraft) => void;
};

const COLORS = {
  blue: '#50A9C3',
  dark: '#102F40',
  muted: '#6D8794',
  bg: '#F4FAFC',
  border: '#D8E3E8',
  paleBlue: '#E8F6FA',
  white: '#FFFFFF',
  green: '#24835A',
  paleGreen: '#EAF7F0',
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome',
    role: 'assistant',
    text: 'Olá! Me conte o remédio: o nome, a dosagem e de quantas em quantas horas precisa tomar.',
  },
];

const STOCK_UNIT_LABELS: Record<string, string> = {
  unidade: 'unidades',
  unidades: 'unidades',
  comprimido: 'comprimidos',
  comprimidos: 'comprimidos',
  cápsula: 'cápsulas',
  cápsulas: 'cápsulas',
  caixa: 'caixas',
  caixas: 'caixas',
  ml: 'ml',
  gota: 'gotas',
  gotas: 'gotas',
};

const EMPTY_MEDICATION: AssistantMedicationDraft = {};

export default function MedicationAssistantScreen({
  onBack,
  onComplete,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [medication, setMedication] =
    useState<AssistantMedicationDraft>(EMPTY_MEDICATION);
  const [isThinking, setIsThinking] = useState(false);
  const [conversationStep, setConversationStep] = useState<'medication' | 'firstTime'>('medication');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    return () => {
      // If the screen is closed while recording, stop the recorder cleanly.
      if (isRecording) {
        recorder.stop().catch(() => undefined);
      }
    };
  }, [isRecording, recorder]);

  const addMessage = (role: Message['role'], text: string) => {
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random()}`, role, text },
    ]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const parseDemoMessage = (text: string): AssistantMedicationDraft => {
    const cleaned = text.trim();
    const intervalMatch =
      cleaned.match(/\bde\s+(\d+(?:[.,]\d+)?)\s*h?\s+em\s+\d+(?:[.,]\d+)?\s*h?\b/i) ??
      cleaned.match(/\ba cada\s+(\d+(?:[.,]\d+)?)\s*(?:horas?|h)\b/i) ??
      cleaned.match(/\bintervalo(?: entre doses)?(?: de)?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(?:horas?|h)\b/i) ??
      cleaned.match(/\b(\d+(?:[.,]\d+)?)\s*\/\s*\d+(?:[.,]\d+)?\s*(?:horas?|h)\b/i);
    const unitsPerDoseMatch = cleaned.match(
      /\b(\d+(?:[.,]\d+)?)\s*(?:unidades?|comprimidos?|cápsulas?|gotas?)\s+por dose\b/i,
    );
    const stockSource = cleaned.replace(unitsPerDoseMatch?.[0] ?? '', '');
    const stockMatch =
      stockSource.match(
        /\b(?:estoque(?: inicial)?|quantidade(?: atual)?|tenho)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(unidades?|comprimidos?|cápsulas?|caixas?|ml|gotas?)\b/i,
      ) ??
      stockSource.match(
        /\b(\d+(?:[.,]\d+)?)\s*(unidades?|comprimidos?|cápsulas?|caixas?|ml|gotas?)\s+(?:em estoque|disponíveis?)\b/i,
      ) ??
      stockSource.match(/\b(\d+(?:[.,]\d+)?)\s*(unidades?|comprimidos?|cápsulas?|caixas?|gotas?)\b/i);
    const doseSource = cleaned
      .replace(intervalMatch?.[0] ?? '', '')
      .replace(stockMatch?.[0] ?? '', '')
      .replace(unitsPerDoseMatch?.[0] ?? '', '');
    const doseMatch =
      doseSource.match(/\b(?:dose|dosagem)\s*[:\-]?\s*(\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|gotas?|comprimidos?|cápsulas?))/i) ??
      doseSource.match(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml)\b/i);
    const intervalRemoved = cleaned.replace(intervalMatch?.[0] ?? '', '');
    const timeMatch = intervalRemoved.match(
      /\b(?:[01]?\d|2[0-3])(?::[0-5]\d|h(?:[0-5]\d)?)\b/i,
    );
    const instructionsMatch =
      cleaned.match(/\b(?:instruções|orientações?)\s*[:\-]?\s*([^.;!?]+)/i) ??
      cleaned.match(/\b(tomar\s+[^.;!?]+)/i);
    const durationMatch =
      cleaned.match(/\b(?:por|durante)\s+(\d+(?:[.,]\d+)?)\s*(dias?|semanas?|meses?)\b/i) ??
      cleaned.match(/\bduraç(?:ão|ao)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*(dias?|semanas?|meses?)\b/i) ??
      cleaned.match(/\b(\d+(?:[.,]\d+)?)\s*(dias?|semanas?|meses?)\b/i);
    const startDateMatch = cleaned.match(
      /\b(?:início|iniciar|começar)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/i,
    );
    const endDateMatch = cleaned.match(
      /\b(?:término|fim|até)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/i,
    );
    const continuousMatch = cleaned.match(/\buso cont[ií]nuo\b|\bcont[ií]nu[oa]?\b/i);
    const duration = durationMatch
      ? `${durationMatch[1]} ${durationMatch[2].toLowerCase()}`
      : undefined;
    const toFormDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const [year, month, day] = value.split('-');
      return `${day}/${month}/${year}`;
    };

    const consumed = [
      intervalMatch?.[0],
      stockMatch?.[0],
      unitsPerDoseMatch?.[0],
      doseMatch?.[0],
      timeMatch?.[0],
      instructionsMatch?.[0],
      durationMatch?.[0],
      startDateMatch?.[0],
      endDateMatch?.[0],
      continuousMatch?.[0],
    ];
    const name = cleaned
      .replace(/^(?:oi|olá|cadastrar|adicionar|quero cadastrar|o remédio é)\s*/i, '')
      .replace(
        consumed.some(Boolean)
          ? new RegExp(consumed.filter(Boolean).map((value) => value!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi')
          : /$^/,
        ' ',
      )
      .replace(/\b(?:nome|medicamento|dose|dosagem|intervalo|frequência|frequencia|primeira dose|horário|horario|estoque inicial|estoque|quantidade atual|instruções|orientações|duração|duracao|início|iniciar|término|fim)\s*[:\-]?\s*/gi, '')
      .replace(/\b(?:às|as)\b/gi, ' ')
      .replace(/\b(?:estoque(?: inicial)?|quantidade(?: atual)?|tenho|em estoque|disponíveis?)\b\s*[:\-]?\s*/gi, '')
      .replace(/\b(?:de|em)\s*$/i, '')
      .replace(/\bdata\s+de\b/gi, ' ')
      .replace(/\buso cont[ií]nuo\b|\bcont[ií]nu[oa]?\b/gi, ' ')
      .replace(/[,:;.!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parsed: AssistantMedicationDraft = {};
    if (name && !/^(?:uso cont[ií]nuo|cont[ií]nu[oa]?)$/i.test(name)) parsed.name = name;
    if (doseMatch) parsed.dosage = doseMatch[1]?.trim() ?? doseMatch[0].trim();
    if (instructionsMatch) parsed.instructions = instructionsMatch[1]?.trim() ?? '';
    if (timeMatch) {
      parsed.firstTime = timeMatch[0].replace(/h/i, ':').replace(/:$/, ':00');
    }
    if (intervalMatch) {
      parsed.intervalHours = String(Number(intervalMatch[1].replace(',', '.')));
    }
    if (stockMatch) {
      parsed.stockQuantity = stockMatch[1].replace(',', '.');
      const unit = stockMatch[2].toLowerCase();
      parsed.stockUnit = STOCK_UNIT_LABELS[unit] ?? unit;
    }
    if (unitsPerDoseMatch) parsed.unitsPerDose = unitsPerDoseMatch[1].replace(',', '.');
    if (continuousMatch) parsed.continuous = true;
    if (duration) {
      parsed.duration = duration;
      if (!continuousMatch) parsed.continuous = false;
    }
    if (startDateMatch) parsed.startDate = toFormDate(startDateMatch[1]);
    if (endDateMatch) {
      parsed.endDate = toFormDate(endDateMatch[1]);
      if (!continuousMatch) parsed.continuous = false;
    }
    return parsed;
  };

  const mergeMedication = (
    current: AssistantMedicationDraft,
    update: AssistantMedicationDraft,
    overwrite = true,
  ): AssistantMedicationDraft => ({
    name: overwrite || !current.name ? update.name ?? current.name : current.name,
    dosage: overwrite || !current.dosage ? update.dosage ?? current.dosage : current.dosage,
    instructions: overwrite || !current.instructions
      ? update.instructions ?? current.instructions
      : current.instructions,
    firstTime: overwrite || !current.firstTime
      ? update.firstTime ?? current.firstTime
      : current.firstTime,
    intervalHours: overwrite || !current.intervalHours
      ? update.intervalHours ?? current.intervalHours
      : current.intervalHours,
    continuous: overwrite || current.continuous === undefined
      ? update.continuous ?? current.continuous
      : current.continuous,
    startDate: overwrite || !current.startDate
      ? update.startDate ?? current.startDate
      : current.startDate,
    endDate: overwrite || !current.endDate
      ? update.endDate ?? current.endDate
      : current.endDate,
    stockQuantity: overwrite || !current.stockQuantity
      ? update.stockQuantity ?? current.stockQuantity
      : current.stockQuantity,
    stockUnit: overwrite || !current.stockUnit
      ? update.stockUnit ?? current.stockUnit
      : current.stockUnit,
    unitsPerDose: overwrite || !current.unitsPerDose
      ? update.unitsPerDose ?? current.unitsPerDose
      : current.unitsPerDose,
    duration: overwrite || !current.duration
      ? update.duration ?? current.duration
      : current.duration,
  });

  const confirmCollection = () => onComplete(medication);

  const sendText = () => {
    const text = draft.trim();
    if (!text || isThinking) return;

    setDraft('');
    addMessage('user', text);
    setIsThinking(true);

    setTimeout(() => {
      const parsed = parseDemoMessage(text);
      const isUnknown = /^(pular|não sei|nao sei|não consta|nao consta)$/i.test(text);
      const hasParsedData = Object.keys(parsed).length > 0;
      const updatedMedication = mergeMedication(
        medication,
        isUnknown ? {} : parsed,
        !showConfirmation || isAdjusting,
      );
      setMedication(updatedMedication);

      if (showConfirmation) {
        if (isAdjusting && !hasParsedData && !isUnknown) {
          addMessage(
            'assistant',
            'Não consegui identificar o campo a ajustar. Informe o campo e o novo valor, por exemplo: dosagem: 50 mg.',
          );
        } else if (isAdjusting) {
          setIsAdjusting(false);
          addMessage('assistant', 'Cartão atualizado. Confira os dados antes de confirmar.');
        } else if (hasParsedData) {
          addMessage('assistant', 'Informação registrada no cartão de confirmação.');
        } else {
          addMessage('assistant', 'Para alterar um dado já preenchido, toque em Ajustar.');
        }
        setIsThinking(false);
        return;
      }

      const missingFields: string[] = [];
      if (!updatedMedication.name) missingFields.push('o nome do medicamento');
      if (!updatedMedication.dosage) missingFields.push('a dosagem');
      if (!updatedMedication.intervalHours) missingFields.push('o intervalo entre doses');

      if (missingFields.length > 0) {
        addMessage(
          'assistant',
          `Ainda não identifiquei ${missingFields.join(', ')}. Você pode informar agora ou confirmar e preencher depois no formulário.`,
        );
        setShowConfirmation(true);
        setIsThinking(false);
        return;
      }

      if (!updatedMedication.firstTime && conversationStep === 'medication') {
        setConversationStep('firstTime');
        addMessage(
          'assistant',
          'Qual é o horário da primeira dose? Você também pode confirmar e preencher esse campo depois.',
        );
        setShowConfirmation(true);
        setIsThinking(false);
        return;
      }

      setShowConfirmation(true);
      setIsThinking(false);
    }, 450);
  };


  const startRecording = async () => {
    try {
      setRecordingUri(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch (error) {
      Alert.alert(
        'Não foi possível gravar',
        'Confira a permissão de microfone do aplicativo e tente novamente.',
      );
    }
  };

  const stopRecording = async () => {
    try {
      await recorder.stop();
      setIsRecording(false);
      setRecordingUri(recorder.uri ?? null);
      addMessage(
        'user',
        '🎙 Áudio gravado. A transcrição e a leitura da receita serão conectadas à API do projeto.',
      );
      addMessage(
        'assistant',
        'Recebi a gravação nesta interface. A transcrição automática ainda não está conectada; por enquanto, escreva os dados da receita no campo de mensagem para testar a revisão.',
      );
    } catch (error) {
      setIsRecording(false);
      Alert.alert('Erro ao finalizar áudio', 'Tente gravar novamente.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Voltar">
          <ArrowLeft size={22} color={COLORS.dark} />
        </Pressable>
        <View style={styles.headerIcon}>
          <Sparkles size={19} color={COLORS.blue} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Assistente de medicamentos</Text>
          <Text style={styles.subtitle}>Ajuda para organizar a receita</Text>
        </View>
      </View>

      <View style={styles.notice}>
        <Bot size={18} color={COLORS.blue} />
        <Text style={styles.noticeText}>
          A IA ajuda a organizar as informações; você confere tudo antes de cadastrar.
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <View
              key={message.id}
              style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}
            >
              {!isUser && (
                <View style={styles.avatar}>
                  <Sparkles size={15} color={COLORS.blue} />
                </View>
              )}
              <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                <Text style={[styles.messageText, isUser && styles.userMessageText]}>
                  {message.text}
                </Text>
              </View>
            </View>
          );
        })}

        {showConfirmation && (
          <View style={[styles.messageRow, styles.assistantRow]}>
            <View style={styles.avatar}>
              <Sparkles size={15} color={COLORS.blue} />
            </View>
            <View style={styles.confirmationCard}>
              <Text style={styles.confirmationTitle}>CARTÃO DE CONFIRMAÇÃO</Text>
              <ConfirmationRow label="Medicamento" value={medication.name} />
              <ConfirmationRow label="Dosagem" value={medication.dosage} />
              <ConfirmationRow
                label="Intervalo"
                value={medication.intervalHours ? `${medication.intervalHours} horas` : undefined}
              />
              <ConfirmationRow label="Primeira dose" value={medication.firstTime} />
              <ConfirmationRow
                label="Estoque inicial"
                value={
                  medication.stockQuantity
                    ? `${medication.stockQuantity} ${medication.stockUnit ?? ''}`.trim()
                    : undefined
                }
              />
              <ConfirmationRow label="Duração" value={medication.duration} />
              {medication.continuous !== undefined && (
                <ConfirmationRow
                  label="Uso"
                  value={medication.continuous ? 'Contínuo' : 'Por período determinado'}
                />
              )}
              <View style={styles.confirmationActions}>
                <Pressable
                  style={styles.adjustButton}
                  onPress={() => {
                    setIsAdjusting(true);
                    addMessage(
                      'assistant',
                      'O que deseja ajustar? Escreva o campo e o novo valor, por exemplo: dosagem: 50 mg, primeira dose: 07h ou estoque inicial: 12 comprimidos.',
                    );
                  }}
                >
                  <Text style={styles.adjustButtonText}>Ajustar</Text>
                </Pressable>
                <Pressable
                  style={styles.confirmButton}
                  onPress={confirmCollection}
                >
                  <Text style={styles.confirmButtonText}>Confirmar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {isThinking && (
          <View style={[styles.messageRow, styles.assistantRow]}>
            <View style={styles.avatar}><Sparkles size={15} color={COLORS.blue} /></View>
            <View style={[styles.bubble, styles.assistantBubble]}>
              <Text style={styles.messageText}>Organizando as informações…</Text>
            </View>
          </View>
        )}

        {recordingUri && (
          <View style={styles.audioReady}>
            <Volume2 size={17} color={COLORS.green} />
            <Text style={styles.audioReadyText}>Áudio salvo temporariamente neste dispositivo.</Text>
            <Pressable onPress={() => setRecordingUri(null)} accessibilityLabel="Remover áudio">
              <X size={18} color={COLORS.muted} />
            </Pressable>
          </View>
        )}

      </ScrollView>

      <View style={styles.composerArea}>
        {isRecording && (
          <View style={styles.recordingBanner}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Gravando áudio… toque em parar quando terminar.</Text>
          </View>
        )}
        <View style={styles.composer}>
          <Pressable
            style={[styles.micButton, isRecording && styles.micRecording]}
            onPress={isRecording ? stopRecording : startRecording}
            accessibilityLabel={isRecording ? 'Parar gravação' : 'Gravar áudio'}
          >
            {isRecording
              ? <CircleStop size={22} color={COLORS.white} />
              : <Mic size={21} color={COLORS.blue} />}
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Descreva a receita..."
            placeholderTextColor="#8BA0AA"
            multiline
            maxLength={1200}
            returnKeyType="default"
            accessibilityLabel="Mensagem para o assistente"
          />
          <Pressable
            style={[styles.sendButton, !draft.trim() && styles.sendDisabled]}
            onPress={sendText}
            disabled={!draft.trim() || isThinking}
            accessibilityLabel="Enviar mensagem"
          >
            <Send size={18} color={COLORS.white} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 8, paddingBottom: 6 }}>
  <Text style={{ fontSize: 11, color: '#82939A' }}>
    Dica: informe nome, dosagem e intervalo entre doses.
  </Text>
  <Text style={{ fontSize: 12, color: '#267F91', marginTop: 2 }}>
    Ex.: Dipirona, 50 mg, a cada 8 horas
  </Text>
        </View>
        <Text style={styles.footerHint}>Use texto ou áudio. Confira os dados no formulário antes de salvar.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function ConfirmationRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.confirmationRow}>
      <Text style={styles.confirmationLabel}>{label}</Text>
      <Text style={styles.confirmationValue}>{value?.trim() || 'Não informado'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingBottom: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.bg,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.paleBlue,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: COLORS.dark, fontSize: 16, fontWeight: '800' },
  subtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  notice: {
    marginHorizontal: 14, marginTop: 12, marginBottom: 4, padding: 11,
    borderRadius: 14, backgroundColor: COLORS.paleBlue, flexDirection: 'row',
    alignItems: 'center', gap: 8,
  },
  noticeText: { color: COLORS.dark, fontSize: 12, lineHeight: 17, flex: 1 },
  chat: { flex: 1 },
  chatContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 18, gap: 13 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  assistantRow: { justifyContent: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  avatar: {
    width: 29, height: 29, borderRadius: 11, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  bubble: { maxWidth: '86%', borderRadius: 17, paddingHorizontal: 13, paddingVertical: 11 },
  assistantBubble: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderBottomLeftRadius: 5,
  },
  userBubble: { backgroundColor: COLORS.blue, borderBottomRightRadius: 5 },
  messageText: { color: COLORS.dark, fontSize: 14, lineHeight: 20 },
  userMessageText: { color: COLORS.white },
  audioReady: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.paleGreen,
    borderRadius: 12, padding: 11,
  },
  audioReadyText: { flex: 1, color: COLORS.green, fontSize: 12, lineHeight: 17 },
  confirmationCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 17,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  confirmationTitle: {
    color: COLORS.dark,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  confirmationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bg,
    paddingBottom: 7,
  },
  confirmationLabel: { color: COLORS.muted, fontSize: 12, flex: 1 },
  confirmationValue: { color: COLORS.dark, fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },
  confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  adjustButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  adjustButtonText: { color: COLORS.dark, fontSize: 12, fontWeight: '700' },
  confirmButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  confirmButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  composerArea: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  recordingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 5,
    paddingBottom: 9,
  },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D84949' },
  recordingText: { color: '#B33333', fontSize: 12, flex: 1 },
  composer: {
    minHeight: 52, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bg, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 5, gap: 7,
  },
  micButton: {
    width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  micRecording: { backgroundColor: '#D84949' },
  input: { flex: 1, minWidth: 0, maxHeight: 100, color: COLORS.dark, fontSize: 14, paddingVertical: 8 },
  sendButton: {
    width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.blue,
  },
  sendDisabled: { opacity: 0.45 },
  exampleHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 3,
},

exampleContainer: {
  marginHorizontal: 20,
  marginBottom: 6,
  paddingHorizontal: 12,
  paddingVertical: 10,
  backgroundColor: '#F3F8FA',
  borderRadius: 12,
},
exampleTitle: {
  fontSize: 13,
  fontWeight: '700',
  color: '#173746',
},
exampleText: {
  fontSize: 12,
  color: '#536B75',
  marginBottom: 4,
},
exampleExample: {
  fontSize: 13,
  fontWeight: '600',
  color: '#267F91',
  marginBottom: 4,
},
exampleHint: {
  fontSize: 11,
  color: '#82939A',
  lineHeight: 15,
},

  footerHint: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 8 },
});
