import { z } from 'zod';

export const MeResponse = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  homeHubSlug: z.string().nullable(),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const SignUpInput = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(12).max(128),
});
export type SignUpInput = z.infer<typeof SignUpInput>;

export const SignInInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SignInInput = z.infer<typeof SignInInput>;
