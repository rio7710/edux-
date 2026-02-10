import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/mcpClient";

interface User {
  id: string;
  email: string;
  name: string;
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
  register: (
    email: string,
    password: string,
    name: string,
    isInstructorRequested?: boolean,
  ) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  extendSession: () => Promise<number | null>;
  issueTestToken: (minutes: number) => Promise<number | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "edux_auth";

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore auth state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const auth: StoredAuth = JSON.parse(stored);
        setAccessToken(auth.accessToken);
        setRefreshToken(auth.refreshToken);
        setUser(auth.user);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const saveAuth = (auth: StoredAuth) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    setAccessToken(auth.accessToken);
    setRefreshToken(auth.refreshToken);
    setUser(auth.user);
  };

  const clearAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const login = async (email: string, password: string) => {
    const result = (await api.userLogin({ email, password })) as {
      user: User;
      accessToken: string;
      refreshToken: string;
    };
    saveAuth({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  };

  const register = async (
    email: string,
    password: string,
    name: string,
    isInstructorRequested?: boolean,
  ) => {
    await api.userRegister({ email, password, name, isInstructorRequested });
    // After registration, auto login
    await login(email, password);
  };

  const logout = () => {
    clearAuth();
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const auth: StoredAuth = JSON.parse(stored);
      auth.user = updatedUser;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
  };

  const extendSession = async () => {
    if (!refreshToken) return null;
    const result = (await api.userRefreshToken({ refreshToken })) as {
      accessToken: string;
      minutes: number;
    };
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const auth: StoredAuth = JSON.parse(stored);
      auth.accessToken = result.accessToken;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
    setAccessToken(result.accessToken);
    return result.minutes;
  };

  const issueTestToken = async (minutes: number) => {
    if (!accessToken) return null;
    const result = (await api.userIssueTestToken({ token: accessToken, minutes })) as {
      accessToken: string;
      minutes: number;
    };
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const auth: StoredAuth = JSON.parse(stored);
      auth.accessToken = result.accessToken;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
    setAccessToken(result.accessToken);
    return result.minutes;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isAuthenticated: !!accessToken && !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        extendSession,
        issueTestToken,
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
