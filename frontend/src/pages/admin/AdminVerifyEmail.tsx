import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

type State = 'verifying' | 'success' | 'error';

export default function AdminVerifyEmail() {
  const { verifyLogin }     = useAdminAuth();
  const [searchParams]      = useSearchParams();
  const navigate            = useNavigate();

  const [state, setState]   = useState<State>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

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
        setTimeout(() => navigate('/admin', { replace: true }), 1500);
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
    <div className="min-h-screen bg-secondary-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-secondary-800 rounded-2xl border border-secondary-700 p-10 text-center">

          {state === 'verifying' && (
            <>
              <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white">
                Verifying your email…
              </h1>
              <p className="mt-2 text-sm text-secondary-400">
                This will only take a moment.
              </p>
            </>
          )}

          {state === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white">
                Login successful!
              </h1>
              <p className="mt-2 text-sm text-secondary-400">
                Redirecting you to the admin dashboard…
              </p>
            </>
          )}

          {state === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-error-500 mx-auto mb-4" />
              <h1 className="text-xl font-semibold text-white">
                Verification failed
              </h1>
              <p className="mt-2 text-sm text-secondary-400">{errorMsg}</p>
              <Link
                to="/admin/login"
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
