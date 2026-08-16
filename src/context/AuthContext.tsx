import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api, clearSession, getStoredUser, getToken, setSession, type AuthedUser } from "../lib/apiClient";

interface AuthContextValue {
  user: AuthedUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthedUser | null>(() => (getToken() ? getStoredUser() : null));

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: loggedInUser } = await api.login(email, password);
    setSession(token, loggedInUser);
    setUser(loggedInUser);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: user !== null, login, logout }),
    [user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
