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
  const [isLoading, setIsLoading] = useState(true);

  // Restore auth state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const auth: StoredAuth = JSON.parse(stored);
        setAccessToken(auth.accessToken);
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
    setUser(auth.user);
  };

  const clearAuth = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAccessToken(null);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!accessToken && !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
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
