
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ApiError,
  apiRequest,
  setAuthToken,
  setUnauthorizedHandler,
} from '../../services/apiClient';

// ======================================================
// TIPOS
// ======================================================

/** Perfis definidos pela API (backend/app/models.py). */
export type UserRole = 'family_admin' | 'family' | 'caregiver';

export const ROLE_LABELS: Record<UserRole, string> = {
  family_admin: 'Administrador',
  family: 'Familiar',
  caregiver: 'Cuidador',
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Agrupa os dados locais (medicamentos, diário) da família. */
  familyId: string;
};

export type RegisterData = {
  name: string;
  email: string;
  password: string;
  /** Token JWT de convite recebido do familiar administrador. */
  inviteCode?: string;
};

type AuthContextData = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<AppUser>;
  logout: () => Promise<void>;
};

type ApiUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  created_at: string;
  family_id: number | null;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

type StoredSession = {
  token: string;
  user: AppUser;
};

// ======================================================
// ARMAZENAMENTO
// ======================================================

const SESSION_KEY = '@aicare:api-session';

// ======================================================
// CONTEXTO
// ======================================================

const AuthContext = createContext<AuthContextData | undefined>(
  undefined,
);

// ======================================================
// FUNÇÕES AUXILIARES
// ======================================================

const normalizeEmail = (email: string) => {
  return email.trim().toLowerCase();
};

const toAppUser = (apiUser: ApiUser): AppUser => ({
  id: String(apiUser.id),
  name: apiUser.name,
  email: apiUser.email,
  role: apiUser.role,
  familyId: `family-${apiUser.family_id ?? apiUser.id}`,
});

// ======================================================
// PROVIDER
// ======================================================

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const saveSession = useCallback(async (data: TokenResponse) => {
    const appUser = toAppUser(data.user);
    const session: StoredSession = {
      token: data.access_token,
      user: appUser,
    };

    setAuthToken(data.access_token);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(appUser);

    return appUser;
  }, []);

  // Token expirado ou inválido em qualquer requisição: encerra a sessão.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void clearSession();
    });

    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // ----------------------------------------------------
  // RESTAURAR SESSÃO
  // ----------------------------------------------------

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const sessionData = await AsyncStorage.getItem(SESSION_KEY);

        if (!sessionData) {
          setUser(null);
          return;
        }

        const savedSession: StoredSession = JSON.parse(sessionData);

        setAuthToken(savedSession.token);
        setUser(savedSession.user);

        // Confirma o token e atualiza os dados do usuário.
        try {
          const apiUser = await apiRequest<ApiUser>('/auth/me');
          const refreshedUser = toAppUser(apiUser);

          setUser(refreshedUser);
          await AsyncStorage.setItem(
            SESSION_KEY,
            JSON.stringify({ ...savedSession, user: refreshedUser }),
          );
        } catch (error) {
          // Sem conexão: mantém a sessão salva. Token recusado: sai.
          if (error instanceof ApiError && error.status === 401) {
            await clearSession();
          }
        }
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
        await clearSession();
      } finally {
        setLoading(false);
      }
    };

    void restoreSession();
  }, [clearSession]);

  // ----------------------------------------------------
  // LOGIN
  // ----------------------------------------------------

  const login = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail || !password) {
        throw new Error('Informe o e-mail e a senha.');
      }

      const data = await apiRequest<TokenResponse>('/auth/login', {
        method: 'POST',
        form: { username: normalizedEmail, password },
        auth: false,
      });

      await saveSession(data);
    },
    [saveSession],
  );

  // ----------------------------------------------------
  // CADASTRO
  // ----------------------------------------------------

  const register = useCallback(
    async (data: RegisterData): Promise<AppUser> => {
      const name = data.name.trim();
      const email = normalizeEmail(data.email);
      const password = data.password;
      const inviteToken = data.inviteCode?.trim();

      if (!name || !email || !password) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }

      if (password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      // FLUXO 1: novo acompanhamento (familiar administrador).
      // FLUXO 2: cadastro por convite (cuidador ou familiar).
      const response = inviteToken
        ? await apiRequest<TokenResponse>('/auth/register/invite', {
            method: 'POST',
            body: { name, email, password, invite_token: inviteToken },
            auth: false,
          })
        : await apiRequest<TokenResponse>('/auth/register', {
            method: 'POST',
            body: { name, email, password },
            auth: false,
          });

      return saveSession(response);
    },
    [saveSession],
  );

  // ----------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------

  const logout = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  // ----------------------------------------------------
  // VALOR DO CONTEXTO
  // ----------------------------------------------------

  const value: AuthContextData = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ======================================================
// HOOK
// ======================================================

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth deve ser utilizado dentro de AuthProvider.',
    );
  }

  return context;
}
