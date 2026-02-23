import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/mcpClient";

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  website?: string | null;
  avatarUrl?: string | null;
  role: "admin" | "operator" | "editor" | "instructor" | "viewer" | "guest";
  createdAt: string;
  lastLoginAt: string | null;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithTokens: (auth: {
    user: User;
    accessToken: string;
    refreshToken?: string;
  }) => void;
  register: (
    email: string,
    password: string,
    name: string,
    isInstructorRequested?: boolean,
    instructorProfile?: {
      displayName?: string;
      title?: string;
      bio?: string;
      phone?: string;
      website?: string;
    },
  ) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  extendSession: () => Promise<number | null>;
  issueTestToken: (minutes: number) => Promise<number | null>;
  impersonateUser: (targetUserId: string, reason?: string) => Promise<void>;
  restoreImpersonation: () => void;
  isImpersonating: boolean;
  impersonationActor: User | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "edux_auth";
const IMPERSONATION_ORIGIN_KEY = "edux_impersonation_origin";

interface StoredAuth {
  accessToken: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [impersonationActor, setImpersonationActor] = useState<User | null>(null);

  // Restore auth state from sessionStorage on mount (migrate legacy localStorage once)
  useEffect(() => {
    const sessionStored = sessionStorage.getItem(STORAGE_KEY);
    const legacyStored = localStorage.getItem(STORAGE_KEY);
    const stored = sessionStored ?? legacyStored;
    if (stored) {
      try {
        const auth: StoredAuth = JSON.parse(stored);
        if (!sessionStored) {
          sessionStorage.setItem(STORAGE_KEY, stored);
        }
        if (legacyStored) {
          localStorage.removeItem(STORAGE_KEY);
        }
        setAccessToken(auth.accessToken);
        setUser(auth.user);
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    const sessionOrigin = sessionStorage.getItem(IMPERSONATION_ORIGIN_KEY);
    const legacyOrigin = localStorage.getItem(IMPERSONATION_ORIGIN_KEY);
    const origin = sessionOrigin ?? legacyOrigin;
    if (origin) {
      try {
        const parsed: StoredAuth = JSON.parse(origin);
        if (!sessionOrigin) {
          sessionStorage.setItem(IMPERSONATION_ORIGIN_KEY, origin);
        }
        if (legacyOrigin) {
          localStorage.removeItem(IMPERSONATION_ORIGIN_KEY);
        }
        setImpersonationActor(parsed.user);
      } catch {
        sessionStorage.removeItem(IMPERSONATION_ORIGIN_KEY);
        localStorage.removeItem(IMPERSONATION_ORIGIN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const saveAuth = (auth: StoredAuth) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    setAccessToken(auth.accessToken);
    setUser(auth.user);
  };

  const clearAuth = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(IMPERSONATION_ORIGIN_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(IMPERSONATION_ORIGIN_KEY);
    setAccessToken(null);
    setUser(null);
    setImpersonationActor(null);
  };

  const login = async (email: string, password: string) => {
    const result = (await api.userLogin({ email, password })) as {
      user: User;
      accessToken: string;
    };
    const nextAuth: StoredAuth = {
      accessToken: result.accessToken,
      user: result.user,
    };
    saveAuth(nextAuth);
  };

  const loginWithTokens = (auth: {
    user: User;
    accessToken: string;
    refreshToken?: string;
  }) => {
    saveAuth({
      user: auth.user,
      accessToken: auth.accessToken,
    });
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    isInstructorRequested?: boolean,
    instructorProfile?: {
      displayName?: string;
      title?: string;
      bio?: string;
      phone?: string;
      website?: string;
    },
  ) => {
    await api.userRegister({
      email,
      password,
      name,
      isInstructorRequested,
      ...(isInstructorRequested ? instructorProfile : {}),
    });
    // After registration, auto login
    await login(email, password);
  };

  const logout = () => {
    api.userLogout().catch(() => undefined);
    clearAuth();
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const auth: StoredAuth = JSON.parse(stored);
      auth.user = updatedUser;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
  };

  const extendSession = async () => {
    const result = (await api.userRefreshToken({ accessToken: accessToken || undefined })) as {
      accessToken: string;
      minutes: number;
      totalMinutes?: number;
    };
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const auth: StoredAuth = JSON.parse(stored);
      auth.accessToken = result.accessToken;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
    setAccessToken(result.accessToken);
    return result.totalMinutes ?? result.minutes;
  };

  const issueTestToken = async (minutes: number) => {
    if (!accessToken) return null;
    const result = (await api.userIssueTestToken({ token: accessToken, minutes })) as {
      accessToken: string;
      minutes: number;
    };
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const auth: StoredAuth = JSON.parse(stored);
      auth.accessToken = result.accessToken;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
    setAccessToken(result.accessToken);
    return result.minutes;
  };

  const impersonateUser = async (targetUserId: string, reason?: string) => {
    if (!accessToken || !user) {
      throw new Error("로그인이 필요합니다.");
    }
    if (user.role !== "admin") {
      throw new Error("관리자 권한이 필요합니다.");
    }
    if (!import.meta.env.DEV) {
      throw new Error("개발 환경에서만 사용할 수 있습니다.");
    }

    if (!sessionStorage.getItem(IMPERSONATION_ORIGIN_KEY)) {
      const origin: StoredAuth = {
        accessToken,
        user,
      };
      sessionStorage.setItem(IMPERSONATION_ORIGIN_KEY, JSON.stringify(origin));
      setImpersonationActor(user);
    }

    const result = (await api.userImpersonate({
      token: accessToken,
      targetUserId,
      reason,
    })) as {
      user: User;
      accessToken: string;
      actor?: User;
    };

    saveAuth({
      user: result.user,
      accessToken: result.accessToken,
    });
    if (result.actor) {
      setImpersonationActor(result.actor);
    }
  };

  const restoreImpersonation = () => {
    const origin = sessionStorage.getItem(IMPERSONATION_ORIGIN_KEY);
    if (!origin) return;
    try {
      const parsed: StoredAuth = JSON.parse(origin);
      saveAuth(parsed);
    } finally {
      sessionStorage.removeItem(IMPERSONATION_ORIGIN_KEY);
      localStorage.removeItem(IMPERSONATION_ORIGIN_KEY);
      setImpersonationActor(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken: null,
        isAuthenticated: !!accessToken && !!user,
        isLoading,
        login,
        loginWithTokens,
        register,
        logout,
        updateUser,
        extendSession,
        issueTestToken,
        impersonateUser,
        restoreImpersonation,
        isImpersonating: !!impersonationActor,
        impersonationActor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
