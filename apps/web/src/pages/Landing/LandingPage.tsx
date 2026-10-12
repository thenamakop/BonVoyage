import { Navigate } from 'react-router';
import { ButtonLink } from '../../components/ui/Button';
import { useMe } from '../../features/auth/api';
import { useDocumentTitle } from '../../lib/use-document-title';

export function LandingPage() {
  useDocumentTitle('Welcome');
  const me = useMe();

  if (me.data) return <Navigate to="/trips" replace />;

  return (
    <section className="text-center">
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
