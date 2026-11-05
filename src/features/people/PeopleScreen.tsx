
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  Share,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../../utils/platformAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthContext';
import { router } from 'expo-router';
import { usePatient } from '../patients/PatientContext';

const BLUE = '#50A9C3';
const DARK = '#102F40';
const MUTED = '#6D8794';
const BORDER = '#D8E3E8';
const PALE_BLUE = '#E8F6FA';

const STORAGE_KEY = '@aicare:people-invites';
const LEGACY_FAMILY_ID = 'aicare-legacy-family';

type InviteRole = 'Familiar' | 'Administrador';

type InviteStatus =
  | 'Pendente'
  | 'Revogado'
  | 'accepted'
  | 'aceito'
  | 'utilizado'
  | 'used';

type Invite = {
  id: string;
  code: string;
  role: InviteRole;
  createdAt: string;
  expiresAt: string;
  status: InviteStatus;
  name: string;
  familyId?: string;
};

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'AIC-';

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

const isExpired = (date: string) => {
  return new Date(date).getTime() < Date.now();
};

const normalizeStatus = (status: string) =>
  status.trim().toLowerCase();

export default function PeopleScreen() {
  const { user, logout } = useAuth();

  // Mantém todos os convites armazenados, mas exibe apenas
  // os convites pertencentes à família da conta conectada.
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] =
    useState<InviteRole>('Familiar');
  const [inviteName, setInviteName] = useState('');
  const [saving, setSaving] = useState(false);

  const currentFamilyId = user?.familyId ?? LEGACY_FAMILY_ID;

  useEffect(() => {
    loadInvites();
  }, []);

  const loadInvites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed: Invite[] = JSON.parse(stored);
        setInvites(Array.isArray(parsed) ? parsed : []);
      } else {
        setInvites([]);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os convites.');
    } finally {
      setLoading(false);
    }
  };
const { patient, loading: patientLoading } = usePatient();

const patientInitial = patient?.name?.trim().charAt(0).toUpperCase() || '?';
  const saveInvites = async (updated: Invite[]) => {
    // Salva a lista completa para preservar convites de outras famílias.
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setInvites(updated);
  };

  const familyInvites = invites.filter(
    (invite) =>
      (invite.familyId ?? LEGACY_FAMILY_ID) === currentFamilyId,
  );

  const handleLogout = () => {
    Alert.alert(
      'Sair da conta',
      'Deseja realmente encerrar sua sessão?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/(auth)/login');
            } catch {
              Alert.alert(
                'Erro',
                'Não foi possível encerrar sua sessão.',
              );
            }
          },
        },
      ],
    );
  };

  const createInvite = async () => {
    if (saving) return;

    if (!user?.familyId) {
      Alert.alert(
        'Acompanhamento não identificado',
        'Não foi possível identificar a família desta conta. Entre novamente no aplicativo.',
      );
      return;
    }

    setSaving(true);

    try {
      let code = generateCode();

      while (invites.some((invite) => invite.code === code)) {
        code = generateCode();
      }

      const now = new Date();
      const expiration = new Date();
      expiration.setDate(expiration.getDate() + 7);

      const newInvite: Invite = {
        id: `${Date.now()}`,
        code,
        role: selectedRole,
        name: inviteName.trim(),
        createdAt: now.toISOString(),
        expiresAt: expiration.toISOString(),
        status: 'Pendente',

        // Vincula o convite à família que o criou.
        familyId: user.familyId,
      };

      await saveInvites([newInvite, ...invites]);

      setModalVisible(false);
      setInviteName('');
      setSelectedRole('Familiar');

      Alert.alert(
        'Convite criado',
        `Código: ${code}\n\nCompartilhe esse código com a pessoa convidada.`,
        [
          { text: 'Fechar' },
          {
            text: 'Compartilhar',
            onPress: () => shareInvite(newInvite),
          },
        ],
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível criar o convite.');
    } finally {
      setSaving(false);
    }
  };

  const shareInvite = async (invite: Invite) => {
    try {
      await Share.share({
        message:
          `Você foi convidado(a) para participar do AICare!\n\n` +
          `Tipo de acesso: ${invite.role}\n` +
          `Código de convite: ${invite.code}\n\n` +
          `Validade: até ${formatDate(invite.expiresAt)}.\n\n` +
          `Utilize esse código no aplicativo AICare para solicitar acesso.`,
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o convite.');
    }
  };

  const revokeInvite = (invite: Invite) => {
    Alert.alert(
      'Revogar convite',
      `Deseja realmente revogar o código ${invite.code}? Ele não deverá mais ser utilizado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: async () => {
            const updated = invites.map((item) =>
              item.id === invite.id
                ? { ...item, status: 'Revogado' as const }
                : item,
            );

            try {
              await saveInvites(updated);
            } catch {
              Alert.alert('Erro', 'Não foi possível revogar o convite.');
            }
          },
        },
      ],
    );
  };

  const pendingInvites = familyInvites.filter(
    (invite) =>
      normalizeStatus(invite.status) === 'pendente' &&
      !isExpired(invite.expiresAt),
  );

  const expiredInvites = familyInvites.filter(
    (invite) =>
      normalizeStatus(invite.status) === 'pendente' &&
      isExpired(invite.expiresAt),
  );

  const revokedInvites = familyInvites.filter(
    (invite) => normalizeStatus(invite.status) === 'revogado',
  );

  const acceptedInvites = familyInvites.filter((invite) =>
    ['accepted', 'aceito', 'utilizado', 'used'].includes(
      normalizeStatus(invite.status),
    ),
  );

  const renderInvite = (invite: Invite) => {
    const expired = isExpired(invite.expiresAt);
    const status = normalizeStatus(invite.status);

    const revoked = status === 'revogado';
    const accepted = [
      'accepted',
      'aceito',
      'utilizado',
      'used',
    ].includes(status);

    const displayedStatus = revoked
      ? 'Revogado'
      : accepted
        ? 'Utilizado'
        : expired
          ? 'Expirado'
          : 'Pendente';

    return (
      <View key={invite.id} style={styles.inviteCard}>
        <View style={styles.inviteTop}>
          <View style={styles.inviteRole}>
            <Text style={styles.inviteRoleText}>
              {invite.role}
            </Text>
          </View>

          <Text
            style={[
              styles.status,
              revoked || expired
                ? styles.statusInactive
                : accepted
                  ? styles.statusAccepted
                  : styles.statusActive,
            ]}
          >
            {displayedStatus}
          </Text>
        </View>

        {invite.name ? (
          <Text style={styles.inviteName}>{invite.name}</Text>
        ) : null}

        <Text style={styles.codeLabel}>Código de convite</Text>
        <Text style={styles.inviteCode}>{invite.code}</Text>

        <Text style={styles.inviteDate}>
          Criado em {formatDate(invite.createdAt)}
        </Text>

        <Text style={styles.inviteDate}>
          Válido até {formatDate(invite.expiresAt)}
        </Text>

        {!revoked && !expired && !accepted && (
          <View style={styles.inviteActions}>
            <Pressable
              style={styles.shareButton}
              onPress={() => shareInvite(invite)}
            >
              <Text style={styles.shareButtonText}>
                Compartilhar
              </Text>
            </Pressable>

            <Pressable
              style={styles.revokeButton}
              onPress={() => revokeInvite(invite)}
            >
              <Text style={styles.revokeButtonText}>
                Revogar
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeading}>
        <Text style={styles.pageKicker}>
          Acompanhamento AICare
        </Text>

        <Text style={styles.pageTitle}>Pessoas</Text>

        <Text style={styles.description}>
          Gerencie os acessos de familiares e administradores à família.
        </Text>
      </View>

      <View style={styles.personCard}>
  <View style={styles.personAvatar}>
    <Text style={styles.personAvatarText}>
      {patientInitial}
    </Text>
  </View>

  <View style={styles.personInfo}>
    <Text style={styles.cardTitle}>
      {patientLoading
        ? 'Carregando paciente...'
        : patient
          ? patient.name
          : 'Nenhum paciente cadastrado'}
    </Text>

    <Text style={styles.description}>
      {patient
        ? patient.relationship
        : 'Cadastre a pessoa que será acompanhada.'}
    </Text>

    {patient && (
      <Text style={styles.patientLabel}>
        Perfil acompanhado
      </Text>
    )}
  </View>

  <Pressable
    onPress={() => router.push('/cadastro-paciente')}
    style={{
      backgroundColor: PALE_BLUE,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
    }}
  >
    <Text style={{ color: DARK, fontSize: 11, fontWeight: '800' }}>
      {patient ? 'Editar' : 'Cadastrar'}
    </Text>
  </Pressable>
</View>

      <View style={styles.accountCard}>
        <View style={styles.accountInfo}>
          <Text style={styles.accountTitle}>
            Conta conectada
          </Text>

          <Text style={styles.accountName}>
            {user?.name ?? 'Usuário'}
          </Text>

          <Text style={styles.accountEmail}>
            {user?.email ?? ''}
          </Text>

          <Text style={styles.accountRole}>
            {user?.role ?? 'Familiar'}
          </Text>
        </View>

        <Pressable
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>
            Sair da conta
          </Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            Familiares e cuidadores
          </Text>

          <Text style={styles.description}>
            Convide pessoas para acompanhar os cuidados.
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {pendingInvites.length}
          </Text>

          <Text style={styles.statLabel}>
            Convites ativos
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {expiredInvites.length}
          </Text>

          <Text style={styles.statLabel}>
            Expirados
          </Text>
        </View>
      </View>

      <Pressable
        style={styles.createButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.createButtonText}>
          + Criar convite
        </Text>
      </Pressable>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>
          Como funcionam os convites?
        </Text>

        <Text style={styles.infoText}>
          Gere um código para cada pessoa. O código identifica o tipo de
          acesso solicitado, fica vinculado à sua família e possui
          validade de 7 dias.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Convites ativos
        </Text>

        <Text style={styles.countText}>
          {pendingInvites.length}
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={BLUE} />
      ) : pendingInvites.length > 0 ? (
        pendingInvites.map(renderInvite)
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            Nenhum convite ativo
          </Text>

          <Text style={styles.description}>
            Os convites criados aparecerão aqui.
          </Text>
        </View>
      )}

      {expiredInvites.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Convites expirados
            </Text>
          </View>

          {expiredInvites.map(renderInvite)}
        </>
      )}

      {acceptedInvites.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Convites utilizados
            </Text>
          </View>

          {acceptedInvites.map(renderInvite)}
        </>
      )}

      {revokedInvites.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Convites revogados
            </Text>
          </View>

          {revokedInvites.map(renderInvite)}
        </>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Novo convite
            </Text>

            <Text style={styles.description}>
              Escolha o tipo de acesso da pessoa convidada.
            </Text>

            <Text style={styles.inputLabel}>
              Nome da pessoa (opcional)
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Ex.: Ana"
              placeholderTextColor={MUTED}
              value={inviteName}
              onChangeText={setInviteName}
              maxLength={50}
            />

            <Text style={styles.inputLabel}>
              Tipo de acesso
            </Text>

            <Pressable
              style={[
                styles.roleOption,
                selectedRole === 'Familiar' &&
                  styles.roleOptionSelected,
              ]}
              onPress={() => setSelectedRole('Familiar')}
            >
              <View style={styles.radio}>
                {selectedRole === 'Familiar' && (
                  <View style={styles.radioSelected} />
                )}
              </View>

              <View style={styles.roleInfo}>
                <Text style={styles.roleTitle}>
                  Familiar
                </Text>

                <Text style={styles.roleDescription}>
                  Acompanhamento das informações e dos cuidados.
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.roleOption,
                selectedRole === 'Administrador' &&
                  styles.roleOptionSelected,
              ]}
              onPress={() => setSelectedRole('Administrador')}
            >
              <View style={styles.radio}>
                {selectedRole === 'Administrador' && (
                  <View style={styles.radioSelected} />
                )}
              </View>

              <View style={styles.roleInfo}>
                <Text style={styles.roleTitle}>
                  Administrador
                </Text>

                <Text style={styles.roleDescription}>
                  Gerenciamento da família e dos acessos autorizados.
                </Text>
              </View>
            </Pressable>

            <Text style={styles.expirationNote}>
              O código terá validade de 7 dias.
            </Text>

            <Pressable
              style={[
                styles.createButton,
                saving && styles.disabledButton,
              ]}
              onPress={createInvite}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.createButtonText}>
                  Gerar código
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={() => {
                setModalVisible(false);
                setInviteName('');
                setSelectedRole('Familiar');
              }}
            >
              <Text style={styles.cancelButtonText}>
                Cancelar
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: 20,
    paddingBottom: 32,
  },
  pageHeading: {
    gap: 5,
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
  description: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
  },
  personCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  personAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: PALE_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAvatarText: {
    color: BLUE,
    fontSize: 17,
    fontWeight: '800',
  },
  personInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '800',
  },
  patientLabel: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  accountInfo: {
    gap: 5,
  },
  accountTitle: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  accountName: {
    color: DARK,
    fontSize: 17,
    fontWeight: '800',
  },
  accountEmail: {
    color: MUTED,
    fontSize: 13,
  },
  accountRole: {
    color: BLUE,
    fontSize: 12,
    fontWeight: '800',
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#E5B6A8',
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#B65B43',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '800',
  },
  countText: {
    color: BLUE,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 15,
    gap: 4,
  },
  statNumber: {
    color: DARK,
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: MUTED,
    fontSize: 12,
  },
  createButton: {
    backgroundColor: BLUE,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: PALE_BLUE,
    borderRadius: 12,
    padding: 15,
    gap: 7,
  },
  infoTitle: {
    color: DARK,
    fontSize: 14,
    fontWeight: '800',
  },
  infoText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    gap: 7,
  },
  emptyTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: '800',
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  inviteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteRole: {
    backgroundColor: PALE_BLUE,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  inviteRoleText: {
    color: DARK,
    fontSize: 11,
    fontWeight: '800',
  },
  status: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusActive: {
    color: '#25865B',
  },
  statusInactive: {
    color: '#B66A43',
  },
  statusAccepted: {
    color: '#3676A8',
  },
  inviteName: {
    color: DARK,
    fontWeight: '700',
    fontSize: 14,
  },
  codeLabel: {
    color: MUTED,
    fontSize: 11,
    marginTop: 5,
  },
  inviteCode: {
    color: DARK,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 2,
  },
  inviteDate: {
    color: MUTED,
    fontSize: 11,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  shareButton: {
    flex: 1,
    backgroundColor: BLUE,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  revokeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5B6A8',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  revokeButtonText: {
    color: '#B65B43',
    fontSize: 12,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 30, 42, 0.48)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 13,
  },
  modalTitle: {
    color: DARK,
    fontSize: 21,
    fontWeight: '900',
  },
  inputLabel: {
    color: DARK,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: DARK,
    fontSize: 14,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  roleOptionSelected: {
    borderColor: BLUE,
    backgroundColor: PALE_BLUE,
  },
  radio: {
    width: 19,
    height: 19,
    borderWidth: 2,
    borderColor: BLUE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: BLUE,
  },
  roleInfo: {
    flex: 1,
    gap: 3,
  },
  roleTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '800',
  },
  roleDescription: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 16,
  },
  expirationNote: {
    color: MUTED,
    fontSize: 11,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
