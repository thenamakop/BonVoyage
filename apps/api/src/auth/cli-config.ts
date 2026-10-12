import { createDb } from '@bonvoyage/db';
import { createAuth } from './auth';

// Better Auth's CLI loads this file to read the auth options and generate the
// drizzle schema. The pool points at a URL that never connects.
const { db } = createDb('postgres://localhost:1/cli');

export const auth = createAuth({
  db,
  secret: 'cli-only-secret-not-a-real-secret!',
  baseURL: 'http://localhost:4000',
});
