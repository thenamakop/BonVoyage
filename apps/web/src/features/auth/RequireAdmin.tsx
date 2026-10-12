import { Outlet } from 'react-router';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { useMe } from './api';

// S1-7: inside RequireAuth. Anyone not listed in ADMIN_EMAILS sees a 403 page;
// the API refuses them too, so this is the friendly message, not the guard.
export function RequireAdmin() {
  const me = useMe();
  if (me.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Checking your access" />
      </div>
    );
  }
  if (!me.data?.isAdmin) {
    return (
      <EmptyState
        title="Administrators only"
        text="This page is for BonVoyage administrators. If you need access, ask the project's administrator."
        action={<ButtonLink to="/">Go to the home page</ButtonLink>}
      />
    );
  }
  return <Outlet />;
}
