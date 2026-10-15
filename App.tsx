
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  useWindowDimensions,
  StatusBar,
  Platform,
} from 'react-native';

const BLUE = '#7DC8DF';
const DARK = '#183B4E';
const MUTED = '#718391';
const BG = '#F4F8FA';

const menu = [
  { icon: '⌂', label: 'Visão geral' },
  { icon: '＋', label: 'Medicamentos' },
  { icon: '▦', label: 'Calendário' },
  { icon: '♡', label: 'Paciente' },
  { icon: '♧', label: 'Familiares' },
];

const initialMedicines = [
  { id: '1', name: 'Losartana', dose: '50 mg', time: '08:00', status: 'Pendente' },
  { id: '2', name: 'Metformina', dose: '850 mg', time: '12:00', status: 'Pendente' },
  { id: '3', name: 'Vitamina D', dose: '1 cápsula', time: '20:00', status: 'Agendado' },
];

export default function App() {
  const { width } = useWindowDimensions();
  const desktop = width >= 800;
  const compact = width < 480;

  const [active, setActive] = useState('Visão geral');
  const [search, setSearch] = useState('');
  const [medicines, setMedicines] = useState(initialMedicines);

  function markAdministered(id: string) {
    setMedicines(current =>
      current.map(med =>
        med.id === id
          ? { ...med, status: med.status === 'Administrado' ? 'Pendente' : 'Administrado' }
          : med
      )
    );
  }

  const filteredMedicines = medicines.filter(med =>
    med.name.toLowerCase().includes(search.toLowerCase())
  );

  function MedicineList() {
    return (
      <View style={styles.list}>
        <TextInput
          placeholder="Buscar medicamento..."
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
          style={styles.input}
        />

        {filteredMedicines.map(med => (
          <View key={med.id} style={styles.medicineCard}>
            <View style={styles.medicineInfo}>
              <Text style={styles.medicineName}>{med.name}</Text>
              <Text style={styles.muted}>{med.dose}</Text>
              <Text style={styles.muted}>Horário: {med.time}</Text>
            </View>

            <View style={styles.statusArea}>
              <Text style={[
                styles.status,
                med.status === 'Administrado' && styles.done,
              ]}>
                {med.status}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => markAdministered(med.id)}
                style={styles.smallButton}
              >
                <Text style={styles.smallButtonText}>
                  {med.status === 'Administrado' ? 'Desfazer' : 'Administrar'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {filteredMedicines.length === 0 && (
          <Text style={styles.muted}>Nenhum medicamento encontrado.</Text>
        )}

        <Text style={styles.disclaimer}>
          Dados demonstrativos. Os registros não são salvos permanentemente.
        </Text>
      </View>
    );
  }

  function ScreenContent() {
    if (active === 'Medicamentos') {
      return (
        <>
          <Text style={styles.heading}>Medicamentos</Text>
          <Text style={styles.subtitle}>
            Consulte os horários e marque as doses administradas.
          </Text>
          <MedicineList />
        </>
      );
    }

    if (active === 'Calendário') {
      return (
        <>
          <Text style={styles.heading}>Calendário</Text>
          <Text style={styles.subtitle}>
            Programação diária de medicamentos.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hoje</Text>
            {medicines.map(med => (
              <View key={med.id} style={styles.calendarRow}>
                <Text style={styles.time}>{med.time}</Text>
                <View style={styles.medicineInfo}>
                  <Text style={styles.medicineName}>{med.name}</Text>
                  <Text style={styles.muted}>{med.dose}</Text>
                </View>
                <Text style={styles.muted}>{med.status}</Text>
              </View>
            ))}
          </View>
        </>
      );
    }

    if (active === 'Paciente') {
      return (
        <>
          <Text style={styles.heading}>Paciente</Text>
          <View style={styles.card}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientAvatarText}>C</Text>
            </View>
            <Text style={styles.patientName}>Creusa</Text>
            <Text style={styles.muted}>Perfil demonstrativo da paciente</Text>
            <View style={styles.separator} />
            <Text style={styles.cardTitle}>Informações</Text>
            <Text style={styles.muted}>
              Os dados pessoais poderão ser cadastrados na próxima etapa.
            </Text>
          </View>
        </>
      );
    }

    if (active === 'Familiares') {
      return (
        <>
          <Text style={styles.heading}>Familiares</Text>
          <Text style={styles.subtitle}>
            Área de acompanhamento compartilhado.
          </Text>
          <View style={styles.card}>
            <View style={styles.familyAvatar}>
              <Text style={styles.avatarText}>C</Text>
            </View>
            <Text style={styles.cardTitle}>Cuidador</Text>
            <Text style={styles.muted}>Conta demonstrativa</Text>
            <View style={styles.separator} />
            <Text style={styles.muted}>
              O convite de familiares e o controle de acesso serão implementados
              em uma próxima etapa.
            </Text>
          </View>
        </>
      );
    }

    return (
      <>
        <View style={styles.greeting}>
          <View style={styles.greetingText}>
            <Text style={styles.eyebrow}>PAINEL DE CUIDADOS</Text>
            <Text style={styles.heading}>Olá, cuidador!</Text>
            <Text style={styles.subtitle}>
              Acompanhe a rotina de cuidados de hoje.
            </Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>Hoje</Text>
          </View>
        </View>

        <Pressable
          onPress={() => setActive('Paciente')}
          style={styles.patientCard}
        >
          <View style={styles.patientAvatar}>
            <Text style={styles.patientAvatarText}>C</Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.eyebrow}>PACIENTE SELECIONADA</Text>
            <Text style={styles.patientName}>Creusa</Text>
            <Text style={styles.muted}>Perfil demonstrativo</Text>
          </View>
          <Text style={styles.patientHeart}>♡</Text>
        </Pressable>

        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Medicamentos</Text>
            <Text style={styles.statValue}>{medicines.length}</Text>
            <Text style={styles.muted}>Na programação</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statTitle}>Administrados</Text>
            <Text style={styles.statValue}>
              {medicines.filter(m => m.status === 'Administrado').length}
            </Text>
            <Text style={styles.muted}>Doses registradas</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.medicineInfo}>
            <Text style={styles.cardTitle}>Medicamentos de hoje</Text>
            <Text style={styles.muted}>Confira os registros.</Text>
          </View>
          <Pressable
            onPress={() => setActive('Medicamentos')}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>Ver todos →</Text>
          </Pressable>
        </View>

        <MedicineList />

        <View style={styles.footerNote}>
          <Text style={styles.patientHeart}>♡</Text>
          <View style={styles.medicineInfo}>
            <Text style={styles.cardTitle}>Cuidado compartilhado</Text>
            <Text style={styles.muted}>
              Uma rotina organizada ajuda familiares e cuidadores.
            </Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <View style={styles.app}>
      <StatusBar backgroundColor="#FFFFFF" barStyle="dark-content" translucent={false} />

      <View style={[styles.topbar, !desktop && styles.topbarMobile, compact && styles.topbarCompact]}>
        <View style={styles.brand}>
          <View style={[styles.logo, !desktop && styles.logoMobile]}>
            <Text style={[styles.logoText, !desktop && styles.logoTextMobile]}>A</Text>
          </View>
          <View>
            <Text style={[styles.brandName, !desktop && styles.brandNameMobile]}>AICare</Text>
            <Text style={[styles.brandSub, !desktop && styles.brandSubMobile]}>Cuidado conectado</Text>
          </View>
        </View>

        {desktop && (
          <View style={styles.profile}>
            <Text style={styles.profileName}>Cuidador</Text>
            <Text style={styles.brandSub}>Conta demonstrativa</Text>
          </View>
        )}
      </View>

      <View style={[styles.body, !desktop && styles.bodyMobile]}>
        {desktop && (
          <View style={styles.sidebar}>
            <Text style={styles.sectionLabel}>MENU PRINCIPAL</Text>
            {menu.map(item => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={() => {
                  setActive(item.label);
                  setSearch('');
                }}
                style={[
                  styles.menuItem,
                  active === item.label && styles.menuActive,
                ]}
              >
                <Text style={[
                  styles.menuIcon,
                  active === item.label && styles.menuTextActive,
                ]}>
                  {item.icon}
                </Text>
                <Text style={[
                  styles.menuText,
                  active === item.label && styles.menuTextActive,
                ]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
            <View style={styles.sidebarBottom}>
              <Text style={styles.cardTitle}>Precisa de ajuda?</Text>
              <Text style={styles.muted}>
                Estamos aqui para apoiar você nos cuidados.
              </Text>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.main}
          contentContainerStyle={[styles.content, !desktop && styles.contentMobile, compact && styles.contentCompact]}
          keyboardShouldPersistTaps="handled"
        >
          {!desktop && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={[styles.mobileMenu, compact && styles.mobileMenuCompact]}
            >
              {menu.map(item => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  onPress={() => {
                    setActive(item.label);
                    setSearch('');
                  }}
                  style={[
                    styles.mobileMenuItem,
                    active === item.label && styles.mobileMenuActive,
                  ]}
                >
                  <Text style={[
                    styles.mobileMenuText,
                    active === item.label && styles.menuTextActive,
                  ]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <ScreenContent />
          <Text style={styles.disclaimer}>AICare · TCC · Dados fictícios</Text>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === 'ios' ? 48 : 0 },
  topbar: {
    minHeight: 76,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topbarMobile: {
    minHeight: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 7 : 8,
  },
  topbarCompact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 5 : 6,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  logoMobile: { width: 34, height: 34, borderRadius: 10 },
  logoTextMobile: { fontSize: 19 },
  brandNameMobile: { fontSize: 17 },
  brandSubMobile: { fontSize: 10, marginTop: 1 },
  logo: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: DARK, fontWeight: '800', fontSize: 24 },
  brandName: { color: DARK, fontWeight: '800', fontSize: 20 },
  brandSub: { color: MUTED, fontSize: 11, marginTop: 3 },
  profile: { alignItems: 'flex-end' },
  profileName: { color: DARK, fontSize: 13, fontWeight: '700' },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  bodyMobile: { flexDirection: 'column' },
  sidebar: {
    width: 238,
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E8EEF1',
    paddingHorizontal: 17,
    paddingTop: 30,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: 12,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 11,
    marginBottom: 5,
  },
  menuActive: { backgroundColor: '#E8F6FA' },
  menuIcon: { color: MUTED, fontSize: 19, width: 22, textAlign: 'center' },
  menuText: { color: '#566C7A', fontSize: 13 },
  menuTextActive: { color: '#176780', fontWeight: '700' },
  sidebarBottom: {
    marginTop: 'auto',
    marginBottom: 24,
    padding: 15,
    backgroundColor: '#F0F9FB',
    borderRadius: 12,
  },
  main: { flex: 1, minWidth: 0 },
  content: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  contentMobile: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 24,
  },
  contentCompact: {
    paddingHorizontal: 11,
    paddingTop: 7,
  },
  mobileMenu: { marginBottom: 16, flexGrow: 0 },
  mobileMenuCompact: { marginBottom: 14 },
  mobileMenuItem: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginRight: 7,
    backgroundColor: '#FFFFFF',
  },
  mobileMenuItemCompact: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 9,
    marginRight: 6,
  },
  mobileMenuActive: { backgroundColor: '#DDF2F8' },
  mobileMenuText: { color: MUTED, fontSize: 12, fontWeight: '600' },
  mobileMenuTextCompact: { fontSize: 11 },
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  greetingText: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: '#688594',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 8,
  },
  heading: {
    color: DARK,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: { color: MUTED, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  dateBadge: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5ECEF',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dateText: { color: DARK, fontSize: 12, fontWeight: '600' },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E6EEF1',
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 14,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  patientAvatarText: { fontSize: 18, color: '#34778D', fontWeight: '800' },
  patientInfo: { flex: 1, minWidth: 0 },
  patientName: { color: DARK, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  patientHeart: { color: '#65B8CE', fontSize: 25 },
  stats: { flexDirection: 'row', gap: 9, marginBottom: 18, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 135,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EEF1',
    padding: 12,
    marginBottom: 4,
  },
  statTitle: { color: MUTED, fontSize: 11 },
  statValue: { color: DARK, fontSize: 23, fontWeight: '800', marginTop: 7 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 15,
  },
  cardTitle: { color: DARK, fontSize: 15, fontWeight: '800', marginBottom: 5 },
  linkButton: { paddingVertical: 8, paddingHorizontal: 10 },
  linkText: { color: '#287C96', fontSize: 12, fontWeight: '700' },
  list: { gap: 10, marginBottom: 20 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EEF1',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: DARK,
    marginBottom: 4,
  },
  medicineCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EEF1',
    borderRadius: 13,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  medicineInfo: { flex: 1, minWidth: 90 },
  medicineName: { color: DARK, fontSize: 14, fontWeight: '700', marginBottom: 5 },
  muted: { color: MUTED, fontSize: 12, lineHeight: 18 },
  statusArea: { alignItems: 'flex-end', gap: 7 },
  status: {
    color: DARK,
    backgroundColor: '#FFF0D6',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 10,
    overflow: 'hidden',
  },
  done: { backgroundColor: '#DDF4E8' },
  smallButton: {
    backgroundColor: '#E8F6FA',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  smallButtonText: { color: '#176780', fontSize: 11, fontWeight: '700' },
  time: { color: '#287C96', fontSize: 13, fontWeight: '800', marginRight: 8 },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EEF1',
    gap: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6EEF1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  familyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: DARK, fontWeight: '700' },
  separator: {
    height: 1,
    backgroundColor: '#E8EEF1',
    marginVertical: 16,
  },
  footerNote: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    backgroundColor: '#E8F6FA',
    padding: 18,
    borderRadius: 13,
    marginTop: 12,
  },
  disclaimer: {
    color: '#8B9AA3',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 20,
  },
});
