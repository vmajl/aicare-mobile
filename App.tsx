import React, { useMemo, useState } from 'react';
import {
  Bell, Clock, CalendarDays, Pill, UsersRound, Camera, MessageCircle, Plus, X,
  Search, Pencil, Trash2, Package, Sparkles, ArrowLeft, Bot, Mic, Send, Check,
  CircleStop,
} from 'lucide-react-native';
import {
  Alert, View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  StatusBar, Platform, useWindowDimensions, Switch, KeyboardAvoidingView,
} from 'react-native';
import MedicationAssistantScreen from './MedicationAssistantScreen';

const BLUE = '#50A9C3';
const DARK = '#102F40';
const MUTED = '#6D8794';
const BG = '#F4FAFC';
const BORDER = '#D8E3E8';
const PALE_BLUE = '#E8F6FA';

type Tab = 'Início' | 'Diário' | 'Medicamentos' | 'Pessoas';
type Medicine = {
  id: string;
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
  active: boolean;
  administered: boolean;
};
const emptyMedicine = () => ({
  name: '', dosage: '', instructions: '', firstTime: '08:00', intervalHours: '24',
  continuous: true, startDate: new Date().toISOString().slice(0, 10), endDate: '',
  stockQuantity: '', stockUnit: 'unidades', unitsPerDose: '1',
});
type MedicineDraft = ReturnType<typeof emptyMedicine>;
const tabs: { label: Tab }[] = [
  { label: 'Início' }, { label: 'Diário' }, { label: 'Medicamentos' }, { label: 'Pessoas' },
];

export default function App() {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const [activeTab, setActiveTab] = useState<Tab>('Início');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState('');
  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MedicineDraft>(emptyMedicine());
  const [showAssistant, setShowAssistant] = useState(false);

  const filteredMedicines = useMemo(() => medicines.filter((medicine) =>
    medicine.name.toLowerCase().includes(search.toLowerCase().trim())
  ), [medicines, search]);

  function updateDraft<K extends keyof MedicineDraft>(key: K, value: MedicineDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openNewMedicineForm() {
    setEditingId(null);
    setDraft(emptyMedicine());
    setShowMedicineForm(true);
    setShowAssistant(false);
    setActiveTab('Medicamentos');
  }

  function openAssistant() {
    setShowMedicineForm(false);
    setShowAssistant(true);
    setActiveTab('Medicamentos');
  }

  function openEditMedicine(medicine: Medicine) {
    setEditingId(medicine.id);
    setDraft({
      name: medicine.name, dosage: medicine.dosage, instructions: medicine.instructions,
      firstTime: medicine.firstTime, intervalHours: medicine.intervalHours,
      continuous: medicine.continuous, startDate: medicine.startDate, endDate: medicine.endDate,
      stockQuantity: medicine.stockQuantity, stockUnit: medicine.stockUnit,
      unitsPerDose: medicine.unitsPerDose,
    });
    setShowMedicineForm(true);
    setShowAssistant(false);
    setActiveTab('Medicamentos');
  }

  function saveMedicine() {
    const { name, dosage, firstTime, intervalHours, startDate, endDate, stockQuantity, unitsPerDose, continuous } = draft;
    if (!name.trim() || !dosage.trim() || !firstTime.trim() || !startDate.trim()) {
      Alert.alert('Campos obrigatórios', 'Informe nome, dosagem, primeiro horário e data de início.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(firstTime.trim())) {
      Alert.alert('Horário inválido', 'Use o formato HH:MM, por exemplo 08:00.');
      return;
    }
    const interval = Number(intervalHours);
    if (!Number.isFinite(interval) || interval < 1 || interval > 168) {
      Alert.alert('Intervalo inválido', 'Informe um intervalo entre 1 e 168 horas.');
      return;
    }
    if (!continuous && (!endDate.trim() || endDate < startDate)) {
      Alert.alert('Data de término', 'Informe uma data final igual ou posterior à data de início.');
      return;
    }
    if (stockQuantity.trim() && (!Number.isFinite(Number(stockQuantity)) || Number(stockQuantity) < 0)) {
      Alert.alert('Estoque inválido', 'A quantidade em estoque deve ser zero ou maior.');
      return;
    }
    if (!Number.isFinite(Number(unitsPerDose)) || Number(unitsPerDose) <= 0) {
      Alert.alert('Quantidade por dose inválida', 'Informe um valor maior que zero.');
      return;
    }
    const existing = editingId ? medicines.find((item) => item.id === editingId) : undefined;
    const saved: Medicine = {
      id: editingId ?? `${Date.now()}`,
      name: name.trim(), dosage: dosage.trim(), instructions: draft.instructions.trim(),
      firstTime: firstTime.trim(), intervalHours: String(interval),
      continuous, startDate, endDate: continuous ? '' : endDate,
      stockQuantity: stockQuantity.trim(), stockUnit: draft.stockUnit,
      unitsPerDose: String(Number(unitsPerDose)), active: existing?.active ?? true,
      administered: existing?.administered ?? false,
    };
    setMedicines((current) => editingId
      ? current.map((item) => item.id === editingId ? saved : item)
      : [...current, saved]
    );
    setDraft(emptyMedicine());
    setEditingId(null);
    setShowMedicineForm(false);
    setSearch('');
    Alert.alert('Medicamento salvo', 'O cadastro foi salvo nesta sessão do aplicativo.');
  }

  function deleteMedicine(medicine: Medicine) {
    Alert.alert('Excluir medicamento', `Deseja excluir ${medicine.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => {
        setMedicines((current) => current.filter((item) => item.id !== medicine.id));
      }},
    ]);
  }

  function toggleMedicine(id: string) {
    setMedicines((current) => current.map((medicine) =>
      medicine.id === id ? { ...medicine, administered: !medicine.administered } : medicine
    ));
  }

  function confirmAssistantMedication(data: { name: string; dose: string; schedule: string; instructions: string }) {
    const match = data.schedule.match(/(\d{1,2}:\d{2})/);
    const time = match?.[1] ?? '';
    if (!data.name.trim() || !data.dose.trim() || !time) {
      Alert.alert(
        'Confira os dados',
        'Para transferir ao cadastro, informe nome, dose e um primeiro horário no formato HH:MM. Você também pode continuar pelo formulário manual.',
      );
      return;
    }
    setEditingId(null);
    setDraft({
      ...emptyMedicine(),
      name: data.name.trim(),
      dosage: data.dose.trim(),
      firstTime: time,
      instructions: data.instructions.trim(),
      continuous: true,
    });
    setShowAssistant(false);
    setShowMedicineForm(true);
    setActiveTab('Medicamentos');
    Alert.alert('Dados transferidos', 'Revise os campos restantes e salve o medicamento no formulário.');
  }

  function Header() {
    return <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.notificationIcon}><Bell size={24} color="#FFFFFF" strokeWidth={2} /></View>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerEyebrow}>ACOMPANHAMENTO AICARE</Text>
          <Text style={styles.headerTitle}>Área do cuidador</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => { setShowAssistant(false); setActiveTab('Pessoas'); }} style={styles.userPill}>
        <Text style={styles.userName}>Maria</Text>
        <View style={styles.userAvatar}><Text style={styles.userAvatarText}>M</Text></View>
      </Pressable>
    </View>;
  }

  function MedicineCard({ medicine }: { medicine: Medicine }) {
    return <View style={styles.medicineCard}>
      <View style={styles.medicineInfo}>
        <Text style={styles.medicineName}>{medicine.name}</Text>
        <Text style={styles.bodyText}>{medicine.dosage}</Text>
        <Text style={styles.bodyText}>Horário inicial: {medicine.firstTime} · Intervalo: {medicine.intervalHours}h</Text>
        {!!medicine.instructions && <Text style={styles.smallDescription}>Instruções: {medicine.instructions}</Text>}
        <Text style={styles.smallDescription}>{medicine.continuous ? 'Uso contínuo' : `Até ${medicine.endDate}`}</Text>
        {!!medicine.stockQuantity && <Text style={styles.smallDescription}>Estoque: {medicine.stockQuantity} {medicine.stockUnit}</Text>}
        {!medicine.active && <Text style={styles.smallDescription}>Inativo</Text>}
      </View>
      <View style={styles.medicineActions}>
        <Text style={[styles.statusPill, medicine.administered && styles.statusDone]}>
          {medicine.administered ? 'Administrado' : 'Pendente'}
        </Text>
        <Pressable onPress={() => toggleMedicine(medicine.id)} style={styles.primarySmallButton}>
          <Text style={styles.primarySmallButtonText}>{medicine.administered ? 'Desfazer' : 'Administrar'}</Text>
        </Pressable>
        <View style={styles.iconActions}>
          <Pressable accessibilityLabel={`Editar ${medicine.name}`} onPress={() => openEditMedicine(medicine)} style={styles.iconButton}><Pencil size={17} color={BLUE} /></Pressable>
          <Pressable accessibilityLabel={`Excluir ${medicine.name}`} onPress={() => deleteMedicine(medicine)} style={styles.iconButton}><Trash2 size={17} color="#B54A4A" /></Pressable>
        </View>
      </View>
    </View>;
  }

  function EmptyMedicines({ title = 'Nenhum medicamento cadastrado' }: { title?: string } = {}) {
    return <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>Cadastre um medicamento para organizar horários e acompanhar o estoque.</Text>
    </View>;
  }

  function NewMedicineCard() {
    return <View style={styles.newMedicineCard}>
      <View style={styles.newMedicineText}>
        <View style={styles.rowTitle}><MessageCircle size={21} color={BLUE} strokeWidth={2} /><Text style={styles.cardTitle}>Novo medicamento</Text></View>
        <Text style={styles.smallDescription}>Cadastre por conversa com o assistente ou preencha manualmente.</Text>
        <Pressable onPress={openAssistant} style={styles.assistantLink}>
          <Sparkles size={16} color={BLUE} /><Text style={styles.assistantLinkText}>Conversar com o assistente</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Adicionar medicamento manualmente" onPress={openNewMedicineForm} style={styles.addButton}>
        <Plus size={23} color={DARK} strokeWidth={2} />
      </Pressable>
    </View>;
  }

  function Field({ label, value, onChangeText, placeholder, keyboardType = 'default' }: {
    label: string; value: string; onChangeText: (value: string) => void; placeholder: string;
    keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  }) {
    return <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={MUTED} style={styles.input} keyboardType={keyboardType} />
    </View>;
  }

  function MedicineForm() {
    if (!showMedicineForm) return null;
    return <View style={styles.formCard}>
      <View style={styles.formHeader}>
        <Text style={styles.cardTitle}>{editingId ? 'Editar medicamento' : 'Cadastrar medicamento'}</Text>
        <Pressable accessibilityLabel="Fechar formulário" onPress={() => { setShowMedicineForm(false); setEditingId(null); }} style={styles.iconButton}><X size={20} color={DARK} /></Pressable>
      </View>
      <Pressable onPress={openAssistant} style={styles.assistantBanner}>
        <Sparkles size={19} color={BLUE} />
        <View style={{ flex: 1 }}>
          <Text style={styles.assistantBannerTitle}>Quer ajuda com a receita?</Text>
          <Text style={styles.smallDescription}>Converse com o assistente ou grave um áudio.</Text>
        </View>
        <Text style={styles.assistantBannerArrow}>›</Text>
      </Pressable>
      {Field({label: 'Nome *', value: draft.name, onChangeText: (v: string) => updateDraft('name', v), placeholder: 'Ex.: Losartana'})}
      {Field({label: 'Dosagem *', value: draft.dosage, onChangeText: (v: string) => updateDraft('dosage', v), placeholder: 'Ex.: 50 mg'})}
      {Field({label: 'Instruções de uso', value: draft.instructions, onChangeText: (v: string) => updateDraft('instructions', v), placeholder: 'Ex.: Tomar com água após o café'})}
      {Field({label: 'Primeiro horário * (HH:MM)', value: draft.firstTime, onChangeText: (v: string) => updateDraft('firstTime', v), placeholder: '08:00'})}
      {Field({label: 'Intervalo entre doses (horas) *', value: draft.intervalHours, onChangeText: (v: string) => updateDraft('intervalHours', v), placeholder: '24', keyboardType: 'numeric'})}
      {Field({label: 'Data de início * (AAAA-MM-DD)', value: draft.startDate, onChangeText: (v: string) => updateDraft('startDate', v), placeholder: '2026-10-15'})}
      <View style={styles.switchRow}>
        <View style={styles.switchText}><Text style={styles.fieldLabel}>Uso contínuo</Text><Text style={styles.smallDescription}>Desative para informar uma data de término.</Text></View>
        <Switch value={draft.continuous} onValueChange={(v) => updateDraft('continuous', v)} trackColor={{ false: BORDER, true: '#A8DDE9' }} thumbColor={draft.continuous ? BLUE : '#F5F5F5'} />
      </View>
      {!draft.continuous && Field({label: 'Data de término * (AAAA-MM-DD)', value: draft.endDate, onChangeText: (v: string) => updateDraft('endDate', v), placeholder: '2026-11-15'})}
      <View style={styles.subsectionTitle}><Package size={18} color={BLUE} /><Text style={styles.cardTitle}>Estoque</Text></View>
      {Field({label: 'Quantidade atual (opcional)', value: draft.stockQuantity, onChangeText: (v: string) => updateDraft('stockQuantity', v), placeholder: 'Ex.: 30', keyboardType: 'decimal-pad'})}
      <Text style={styles.fieldLabel}>Unidade do estoque</Text>
      <View style={styles.unitOptions}>
        {['unidades', 'comprimidos', 'cápsulas', 'caixas', 'ml', 'gotas'].map((unit) =>
          <Pressable key={unit} onPress={() => updateDraft('stockUnit', unit)} style={[styles.unitChip, draft.stockUnit === unit && styles.unitChipActive]}>
            <Text style={[styles.unitChipText, draft.stockUnit === unit && styles.unitChipTextActive]}>{unit}</Text>
          </Pressable>
        )}
      </View>
      {Field({label: 'Unidades por dose', value: draft.unitsPerDose, onChangeText: (v: string) => updateDraft('unitsPerDose', v), placeholder: '1', keyboardType: 'decimal-pad'})}
      <Text style={styles.smallDescription}>Os dados ainda são demonstrativos e não são enviados para uma API.</Text>
      <View style={styles.formActions}>
        <Pressable onPress={() => { setShowMedicineForm(false); setEditingId(null); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancelar</Text></Pressable>
        <Pressable onPress={saveMedicine} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{editingId ? 'Salvar alterações' : 'Salvar medicamento'}</Text></Pressable>
      </View>
    </View>;
  }

  function HomeScreen() {
    return <>
      <View style={styles.pageHeading}><Text style={styles.pageKicker}>Acompanhamento AICare</Text><Text style={styles.pageTitle}>Hoje · Maria</Text></View>
      {medicines.length === 0 ? EmptyMedicines() : <View style={styles.summaryCard}><Text style={styles.summaryTitle}>{medicines.length} {medicines.length === 1 ? 'medicamento cadastrado' : 'medicamentos cadastrados'}</Text><Text style={styles.summaryDescription}>Acompanhe os horários e os registros de hoje.</Text></View>}
      <View style={styles.photoCard}>
        <View style={styles.rowTitle}><Camera size={21} color={BLUE} strokeWidth={2} /><View style={styles.photoText}><Text style={styles.cardTitle}>Registro de hoje</Text><Text style={styles.smallDescription}>Adicione uma foto de Maria ao diário compartilhado.</Text></View></View>
        <Pressable onPress={() => Alert.alert('Registro de hoje', 'A seleção de fotos será implementada em uma próxima etapa.')} style={styles.photoButton}><View style={styles.photoButtonContent}><Camera size={18} color="#FFFFFF" strokeWidth={2.3} /><Text style={styles.photoButtonText}>Registrar foto</Text></View></Pressable>
      </View>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Medicamentos de hoje</Text><Pressable onPress={() => setActiveTab('Medicamentos')}><Text style={styles.textLink}>Ver todos →</Text></Pressable></View>
      {medicines.length === 0 ? <View style={styles.noScheduleCard}><Text style={styles.bodyText}>Ainda não há horários para hoje.</Text></View> : medicines.map((medicine) => MedicineCard({ medicine }))}
      {NewMedicineCard()}{MedicineForm()}
    </>;
  }

  function MedicinesScreen() {
    return <>
      <View style={styles.pageHeading}><Text style={styles.pageKicker}>Acompanhamento AICare</Text><Text style={styles.pageTitle}>Medicamentos</Text><Text style={styles.smallDescription}>Cadastre e acompanhe os medicamentos de Maria.</Text></View>
      {!showMedicineForm && <Pressable onPress={openNewMedicineForm} style={styles.primaryButton}><Text style={styles.primaryButtonText}>+ Novo medicamento</Text></Pressable>}
      {!showMedicineForm && <Pressable onPress={openAssistant} style={styles.assistantEntry}><Sparkles size={19} color={BLUE} /><View style={{ flex: 1 }}><Text style={styles.assistantBannerTitle}>Assistente de medicamentos</Text><Text style={styles.smallDescription}>Descreva a receita por texto ou áudio.</Text></View><Text style={styles.assistantBannerArrow}>›</Text></Pressable>}
      {MedicineForm()}
      <View style={styles.searchWrap}><Search size={18} color={MUTED} /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar medicamento..." placeholderTextColor={MUTED} style={styles.searchInput} /></View>
      {filteredMedicines.length === 0 ? <View style={styles.noScheduleCard}><Text style={styles.bodyText}>{medicines.length === 0 ? 'Ainda não há medicamentos cadastrados.' : 'Nenhum medicamento encontrado.'}</Text></View> : filteredMedicines.map((medicine) => MedicineCard({ medicine }))}
    </>;
  }

  function DiaryScreen() {
    return <>
      <View style={styles.pageHeading}><Text style={styles.pageKicker}>Acompanhamento AICare</Text><Text style={styles.pageTitle}>Diário · Maria</Text></View>
      <View style={styles.photoCard}><View style={styles.rowTitle}><Camera size={21} color={BLUE} /><View style={styles.photoText}><Text style={styles.cardTitle}>Registro de hoje</Text><Text style={styles.smallDescription}>Adicione uma foto de Maria ao diário compartilhado.</Text></View></View>
        <Pressable onPress={() => Alert.alert('Diário', 'A seleção e o armazenamento de fotos serão implementados na próxima etapa.')} style={styles.photoButton}><View style={styles.photoButtonContent}><Camera size={18} color="#FFFFFF" /><Text style={styles.photoButtonText}>Registrar foto</Text></View></Pressable>
      </View>
      <View style={styles.noScheduleCard}><Text style={styles.bodyText}>Nenhuma foto registrada ainda.</Text></View>
    </>;
  }

  function PeopleScreen() {
    return <>
      <View style={styles.pageHeading}><Text style={styles.pageKicker}>Acompanhamento AICare</Text><Text style={styles.pageTitle}>Pessoas</Text></View>
      <View style={styles.personCard}><View style={styles.personAvatar}><Text style={styles.personAvatarText}>M</Text></View><View style={styles.medicineInfo}><Text style={styles.cardTitle}>Maria</Text><Text style={styles.smallDescription}>Paciente demonstrativa</Text></View></View>
      <View style={styles.noScheduleCard}><Text style={styles.emptyTitle}>Familiares e cuidadores</Text><Text style={styles.emptyDescription}>O compartilhamento e os convites serão implementados na próxima etapa.</Text></View>
    </>;
  }
    if (showAssistant) {
  return (
    <View style={styles.app}>
      <StatusBar backgroundColor={BG} barStyle="dark-content" translucent={false} />
      <MedicationAssistantScreen
        onBack={() => setShowAssistant(false)}
        onConfirmMedication={confirmAssistantMedication}
      />
    </View>
  );
}
  const ActiveScreen = activeTab === 'Medicamentos' ? MedicinesScreen : activeTab === 'Diário' ? DiaryScreen : activeTab === 'Pessoas' ? PeopleScreen : HomeScreen;

  return <View style={styles.app}>
    <StatusBar backgroundColor={BG} barStyle="dark-content" translucent={false} />
    {Header()}
    <ScrollView style={styles.mainScroll} contentContainerStyle={[styles.content, compact && styles.contentCompact]} keyboardShouldPersistTaps="handled">
      {ActiveScreen()}
      <Text style={styles.disclaimer}>AICare · TCC · Dados demonstrativos</Text>
    </ScrollView>
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.label;
        return <Pressable key={tab.label} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setShowAssistant(false); setActiveTab(tab.label); setSearch(''); }} style={[styles.bottomNavItem, selected && styles.bottomNavItemActive]}>
          {tab.label === 'Início' && <Clock size={25} color={selected ? BLUE : '#526F7B'} strokeWidth={2} />}
          {tab.label === 'Diário' && <CalendarDays size={25} color={selected ? BLUE : '#526F7B'} strokeWidth={2} />}
          {tab.label === 'Medicamentos' && <Pill size={25} color={selected ? BLUE : '#526F7B'} strokeWidth={2} />}
          {tab.label === 'Pessoas' && <UsersRound size={25} color={selected ? BLUE : '#526F7B'} strokeWidth={2} />}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[styles.bottomNavLabel, selected && styles.bottomNavLabelActive]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === 'ios' ? 44 : 0 },
  header: { minHeight: 87, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: BG, borderTopWidth: 1, borderTopColor: '#D9E6EB', borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  notificationIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, minWidth: 0 },
  headerEyebrow: { color: DARK, fontSize: 10, letterSpacing: 0.2, fontWeight: '500' },
  headerTitle: { color: DARK, fontSize: 16, fontWeight: '800', marginTop: 2 },
  userPill: { backgroundColor: BLUE, borderRadius: 10, paddingLeft: 13, paddingRight: 5, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 9 },
  userName: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  userAvatar: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#E6F5F9', alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: BLUE, fontSize: 13, fontWeight: '800' },
  mainScroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 22, gap: 24 },
  contentCompact: { paddingHorizontal: 18, paddingTop: 20, gap: 20 },
  pageHeading: { gap: 4 },
  pageKicker: { color: DARK, fontSize: 12 },
  pageTitle: { color: '#0A293A', fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  summaryCard: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, padding: 17, gap: 8 },
  summaryTitle: { color: DARK, fontSize: 17, fontWeight: '800' },
  summaryDescription: { color: MUTED, fontSize: 15, lineHeight: 22 },
  emptyCard: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, padding: 17, gap: 8 },
  emptyTitle: { color: '#152F3E', fontSize: 16, fontWeight: '800' },
  emptyDescription: { color: MUTED, fontSize: 15, lineHeight: 22 },
  photoCard: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, padding: 17, gap: 17 },
  rowTitle: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  photoText: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { color: '#102F40', fontSize: 16, fontWeight: '800' },
  smallDescription: { color: MUTED, fontSize: 12, lineHeight: 19 },
  photoButton: { minHeight: 48, borderRadius: 8, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  photoButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: -12 },
  sectionTitle: { color: DARK, fontSize: 17, fontWeight: '800' },
  textLink: { color: BLUE, fontSize: 12, fontWeight: '800' },
  noScheduleCard: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, padding: 17 },
  bodyText: { color: MUTED, fontSize: 14, lineHeight: 21 },
  newMedicineCard: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, padding: 9, paddingLeft: 17, flexDirection: 'row', alignItems: 'center', gap: 10 },
  newMedicineText: { flex: 1, minWidth: 0, gap: 5, paddingVertical: 7 },
  addButton: { width: 48, height: 48, borderRadius: 8, backgroundColor: PALE_BLUE, alignItems: 'center', justifyContent: 'center' },
  formCard: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, padding: 16, gap: 12 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  field: { gap: 6 },
  fieldLabel: { color: DARK, fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 12, color: DARK, fontSize: 14 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, borderColor: BORDER, borderWidth: 1, borderRadius: 8, backgroundColor: '#FFFFFF', paddingLeft: 13 },
  searchInput: { flex: 1, paddingHorizontal: 0, paddingVertical: 12, color: DARK, fontSize: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  switchText: { flex: 1, gap: 3 },
  subsectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  unitOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  unitChip: { borderWidth: 1, borderColor: BORDER, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  unitChipActive: { borderColor: BLUE, backgroundColor: PALE_BLUE },
  unitChipText: { color: MUTED, fontSize: 12 },
  unitChipTextActive: { color: DARK, fontWeight: '700' },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  primaryButton: { backgroundColor: BLUE, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  secondaryButton: { backgroundColor: PALE_BLUE, borderRadius: 8, paddingVertical: 13, paddingHorizontal: 15, alignItems: 'center' },
  secondaryButtonText: { color: DARK, fontSize: 13, fontWeight: '700' },
  disclaimer: { color: '#8B9AA3', fontSize: 10, textAlign: 'center', marginTop: 4 },
  medicineCard: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  medicineInfo: { flex: 1, minWidth: 0, gap: 4 },
  medicineName: { color: DARK, fontSize: 15, fontWeight: '800' },
  medicineActions: { alignItems: 'flex-end', gap: 7 },
  statusPill: { color: DARK, backgroundColor: '#FFF0D6', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, overflow: 'hidden' },
  statusDone: { backgroundColor: '#DDF4E8' },
  primarySmallButton: { backgroundColor: PALE_BLUE, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 8 },
  primarySmallButtonText: { color: '#176780', fontSize: 11, fontWeight: '800' },
  iconActions: { flexDirection: 'row', gap: 5 },
  iconButton: { padding: 7, borderRadius: 7, backgroundColor: PALE_BLUE },
  personCard: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  personAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: PALE_BLUE, alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { color: BLUE, fontSize: 15, fontWeight: '800' },
  bottomNav: { backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 8, marginHorizontal: 24, marginBottom: Platform.OS === 'ios' ? 16 : 10, padding: 8, flexDirection: 'row', alignItems: 'stretch', gap: 4 },
  bottomNavItem: { flex: 1, minWidth: 0, minHeight: 66, borderRadius: 7, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2 },
  bottomNavItemActive: { backgroundColor: PALE_BLUE },
  bottomNavLabel: { color: DARK, fontSize: 11, textAlign: 'center', flexShrink: 0, includeFontPadding: false },
  bottomNavLabelActive: { color: BLUE, fontWeight: '700' },
  assistantLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingVertical: 5 },
  assistantLinkText: { color: BLUE, fontSize: 12, fontWeight: '800' },
  assistantBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#C7E7EF', backgroundColor: PALE_BLUE, marginBottom: 2 },
  assistantEntry: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#C7E7EF', backgroundColor: '#FFFFFF' },
  assistantBannerTitle: { color: DARK, fontSize: 13, fontWeight: '800' },
  assistantBannerArrow: { color: BLUE, fontSize: 25, fontWeight: '400', paddingHorizontal: 3 },
});
