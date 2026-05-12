import { useState } from 'react';
import { Mail, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type State = 'idle' | 'loading' | 'sent' | 'error';

export default function Login() {
  const { requestLogin } = useAuth();

  const [email,   setEmail]   = useState('');
  const [state,   setState]   = useState<State>('idle');
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
      setState('sent');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMsg(msg);
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-600 mb-4">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Bank Statement OCR</h1>
          <p className="mt-2 text-secondary-600">
            Enter your email to receive a login link.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">

          {state === 'sent' ? (
            // ── Success state ────────────────────────────────────────────
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-success-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Check your email
              </h2>
              <p className="text-secondary-600">
                We sent a login link to{' '}
                <span className="font-medium text-gray-900">{email}</span>.
                <br />
                The link expires in 15 minutes.
              </p>
              <button
                onClick={() => { setState('idle'); setEmail(''); }}
                className="mt-6 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Use a different email
              </button>
            </div>
          ) : (
            // ── Form state ───────────────────────────────────────────────
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (state === 'error') setState('idle');
                  }}
                  placeholder="you@yourcompany.com"
                  className={`
                    w-full px-4 py-2.5 rounded-lg border text-gray-900 text-sm
                    placeholder:text-gray-400 outline-none transition-colors
                    focus:ring-2 focus:ring-primary-600 focus:border-primary-600
                    ${state === 'error'
                      ? 'border-error-500 bg-error-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'}
                  `}
                  disabled={state === 'loading'}
                />
              </div>

              {/* Error message */}
              {state === 'error' && errorMsg && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-50 border border-error-200">
                  <AlertCircle className="w-4 h-4 text-error-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-error-700">{errorMsg}</p>
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

        <p className="mt-6 text-center text-xs text-secondary-500">
          Only email addresses from registered domains can sign in.
        </p>
      </div>
    </div>
  );
}
