import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../../components/ui/Spinner';
import { useMe } from './api';

export function RequireAuth() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Checking your session" />
      </div>
    );
  }
  if (me.data === null || me.data === undefined) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  return <Outlet />;
}
