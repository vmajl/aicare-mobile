
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../features/auth/AuthContext';

const BLUE = '#50A9C3';
const DARK = '#102F40';
const MUTED = '#6D8794';
const BORDER = '#D8E3E8';
const BACKGROUND = '#F5FAFC';

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Atenção', 'Informe seu e-mail e sua senha.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'Não foi possível entrar',
        error instanceof Error ? error.message : 'Tente novamente.',
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
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>AI</Text>
          </View>

          <Text style={styles.brand}>AICare</Text>
          <Text style={styles.subtitle}>
            Cuidado, acompanhamento e tranquilidade em um só lugar.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Bem-vindo de volta</Text>
          <Text style={styles.description}>
            Entre na sua conta para continuar acompanhando seus cuidados.
          </Text>

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
          />

          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="Digite sua senha"
            placeholderTextColor="#9AAEB7"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              loading && styles.disabled,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Entrar</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Ainda não tem uma conta?</Text>
            <Link href="/(auth)/cadastro" asChild>
              <Pressable>
                <Text style={styles.link}>Criar conta</Text>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },
  brand: {
    color: DARK,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 290,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
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
    marginTop: 8,
    marginBottom: 24,
  },
  label: {
    color: DARK,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: DARK,
    fontSize: 14,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
  },
  primaryButton: {
    height: 54,
    borderRadius: 13,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.6,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 24,
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
    marginTop: 28,
  },
});
