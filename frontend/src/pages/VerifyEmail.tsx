import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type State = 'verifying' | 'success' | 'error';

export default function VerifyEmail() {
  const { verifyLogin }     = useAuth();
  const [searchParams]      = useSearchParams();
  const navigate            = useNavigate();

  const [state, setState]   = useState<State>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  // Guard against double-invocation in React StrictMode.
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const token = searchParams.get('token');

    if (!token) {
      setErrorMsg('No verification token found in the URL.');
      setState('error');
      return;
    }

    verifyLogin(token)
      .then(() => {
        setState('success');
        // Give the user a moment to read the success message, then redirect.
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      })
      .catch((err: unknown) => {
        const msg =
          err instanceof Error ? err.message : 'Verification failed. Please try again.';
        setErrorMsg(
          msg.includes('expired') || msg.includes('invalid')
            ? 'Invalid or expired link. Please request a new one.'
            : msg
        );
        setState('error');
      });
  }, [searchParams, verifyLogin, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center">

          {state === 'verifying' && (
            <>
              <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900">
                Verifying your email…
              </h1>
              <p className="mt-2 text-sm text-secondary-600">This will only take a moment.</p>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-success-600 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900">
                Login successful!
              </h1>
              <p className="mt-2 text-sm text-secondary-600">
                Redirecting you to the dashboard…
              </p>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-error-600 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-gray-900">
                Verification failed
              </h1>
              <p className="mt-2 text-sm text-secondary-600">{errorMsg}</p>
              <Link
                to="/"
                className="
                  mt-6 inline-flex items-center justify-center w-full px-4 py-2.5
                  rounded-lg bg-primary-600 text-white text-sm font-medium
                  hover:bg-primary-700 transition-colors
                "
              >
                Request a new link
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
