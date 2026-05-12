import { useState } from 'react';
import { ShieldCheck, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

type State = 'idle' | 'loading' | 'sent' | 'error';

export default function AdminLogin() {
  const { requestLogin } = useAdminAuth();

  const [email,    setEmail]    = useState('');
  const [state,    setState]    = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const isValidEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      setState('error');
      return;
    }

    setState('loading');
    setErrorMsg('');

    try {
      await requestLogin(email.trim().toLowerCase());
      // Always show sent — backend never reveals whether the admin exists.
      setState('sent');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMsg(msg);
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-secondary-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-secondary-700 border border-secondary-600 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Admin Portal</h1>
          <p className="mt-2 text-secondary-400">
            Enter your admin email to receive a login link.
          </p>
        </div>

        {/* Card */}
        <div className="bg-secondary-800 rounded-2xl border border-secondary-700 p-8">

          {state === 'sent' ? (
            // ── Success state ────────────────────────────────────────────
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Check your email
              </h2>
              <p className="text-secondary-400 text-sm">
                If{' '}
                <span className="font-medium text-secondary-200">{email}</span>{' '}
                is registered as an admin, a login link has been sent.
                <br />
                The link expires in 15 minutes.
              </p>
              <button
                onClick={() => { setState('idle'); setEmail(''); }}
                className="mt-6 text-sm text-primary-400 hover:text-primary-300 font-medium"
              >
                Use a different email
              </button>
            </div>
          ) : (
            // ── Form state ───────────────────────────────────────────────
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-sm font-medium text-secondary-300 mb-1.5"
                >
                  Admin email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state === 'error') setState('idle');
                  }}
                  placeholder="admin@yourcompany.com"
                  className={`
                    w-full px-4 py-2.5 rounded-lg border text-white text-sm
                    placeholder:text-secondary-500 outline-none transition-colors
                    focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                    ${state === 'error'
                      ? 'border-error-500 bg-error-900/20'
                      : 'border-secondary-600 bg-secondary-700 hover:border-secondary-500'}
                  `}
                  disabled={state === 'loading'}
                />
              </div>

              {/* Error message */}
              {state === 'error' && errorMsg && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-900/30 border border-error-800">
                  <AlertCircle className="w-4 h-4 text-error-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-error-300">{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'loading' || !email.trim()}
                className="
                  w-full flex items-center justify-center gap-2 px-4 py-2.5
                  rounded-lg bg-primary-600 text-white text-sm font-medium
                  transition-colors hover:bg-primary-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {state === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send Login Link'
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-secondary-600">
          Restricted access. Unauthorised login attempts are logged.
        </p>
      </div>
    </div>
  );
}
