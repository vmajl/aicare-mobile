
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ======================================================
// TIPOS
// ======================================================

export type UserRole = 'Familiar' | 'Administrador';

export type AppUser = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  familyId: string;
  inviteCode?: string;
};

export type RegisterData = {
  name: string;
  email: string;
  password: string;
  inviteCode?: string;
};

type AuthContextData = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<AppUser>;
  logout: () => Promise<void>;
};

type StoredInvite = {
  id: string;
  code: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
  status: string;
  name?: string;
  familyId?: string;
};

type StoredFamily = {
  id: string;
  name: string;
  createdAt: string;
  ownerId: string;
};

// ======================================================
// ARMAZENAMENTO
// ======================================================

const USERS_KEY = '@aicare:demo-users';
const SESSION_KEY = '@aicare:demo-session';
const INVITES_KEY = '@aicare:people-invites';
const ACCEPTED_CODES_KEY = '@aicare:accepted-invite-codes';
const FAMILIES_KEY = '@aicare:demo-families';

// Compatibilidade com contas antigas que ainda não possuem
// um familyId salvo.
const LEGACY_FAMILY_ID = 'aicare-legacy-family';

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

const generateId = (prefix: string) => {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
};

const normalizeInviteStatus = (status: string) => {
  return status.trim().toLowerCase();
};

const isInviteAvailable = (invite: StoredInvite) => {
  const status = normalizeInviteStatus(invite.status);

  const unavailableStatuses = [
    'revogado',
    'revoked',
    'accepted',
    'aceito',
    'utilizado',
    'used',
  ];

  const expired = new Date(invite.expiresAt).getTime() < Date.now();

  return !unavailableStatuses.includes(status) && !expired;
};

// ======================================================
// PROVIDER
// ======================================================

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

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

        const savedSession: AppUser = JSON.parse(sessionData);

        // Compatibilidade com usuários cadastrados anteriormente.
        const restoredUser: AppUser = {
          ...savedSession,
          familyId: savedSession.familyId || LEGACY_FAMILY_ID,
        };

        setUser(restoredUser);

        // Atualiza a sessão antiga com o familyId.
        await AsyncStorage.setItem(
          SESSION_KEY,
          JSON.stringify(restoredUser),
        );
      } catch (error) {
        console.error('Erro ao restaurar sessão:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ----------------------------------------------------
  // LOGIN
  // ----------------------------------------------------

  const login = useCallback(
    async (email: string, password: string) => {
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedEmail || !password) {
        throw new Error('Informe o e-mail e a senha.');
      }

      const storedUsers = await AsyncStorage.getItem(USERS_KEY);
      const users: AppUser[] = storedUsers
        ? JSON.parse(storedUsers)
        : [];

      const foundUser = users.find(
        (item) =>
          normalizeEmail(item.email) === normalizedEmail &&
          item.password === password,
      );

      if (!foundUser) {
        throw new Error('E-mail ou senha incorretos.');
      }

      const authenticatedUser: AppUser = {
        ...foundUser,
        familyId: foundUser.familyId || LEGACY_FAMILY_ID,
      };

      // Atualiza o cadastro antigo caso ainda não tenha familyId.
      const updatedUsers = users.map((item) =>
        item.id === authenticatedUser.id
          ? authenticatedUser
          : item,
      );

      await AsyncStorage.setItem(
        USERS_KEY,
        JSON.stringify(updatedUsers),
      );

      await AsyncStorage.setItem(
        SESSION_KEY,
        JSON.stringify(authenticatedUser),
      );

      setUser(authenticatedUser);
    },
    [],
  );

  // ----------------------------------------------------
  // CADASTRO
  // ----------------------------------------------------

  const register = useCallback(
    async (data: RegisterData): Promise<AppUser> => {
      const name = data.name.trim();
      const email = normalizeEmail(data.email);
      const password = data.password;
      const inviteCode = data.inviteCode?.trim().toUpperCase();

      if (!name || !email || !password) {
        throw new Error('Preencha todos os campos obrigatórios.');
      }

      if (password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      const storedUsers = await AsyncStorage.getItem(USERS_KEY);
      const users: AppUser[] = storedUsers
        ? JSON.parse(storedUsers)
        : [];

      const emailAlreadyExists = users.some(
        (item) => normalizeEmail(item.email) === email,
      );

      if (emailAlreadyExists) {
        throw new Error('Já existe uma conta cadastrada com esse e-mail.');
      }

      let role: UserRole = 'Administrador';
      let familyId = '';
      let acceptedInviteCode: string | undefined;

      // ==================================================
      // FLUXO 1: NOVO ACOMPANHAMENTO
      // ==================================================

      if (!inviteCode) {
        familyId = generateId('family');
        role = 'Administrador';

        const storedFamilies = await AsyncStorage.getItem(FAMILIES_KEY);
        const families: StoredFamily[] = storedFamilies
          ? JSON.parse(storedFamilies)
          : [];

        const newUserId = generateId('user');

        const newFamily: StoredFamily = {
          id: familyId,
          name: `Acompanhamento de ${name}`,
          createdAt: new Date().toISOString(),
          ownerId: newUserId,
        };

        const newUser: AppUser = {
          id: newUserId,
          name,
          email,
          password,
          role,
          familyId,
        };

        // Salva o acompanhamento e o primeiro administrador.
        await AsyncStorage.setItem(
          FAMILIES_KEY,
          JSON.stringify([...families, newFamily]),
        );

        await AsyncStorage.setItem(
          USERS_KEY,
          JSON.stringify([...users, newUser]),
        );

        await AsyncStorage.setItem(
          SESSION_KEY,
          JSON.stringify(newUser),
        );

        setUser(newUser);

        return newUser;
      }

      // ==================================================
      // FLUXO 2: ENTRAR COM CÓDIGO DE CONVITE
      // ==================================================

      const storedInvites = await AsyncStorage.getItem(INVITES_KEY);
      const invites: StoredInvite[] = storedInvites
        ? JSON.parse(storedInvites)
        : [];

      const storedAcceptedCodes = await AsyncStorage.getItem(
        ACCEPTED_CODES_KEY,
      );

      const acceptedCodes: string[] = storedAcceptedCodes
        ? JSON.parse(storedAcceptedCodes)
        : [];

      const codeAlreadyUsed = acceptedCodes.some(
        (code) => code.toUpperCase() === inviteCode,
      );

      if (codeAlreadyUsed) {
        throw new Error('Este código de convite já foi utilizado.');
      }

      const inviteIndex = invites.findIndex(
        (item) => item.code.toUpperCase() === inviteCode,
      );

      if (inviteIndex === -1) {
        throw new Error('Código de convite não encontrado.');
      }

      const invite = invites[inviteIndex];

      if (!isInviteAvailable(invite)) {
        throw new Error(
          'Este convite foi revogado, utilizado ou está expirado.',
        );
      }

      if (
        invite.role !== 'Familiar' &&
        invite.role !== 'Administrador'
      ) {
        throw new Error('O convite possui um tipo de acesso inválido.');
      }

      // Convites antigos, sem familyId, pertencem ao ambiente legado.
      familyId = invite.familyId || LEGACY_FAMILY_ID;
      role = invite.role;
      acceptedInviteCode = invite.code;

      const newUser: AppUser = {
        id: generateId('user'),
        name,
        email,
        password,
        role,
        familyId,
        inviteCode: acceptedInviteCode,
      };

      // Marca o convite como utilizado.
      const updatedInvites = [...invites];

      updatedInvites[inviteIndex] = {
        ...invite,
        status: 'accepted',
      };

      await AsyncStorage.setItem(
        INVITES_KEY,
        JSON.stringify(updatedInvites),
      );

      await AsyncStorage.setItem(
        ACCEPTED_CODES_KEY,
        JSON.stringify([...acceptedCodes, acceptedInviteCode]),
      );

      await AsyncStorage.setItem(
        USERS_KEY,
        JSON.stringify([...users, newUser]),
      );

      await AsyncStorage.setItem(
        SESSION_KEY,
        JSON.stringify(newUser),
      );

      setUser(newUser);

      return newUser;
    },
    [],
  );

  // ----------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

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
