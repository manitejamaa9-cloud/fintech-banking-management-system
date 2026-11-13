import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, TOKEN_KEY, USER_KEY, handleUnauthorized } from '../lib/api';

export interface User {
  user_id: number;
  employee_id: string;
  name: string;
  email?: string;
  role: 'super_admin' | 'bank_manager' | 'financial_officer' | 'viewer';
  role_label?: string;
  branch_id: number;
  branch_name?: string;
  branch_city?: string;
}

interface LoginInput {
  employee_id: string;
  password: string;
  branch_id?: number | string;
  twoFA?: boolean;
  otp?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  initializing: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [initializing, setInitializing] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => clear();
    window.addEventListener('fintech:unauthorized', onUnauthorized);
    return () => window.removeEventListener('fintech:unauthorized', onUnauthorized);
  }, [clear]);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setInitializing(false);
      return;
    }
    let cancelled = false;
    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return;
        const next = res.data.user as User;
        setUser(next);
        localStorage.setItem(USER_KEY, JSON.stringify(next));
      })
      .catch(() => {
        if (!cancelled) clear();
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clear]);

  const login = useCallback(async (input: LoginInput) => {
    const res = await api.post('/auth/login', input);
    const nextToken = res.data.token as string;
    const nextUser = res.data.user as User;
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem(TOKEN_KEY)) await api.post('/auth/logout');
    } catch {
      // Ignore: the token is discarded locally regardless.
    }
    clear();
  }, [clear]);

  const value = useMemo(
    () => ({ user, token, initializing, login, logout, isAdmin: user?.role === 'super_admin' }),
    [user, token, initializing, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export { handleUnauthorized };
