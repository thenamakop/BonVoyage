import { SignInInput } from '@bonvoyage/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { useMe } from '../../features/auth/api';
import { signInEmail } from '../../lib/auth-client';
import { safeNext } from '../../lib/safe-next';
import { useDocumentTitle } from '../../lib/use-document-title';

export function SignInPage() {
  useDocumentTitle('Sign in');
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (me.data) return <Navigate to="/trips" replace />;

  const next = params.get('next');
  const signUpLink = `/sign-up${next ? `?next=${encodeURIComponent(next)}` : ''}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!SignInInput.safeParse({ email, password }).success) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    const result = await signInEmail({ email: email.trim(), password });
    setBusy(false);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      void navigate(safeNext(next));
      return;
    }
    setError(
      result.code === 'INVALID_EMAIL_OR_PASSWORD'
        ? 'Email or password is incorrect.'
        : 'We could not sign you in. Try again.',
    );
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-bold">Sign in</h1>
      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" fullWidth loading={busy}>
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        New here?{' '}
        <Link to={signUpLink} className="font-medium text-brand-700 underline">
          Create an account
        </Link>
      </p>
    </Card>
  );
}
