
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { Link, router } from 'expo-router';
import { useAuth } from '../../features/auth/AuthContext';

const BLUE = '#50A9C3';
const DARK = '#102F40';
const MUTED = '#6D8794';
const BORDER = '#D8E3E8';
const BACKGROUND = '#F5FAFC';
const PALE_BLUE = '#E8F6FA';

type RegistrationMode = 'new' | 'invite';

export default function CadastroScreen() {
  const { register } = useAuth();

  const [mode, setMode] = useState<RegistrationMode | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  function selectMode(selectedMode: RegistrationMode) {
    setMode(selectedMode);
    setInviteCode('');
  }

  async function handleRegister() {
    if (!mode) {
      Alert.alert('Atenção', 'Escolha como deseja começar.');
      return;
    }

    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios.');
      return;
    }

    if (mode === 'invite' && !inviteCode.trim()) {
      Alert.alert('Código necessário', 'Informe o código de convite recebido.');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('E-mail inválido', 'Informe um endereço de e-mail válido.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Senha inválida', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Senhas diferentes', 'As senhas informadas não coincidem.');
      return;
    }

    try {
      setLoading(true);

      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        inviteCode: mode === 'invite' ? inviteCode.trim().toUpperCase() : undefined,
      });

      Alert.alert(
        'Cadastro realizado',
        mode === 'new'
          ? 'Seu acompanhamento foi criado. Você agora é o administrador da família.'
          : 'Sua conta foi criada e vinculada ao acompanhamento do convite.',
        [
          {
            text: 'Continuar',
            onPress: () => router.replace('/(tabs)'),
          },
        ],
      );
    } catch (error) {
      Alert.alert(
        'Não foi possível criar a conta',
        error instanceof Error
          ? error.message
          : 'Verifique os dados e tente novamente.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>AI</Text>
          </View>

          <Text style={styles.brand}>AICare</Text>

          <Text style={styles.subtitle}>
            Cuidado conectado, em família.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Criar conta</Text>

          <Text style={styles.description}>
            Como deseja começar sua jornada no AICare?
          </Text>

          <Pressable
            style={[
              styles.modeCard,
              mode === 'new' && styles.modeCardSelected,
            ]}
            onPress={() => selectMode('new')}
            disabled={loading}
          >
            <View style={styles.modeTop}>
              <View style={styles.modeIcon}>
                <Text style={styles.modeIconText}>+</Text>
              </View>

              <View
                style={[
                  styles.radio,
                  mode === 'new' && styles.radioSelected,
                ]}
              >
                {mode === 'new' && <View style={styles.radioInner} />}
              </View>
            </View>

            <Text style={styles.modeTitle}>
              Começar um novo acompanhamento
            </Text>

            <Text style={styles.modeDescription}>
              Crie um espaço para acompanhar os cuidados de sua família.
              Você será o administrador e poderá convidar outras pessoas.
            </Text>

            <Text style={styles.modeBadge}>
              Criar nova família
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.modeCard,
              mode === 'invite' && styles.modeCardSelected,
            ]}
            onPress={() => selectMode('invite')}
            disabled={loading}
          >
            <View style={styles.modeTop}>
              <View style={styles.modeIcon}>
                <Text style={styles.modeIconText}>↗</Text>
              </View>

              <View
                style={[
                  styles.radio,
                  mode === 'invite' && styles.radioSelected,
                ]}
              >
                {mode === 'invite' && <View style={styles.radioInner} />}
              </View>
            </View>

            <Text style={styles.modeTitle}>
              Tenho um código de convite
            </Text>

            <Text style={styles.modeDescription}>
              Já foi convidado por alguém? Utilize o código recebido para
              entrar em um acompanhamento existente.
            </Text>

            <Text style={styles.modeBadge}>
              Entrar em uma família
            </Text>
          </Pressable>

          {mode && (
            <View style={styles.formSection}>
              <View style={styles.formHeading}>
                <Text style={styles.formTitle}>
                  {mode === 'new'
                    ? 'Dados do administrador'
                    : 'Dados da sua conta'}
                </Text>

                <Text style={styles.description}>
                  {mode === 'new'
                    ? 'Informe seus dados para criar o acompanhamento.'
                    : 'Informe seus dados para acessar o acompanhamento.'}
                </Text>
              </View>

              <Text style={styles.label}>Nome completo</Text>

              <TextInput
                style={styles.input}
                placeholder="Seu nome"
                placeholderTextColor="#9AAEB7"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!loading}
              />

              <Text style={styles.label}>E-mail</Text>

              <TextInput
                style={styles.input}
                placeholder="seuemail@exemplo.com"
                placeholderTextColor="#9AAEB7"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              <Text style={styles.label}>Senha</Text>

              <TextInput
                style={styles.input}
                placeholder="Mínimo de 6 caracteres"
                placeholderTextColor="#9AAEB7"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />

              <Text style={styles.label}>Confirmar senha</Text>

              <TextInput
                style={styles.input}
                placeholder="Digite a senha novamente"
                placeholderTextColor="#9AAEB7"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />

              {mode === 'invite' && (
                <>
                  <Text style={styles.label}>Código de convite</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Ex.: AIC-ABC123"
                    placeholderTextColor="#9AAEB7"
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!loading}
                  />

                  <Text style={styles.helperText}>
                    O código deve ter sido fornecido pela pessoa que
                    administra o acompanhamento.
                  </Text>
                </>
              )}

              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>
                  {mode === 'new'
                    ? 'Você será o administrador'
                    : 'Acesso por convite'}
                </Text>

                <Text style={styles.noticeText}>
                  {mode === 'new'
                    ? 'Após o cadastro, você poderá criar convites para familiares e cuidadores.'
                    : 'Seu perfil de acesso será definido pelo convite recebido.'}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                  loading && styles.disabled,
                ]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {mode === 'new'
                      ? 'Criar acompanhamento'
                      : 'Entrar no acompanhamento'}
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.changeModeButton}
                onPress={() => setMode(null)}
                disabled={loading}
              >
                <Text style={styles.changeModeText}>
                  Escolher outra opção
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Já possui uma conta?
            </Text>

            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.link}>Entrar</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <Text style={styles.bottomText}>
          AICare · Tecnologia a favor do cuidado.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 35,
  },
  header: {
    alignItems: 'center',
    marginBottom: 26,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 19,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  brand: {
    color: DARK,
    fontSize: 29,
    fontWeight: '800',
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    marginTop: 7,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
  },
  title: {
    color: DARK,
    fontSize: 23,
    fontWeight: '800',
  },
  description: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 18,
  },
  modeCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  modeCardSelected: {
    borderColor: BLUE,
    backgroundColor: PALE_BLUE,
  },
  modeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: PALE_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeIconText: {
    color: BLUE,
    fontSize: 24,
    fontWeight: '800',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: BLUE,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: BLUE,
  },
  modeTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  modeDescription: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 19,
  },
  modeBadge: {
    color: BLUE,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 11,
  },
  formSection: {
    marginTop: 12,
    paddingTop: 19,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  formHeading: {
    marginBottom: 5,
  },
  formTitle: {
    color: DARK,
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    color: DARK,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    height: 49,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 11,
    paddingHorizontal: 13,
    color: DARK,
    fontSize: 14,
    marginBottom: 15,
    backgroundColor: '#FFFFFF',
  },
  helperText: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 17,
    marginTop: -8,
    marginBottom: 15,
  },
  notice: {
    backgroundColor: PALE_BLUE,
    borderRadius: 11,
    padding: 13,
    marginTop: 2,
    marginBottom: 12,
    gap: 5,
  },
  noticeTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '800',
  },
  noticeText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 53,
    borderRadius: 13,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  changeModeButton: {
    paddingVertical: 13,
    alignItems: 'center',
  },
  changeModeText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 22,
    flexWrap: 'wrap',
  },
  footerText: {
    color: MUTED,
    fontSize: 13,
  },
  link: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '800',
  },
  bottomText: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 24,
  },
});
