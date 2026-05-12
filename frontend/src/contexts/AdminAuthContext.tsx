import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import api, { ADMIN_TOKEN_KEY } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  email:           string;
  is_super_admin:  boolean;
}

interface AdminAuthContextValue {
  admin:        AdminUser | null;
  token:        string | null;
  loading:      boolean;
  requestLogin: (email: string) => Promise<void>;
  verifyLogin:  (magicToken: string) => Promise<void>;
  logout:       () => void;
  checkAuth:    () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin,   setAdmin]   = useState<AdminUser | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate an existing admin token against /auth/admin/me.
  const checkAuth = useCallback(async () => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<{ success: boolean; data: AdminUser }>(
        '/auth/admin/me'
      );
      if (data.success) {
        setToken(stored);
        setAdmin(data.data);
      }
    } catch {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setToken(null);
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Admin login never reveals whether the email exists — same behaviour as the
  // backend (prevents enumeration).
  async function requestLogin(email: string): Promise<void> {
    await api.post('/auth/admin/request-login', { email });
  }

  async function verifyLogin(magicToken: string): Promise<void> {
    const { data } = await api.post<{
      success: boolean;
      data: { token: string; admin: AdminUser };
    }>('/auth/admin/verify', { token: magicToken });

    if (!data.success) throw new Error('Verification failed.');

    localStorage.setItem(ADMIN_TOKEN_KEY, data.data.token);
    setToken(data.data.token);
    setAdmin(data.data.admin);
  }

  function logout(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
    setAdmin(null);
  }

  return (
    <AdminAuthContext.Provider
      value={{ admin, token, loading, requestLogin, verifyLogin, logout, checkAuth }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
