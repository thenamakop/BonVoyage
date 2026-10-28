import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { ButtonLink } from '../../components/ui/Button';
import { useMe } from '../../features/auth/api';
import { useDocumentTitle } from '../../lib/use-document-title';

/** A one-off line handed over in router state, e.g. after account deletion (#54). */
function noticeOf(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || !('notice' in state)) return null;
  return typeof state.notice === 'string' ? state.notice : null;
}

export function LandingPage() {
  useDocumentTitle('Welcome');
  const me = useMe();
  const location = useLocation();
  const navigate = useNavigate();
  // Read once, then drop it from the history entry: router state survives a
  // reload, and the notice must show only once.
  const [notice] = useState(() => noticeOf(location.state));
  useEffect(() => {
    if (noticeOf(location.state)) void navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  if (me.data) return <Navigate to="/trips" replace />;

  return (
    <section className="text-center">
      {notice ? (
        <div className="mx-auto mb-6 max-w-md text-left">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      <h1 className="text-3xl font-bold">Group trips, decided together.</h1>
      <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-slate-700">
        <li>· Everyone answers one short preferences form.</li>
        <li>· BonVoyage ranks the places the whole group can do.</li>
        <li>· Costed packages and a day-wise plan, all in Indian rupees.</li>
      </ul>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <ButtonLink to="/sign-up">Create an account</ButtonLink>
        <ButtonLink to="/sign-in" variant="secondary">
          Sign in
        </ButtonLink>
      </div>
    </section>
  );
}
