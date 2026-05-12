import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import api, { TOKEN_KEY } from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface User {
  email: string;
  domain: string;
}

interface AuthContextValue {
  user:         User | null;
  token:        string | null;
  loading:      boolean;
  requestLogin: (email: string) => Promise<void>;
  verifyLogin:  (magicToken: string) => Promise<void>;
  logout:       () => void;
  checkAuth:    () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Validate an existing token against /auth/me. On failure the token is
  // discarded so the user is returned to the login page.
  const checkAuth = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get<{ success: boolean; data: User }>('/auth/me');
      if (data.success) {
        setToken(stored);
        setUser(data.data);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate token on mount.
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Send a magic-link email. No token is returned — the user must click the link.
  async function requestLogin(email: string): Promise<void> {
    await api.post('/auth/request-login', { email });
  }

  // Exchange a magic-link token for a session token.
  async function verifyLogin(magicToken: string): Promise<void> {
    const { data } = await api.post<{
      success: boolean;
      data: { token: string; user: User };
    }>('/auth/verify', { token: magicToken });

    if (!data.success) throw new Error('Verification failed.');

    localStorage.setItem(TOKEN_KEY, data.data.token);
    setToken(data.data.token);
    setUser(data.data.user);
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, requestLogin, verifyLogin, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
