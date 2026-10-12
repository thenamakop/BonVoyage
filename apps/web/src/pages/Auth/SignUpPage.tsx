import { SignUpInput } from '@bonvoyage/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextField } from '../../components/ui/TextField';
import { useMe } from '../../features/auth/api';
import { signUpEmail } from '../../lib/auth-client';
import { safeNext } from '../../lib/safe-next';
import { useDocumentTitle } from '../../lib/use-document-title';

type FieldErrors = { name?: string; email?: string; password?: string };

function firstIssue(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0]);
    if (field === 'name' && !errors.name) errors.name = 'Tell us your name.';
    if (field === 'email' && !errors.email) errors.email = 'Enter a valid email address.';
    if (field === 'password' && !errors.password) errors.password = 'At least 12 characters.';
  }
  return errors;
}

export function SignUpPage() {
  useDocumentTitle('Create an account');
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  if (me.data) return <Navigate to="/trips" replace />;

  const next = params.get('next');
  const signInLink = `/sign-in${next ? `?next=${encodeURIComponent(next)}` : ''}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    const parsed = SignUpInput.safeParse({ name, email, password });
    if (!parsed.success) {
      const fieldErrors = firstIssue(parsed.error.issues);
      setErrors(fieldErrors);
      (fieldErrors.name ? nameRef : fieldErrors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await signUpEmail(parsed.data);
    setBusy(false);
    if (result.ok) {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      void navigate(safeNext(next));
      return;
    }
    if (result.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
      setErrors({ email: 'already-exists' });
      return;
    }
    if (result.code === 'PASSWORD_TOO_SHORT' || result.code === 'PASSWORD_TOO_LONG') {
      setErrors({ password: 'Between 12 and 128 characters.' });
      return;
    }
    setFormError('We could not create your account. Try again.');
  }

  const emailError =
    errors.email === 'already-exists' ? (
      <>
        An account with this email already exists.{' '}
        <Link to={signInLink} className="underline">
          Sign in instead.
        </Link>
      </>
    ) : (
      errors.email
    );

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-bold">Create an account</h1>
      {formError ? (
        <div className="mt-3">
          <Alert tone="error">{formError}</Alert>
        </div>
      ) : null}
      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4" noValidate>
        <TextField
          ref={nameRef}
          label="Name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
        />
        <div>
          <TextField
            ref={passwordRef}
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            hint="At least 12 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <button
            type="button"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
            className="mt-1 min-h-11 rounded px-2 text-xs font-medium text-brand-700 underline"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        <Button type="submit" fullWidth loading={busy}>
          Create an account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link to={signInLink} className="font-medium text-brand-700 underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
