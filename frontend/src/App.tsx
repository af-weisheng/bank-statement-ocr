import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider }      from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { ToastProvider }     from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute     from './components/AdminRoute';

import Login            from './pages/Login';
import VerifyEmail      from './pages/VerifyEmail';
import Dashboard        from './pages/Dashboard';
import AdminLogin       from './pages/admin/AdminLogin';
import AdminVerifyEmail from './pages/admin/AdminVerifyEmail';
import AdminDashboard   from './pages/admin/AdminDashboard';
import NotFound         from './pages/NotFound';

export default function App() {
  return (
    // AuthProvider and AdminAuthProvider are independent — wrapping both at the
    // root means every page can access whichever context it needs.
    <ToastProvider>
    <AuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Public user routes ───────────────────────────────────── */}
            <Route path="/"       element={<Login />} />
            <Route path="/verify" element={<VerifyEmail />} />

            {/* ── Protected user route ─────────────────────────────────── */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* ── Public admin routes ──────────────────────────────────── */}
            <Route path="/admin/login"  element={<AdminLogin />} />
            <Route path="/admin/verify" element={<AdminVerifyEmail />} />

            {/* ── Protected admin route ────────────────────────────────── */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />

            {/* ── 404 ──────────────────────────────────────────────────── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </AuthProvider>
    </ToastProvider>
  );
}
