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
  Check,
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

type ExtractedMedication = {
  name: string;
  dose: string;
  schedule: string;
  instructions: string;
};

type Props = {
  onBack: () => void;
  onConfirmMedication?: (medication: ExtractedMedication) => void;
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
    text: 'Oi! Sou o assistente de medicamentos do AICare. Você pode me contar o nome do remédio, a dosagem e o horário de uso. Vou organizar as informações para você revisar antes de cadastrar.',
  },
];

const EMPTY_MEDICATION: ExtractedMedication = {
  name: '',
  dose: '',
  schedule: '',
  instructions: '',
};

export default function MedicationAssistantScreen({
  onBack,
  onConfirmMedication,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [medication, setMedication] =
    useState<ExtractedMedication>(EMPTY_MEDICATION);
  const [isThinking, setIsThinking] = useState(false);
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

  const parseDemoMessage = (text: string): ExtractedMedication => {
    // Frontend-only demonstration. The Python API will replace this parser later.
    const lower = text.toLowerCase();
    const doseMatch = text.match(/\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|g|ml|mL| gotas?| comprimidos?| cápsulas?)\b/i);
    const timeWords = text.match(/(?:às?\s*)?\b(?:\d{1,2}(?::\d{2})?\s?h|manhã|tarde|noite|ao deitar|em jejum|a cada \d+ horas?)\b/i);
    const name = text
      .replace(/^(oi|olá|cadastrar|adicionar|quero cadastrar|o remédio é)\s*/i, '')
      .split(/[,.!?]/)[0]
      .trim();

    return {
      name: name.length > 0 ? name : '',
      dose: doseMatch?.[0]?.trim() ?? '',
      schedule: timeWords?.[0]?.trim() ?? '',
      instructions: '',
    };
  };

  const sendText = () => {
    const text = draft.trim();
    if (!text || isThinking) return;
    setDraft('');
    addMessage('user', text);
    setIsThinking(true);

    // Mock response so the interface can be tested before the backend exists.
    setTimeout(() => {
      const extracted = parseDemoMessage(text);
      setMedication((current) => ({
        name: current.name || extracted.name,
        dose: current.dose || extracted.dose,
        schedule: current.schedule || extracted.schedule,
        instructions: current.instructions,
      }));
      setShowReview(true);
      setIsThinking(false);
      addMessage(
        'assistant',
        'Organizei uma primeira versão para você revisar. Esta tela ainda está em modo de demonstração: confira cada campo com a receita. Se faltar dose ou horário, não vou inventar essa informação.',
      );
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

  const updateMedication = (key: keyof ExtractedMedication, value: string) => {
    setMedication((current) => ({ ...current, [key]: value }));
  };

  const confirmMedication = () => {
    if (!medication.name.trim()) {
      Alert.alert('Falta o nome', 'Informe o nome do medicamento antes de continuar.');
      return;
    }
    if (!medication.dose.trim() || !medication.schedule.trim()) {
      Alert.alert(
        'Confira a receita',
        'Preencha a dose e o horário conforme a receita. Não confirme informações que não estejam claras.',
      );
      return;
    }
    onConfirmMedication?.(medication);
    addMessage('assistant', 'Revisão concluída. O próximo passo será enviar os dados confirmados para a API e salvar o medicamento.');
    setShowReview(false);
    Alert.alert(
      'Dados revisados',
      onConfirmMedication
        ? 'Os dados foram enviados para a função de confirmação do aplicativo.'
        : 'A interface está pronta. A gravação no cadastro será ligada à API do backend.',
    );
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

        {showReview && (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View>
                <Text style={styles.reviewTitle}>Revise os dados</Text>
                <Text style={styles.reviewSubtitle}>Confirme com a receita original</Text>
              </View>
              <View style={styles.reviewBadge}><Text style={styles.reviewBadgeText}>Rascunho</Text></View>
            </View>
            <Field label="Nome do medicamento" value={medication.name} onChangeText={(v) => updateMedication('name', v)} placeholder="Ex.: Losartana" />
            <Field label="Dose / quantidade" value={medication.dose} onChangeText={(v) => updateMedication('dose', v)} placeholder="Ex.: 50 mg" />
            <Field label="Horário / frequência" value={medication.schedule} onChangeText={(v) => updateMedication('schedule', v)} placeholder="Ex.: às 8h, 1 vez ao dia" />
            <Field label="Orientações (opcional)" value={medication.instructions} onChangeText={(v) => updateMedication('instructions', v)} placeholder="Ex.: tomar após o café" multiline />
            <View style={styles.reviewActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setShowReview(false)}>
                <X size={16} color={COLORS.dark} />
                <Text style={styles.secondaryButtonText}>Editar depois</Text>
              </Pressable>
              <Pressable style={styles.confirmButton} onPress={confirmMedication}>
                <Check size={17} color={COLORS.white} />
                <Text style={styles.confirmButtonText}>Confirmar dados</Text>
              </Pressable>
            </View>
            <Text style={styles.safetyText}>Não confirme dose, frequência ou horário se não estiverem claros na receita.</Text>
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
        <Text style={styles.footerHint}>Use texto ou áudio. Revise os dados antes de salvar.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8BA0AA"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
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
  reviewCard: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 15,
    borderWidth: 1, borderColor: COLORS.border, marginTop: 4,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 },
  reviewTitle: { color: COLORS.dark, fontSize: 16, fontWeight: '800' },
  reviewSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  reviewBadge: { backgroundColor: '#FFF3D8', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  reviewBadgeText: { color: '#876019', fontSize: 11, fontWeight: '700' },
  field: { marginBottom: 10 },
  fieldLabel: { color: COLORS.dark, fontSize: 12, fontWeight: '700', marginBottom: 5 },
  fieldInput: {
    minHeight: 43, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: '#FBFDFE', paddingHorizontal: 11, paddingVertical: 9,
    color: COLORS.dark, fontSize: 14,
  },
  multilineInput: { minHeight: 64 },
  reviewActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  secondaryButton: {
    flex: 1, minHeight: 43, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  secondaryButtonText: { color: COLORS.dark, fontSize: 12, fontWeight: '700' },
  confirmButton: {
    flex: 1.2, minHeight: 43, borderRadius: 12, backgroundColor: COLORS.blue,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  confirmButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },
  safetyText: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 10 },
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
  footerHint: { color: COLORS.muted, fontSize: 10, textAlign: 'center', marginTop: 8 },
});