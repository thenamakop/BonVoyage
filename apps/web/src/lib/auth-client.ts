import { createAuthClient } from 'better-auth/react';

// One module wraps everything the app calls on Better Auth, so tests can
// vi.mock('../../lib/auth-client') and never touch the real client.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
});

export type AuthResult = { ok: true } | { ok: false; code: string; message: string };

type ClientError = { code?: string; message?: string; status?: number } | null;

function toResult(error: ClientError): AuthResult {
  return { ok: false, code: error?.code ?? 'UNKNOWN', message: error?.message ?? '' };
}

export async function signUpEmail(input: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const { error } = await authClient.signUp.email({ ...input, callbackURL: '/trips' });
  return error ? toResult(error) : { ok: true };
}

export async function signInEmail(input: { email: string; password: string }): Promise<AuthResult> {
  const { error } = await authClient.signIn.email({ ...input });
  return error ? toResult(error) : { ok: true };
}

export async function signOutUser(): Promise<AuthResult> {
  const { error } = await authClient.signOut();
  return error ? toResult(error) : { ok: true };
}
