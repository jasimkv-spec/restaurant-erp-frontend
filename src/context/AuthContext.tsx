import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  api,
  clearSession,
  getActiveCompanyScope,
  getStoredUser,
  getToken,
  setActiveCompanyScope,
  setSession,
  type AuthedUser,
  type CompanyScope,
} from "../lib/apiClient";

/** Auto-resolves the company scope when there's nothing meaningful to choose: zero or one company means there's no real decision, so don't make the user click through a chooser screen for it. Mirrors the same "lock the field, don't ask" idea singleBranch already uses on Material Requests. */
function autoResolveScope(user: AuthedUser): CompanyScope | null {
  const companies = user.companies ?? [];
  if (companies.length <= 1) return companies.length === 1 ? companies[0].id : "GLOBAL";
  return null;
}

interface AuthContextValue {
  user: AuthedUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** null = authenticated but hasn't picked a company scope yet - RequireAuth should route to /choose-company. */
  activeCompanyScope: CompanyScope | null;
  setActiveCompanyScope: (scope: CompanyScope) => void;
  /** True only when there's an actual choice to make (2+ companies) and none has been made this session yet. */
  needsCompanyChoice: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthedUser | null>(() => (getToken() ? getStoredUser() : null));
  const [scope, setScope] = useState<CompanyScope | null>(() => {
    if (!getToken()) return null;
    const stored = getActiveCompanyScope();
    if (stored) return stored;
    const storedUser = getStoredUser();
    // Session predates this feature, or scope was otherwise never set -
    // resolve it the same way a fresh login would, so an existing logged-in
    // user isn't stuck without a usable scope after this update ships.
    const resolved = storedUser ? autoResolveScope(storedUser) : null;
    if (resolved) setActiveCompanyScope(resolved);
    return resolved;
  });

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: loggedInUser } = await api.login(email, password);
    setSession(token, loggedInUser);
    setUser(loggedInUser);
    const resolved = autoResolveScope(loggedInUser);
    if (resolved) {
      setActiveCompanyScope(resolved);
      setScope(resolved);
    } else {
      setScope(null);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setScope(null);
  }, []);

  const updateScope = useCallback((next: CompanyScope) => {
    setActiveCompanyScope(next);
    setScope(next);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      logout,
      activeCompanyScope: scope,
      setActiveCompanyScope: updateScope,
      needsCompanyChoice: user !== null && (user.companies?.length ?? 0) > 1 && scope === null,
    }),
    [user, login, logout, scope, updateScope]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
