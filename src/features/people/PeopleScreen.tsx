
import React, { useCallback, useEffect, useState } from 'react';
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
  Platform,
} from 'react-native';
import { Alert } from '../../utils/platformAlert';
import { ROLE_LABELS, useAuth } from '../auth/AuthContext';
import { router } from 'expo-router';
import { usePatient } from '../patients/PatientContext';
import { apiRequest, parseApiDate } from '../../services/apiClient';

const BLUE = '#50A9C3';
const DARK = '#102F40';
const MUTED = '#6D8794';
const BORDER = '#D8E3E8';
const PALE_BLUE = '#E8F6FA';

const INVITE_EXPIRATION_DAYS = 7;

/** Perfis que podem ser convidados (definidos pela API). */
type InviteRole = 'caregiver' | 'family';

type Invite = {
  id: number;
  patient_id: number;
  role: InviteRole;
  name: string | null;
  email: string | null;
  expires_at: string;
  used_at: string | null;
  revoked: boolean;
  created_at: string;
  invite_token: string;
};

type InviteStatus = 'Pendente' | 'Expirado' | 'Utilizado' | 'Revogado';

const formatDate = (date: string) => {
  return parseApiDate(date).toLocaleDateString('pt-BR');
};

const isExpired = (date: string) => {
  return parseApiDate(date).getTime() < Date.now();
};

const getInviteStatus = (invite: Invite): InviteStatus => {
  if (invite.revoked) return 'Revogado';
  if (invite.used_at) return 'Utilizado';
  if (isExpired(invite.expires_at)) return 'Expirado';
  return 'Pendente';
};

// O token JWT é longo: exibe só o início e o fim no cartão.
const shortToken = (token: string) =>
  token.length > 24 ? `${token.slice(0, 12)}…${token.slice(-8)}` : token;

export default function PeopleScreen() {
  const { user, logout } = useAuth();
  const { patient, loading: patientLoading, canEdit } = usePatient();

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] =
    useState<InviteRole>('caregiver');
  const [inviteName, setInviteName] = useState('');
  const [saving, setSaving] = useState(false);

  // Somente o familiar administrador do paciente gerencia convites.
  const canManageInvites =
    user?.role === 'family_admin' &&
    patient?.accessRole === 'family_admin';

  const patientId = patient?.id;

  const loadInvites = useCallback(async () => {
    if (!patientId || !canManageInvites) {
      setInvites([]);
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest<Invite[]>(
        `/patients/${patientId}/invites`,
      );
      setInvites(data);
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error
          ? error.message
          : 'Não foi possível carregar os convites.',
      );
    } finally {
      setLoading(false);
    }
  }, [patientId, canManageInvites]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const patientInitial = patient?.name?.trim().charAt(0).toUpperCase() || '?';

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

  const openInviteModal = () => {
    if (!patient) {
      Alert.alert(
        'Cadastre o paciente',
        'Antes de convidar pessoas, cadastre quem será acompanhado.',
      );
      return;
    }

    setModalVisible(true);
  };

  const closeInviteModal = () => {
    setModalVisible(false);
    setInviteName('');
    setSelectedRole('caregiver');
  };

  const createInvite = async () => {
    if (saving || !patientId) return;

    setSaving(true);

    try {
      const newInvite = await apiRequest<Invite>(
        `/patients/${patientId}/invites`,
        {
          method: 'POST',
          body: {
            role: selectedRole,
            name: inviteName.trim() || null,
            expires_in_hours: INVITE_EXPIRATION_DAYS * 24,
          },
        },
      );

      setInvites((current) => [newInvite, ...current]);
      closeInviteModal();

      Alert.alert(
        'Convite criado',
        'Compartilhe o código de convite com a pessoa convidada. Ele só pode ser usado uma vez.',
        [
          { text: 'Fechar' },
          {
            text: 'Compartilhar',
            onPress: () => shareInvite(newInvite),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Erro',
        error instanceof Error
          ? error.message
          : 'Não foi possível criar o convite.',
      );
    } finally {
      setSaving(false);
    }
  };

  const shareInvite = async (invite: Invite) => {
    const message =
      `Você foi convidado(a) para participar do AICare!\n\n` +
      `Tipo de acesso: ${ROLE_LABELS[invite.role]}\n` +
      `Validade: até ${formatDate(invite.expires_at)}.\n\n` +
      `No aplicativo AICare, escolha "Tenho um código de convite" e cole o código abaixo:\n\n` +
      `${invite.invite_token}`;

    try {
      if (Platform.OS === 'web') {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(message);
          Alert.alert('Convite copiado', 'O convite foi copiado para a área de transferência.');
        } else {
          window.prompt('Copie o texto do convite:', message);
        }
        return;
      }

      await Share.share({ message });
    } catch {
      Alert.alert('Erro', 'Não foi possível compartilhar o convite.');
    }
  };

  const revokeInvite = (invite: Invite) => {
    const target = invite.name ? `o convite de ${invite.name}` : 'este convite';

    Alert.alert(
      'Revogar convite',
      `Deseja realmente revogar ${target}? Ele não poderá mais ser utilizado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest<void>(
                `/patients/${invite.patient_id}/invites/${invite.id}`,
                { method: 'DELETE' },
              );

              setInvites((current) =>
                current.map((item) =>
                  item.id === invite.id ? { ...item, revoked: true } : item,
                ),
              );
            } catch (error) {
              Alert.alert(
                'Erro',
                error instanceof Error
                  ? error.message
                  : 'Não foi possível revogar o convite.',
              );
            }
          },
        },
      ],
    );
  };

  const pendingInvites = invites.filter(
    (invite) => getInviteStatus(invite) === 'Pendente',
  );

  const expiredInvites = invites.filter(
    (invite) => getInviteStatus(invite) === 'Expirado',
  );

  const revokedInvites = invites.filter(
    (invite) => getInviteStatus(invite) === 'Revogado',
  );

  const acceptedInvites = invites.filter(
    (invite) => getInviteStatus(invite) === 'Utilizado',
  );

  const renderInvite = (invite: Invite) => {
    const displayedStatus = getInviteStatus(invite);

    const revoked = displayedStatus === 'Revogado';
    const accepted = displayedStatus === 'Utilizado';
    const expired = displayedStatus === 'Expirado';

    return (
      <View key={invite.id} style={styles.inviteCard}>
        <View style={styles.inviteTop}>
          <View style={styles.inviteRole}>
            <Text style={styles.inviteRoleText}>
              {ROLE_LABELS[invite.role]}
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
        <Text style={styles.inviteToken} numberOfLines={1}>
          {shortToken(invite.invite_token)}
        </Text>

        <Text style={styles.inviteDate}>
          Criado em {formatDate(invite.created_at)}
        </Text>

        <Text style={styles.inviteDate}>
          {accepted && invite.used_at
            ? `Utilizado em ${formatDate(invite.used_at)}`
            : `Válido até ${formatDate(invite.expires_at)}`}
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
          Gerencie os acessos de familiares e cuidadores ao acompanhamento.
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

  {canEdit && (
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
  )}
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
            {user ? ROLE_LABELS[user.role] : ''}
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

      {!canManageInvites ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Convites
          </Text>

          <Text style={styles.infoText}>
            {user?.role !== 'family_admin'
              ? 'Somente o familiar administrador pode convidar familiares e cuidadores.'
              : patientLoading
                ? 'Carregando paciente...'
                : 'Cadastre o paciente acompanhado para começar a convidar familiares e cuidadores.'}
          </Text>
        </View>
      ) : (
      <>
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
        onPress={openInviteModal}
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
          Gere um código para cada pessoa. O código define o tipo de
          acesso (familiar ou cuidador), fica vinculado ao paciente,
          vale por {INVITE_EXPIRATION_DAYS} dias e só pode ser usado uma vez.
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
      </>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeInviteModal}
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
                selectedRole === 'caregiver' &&
                  styles.roleOptionSelected,
              ]}
              onPress={() => setSelectedRole('caregiver')}
            >
              <View style={styles.radio}>
                {selectedRole === 'caregiver' && (
                  <View style={styles.radioSelected} />
                )}
              </View>

              <View style={styles.roleInfo}>
                <Text style={styles.roleTitle}>
                  Cuidador
                </Text>

                <Text style={styles.roleDescription}>
                  Registro e acompanhamento dos cuidados diários.
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.roleOption,
                selectedRole === 'family' &&
                  styles.roleOptionSelected,
              ]}
              onPress={() => setSelectedRole('family')}
            >
              <View style={styles.radio}>
                {selectedRole === 'family' && (
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

            <Text style={styles.expirationNote}>
              O código terá validade de {INVITE_EXPIRATION_DAYS} dias.
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
              onPress={closeInviteModal}
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
  inviteToken: {
    color: DARK,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
