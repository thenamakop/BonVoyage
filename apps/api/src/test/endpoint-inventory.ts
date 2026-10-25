// S1-6: every API route and who may call it. Better Auth's /api/auth/* is out
// of scope. routes.test.ts fails when this list and the registered routes
// differ; access-matrix.test.ts states each actor's expected status by hand
// (it deliberately does not read `access`, or it would prove nothing).

export type Access =
  /** anyone, signed in or not */
  | 'public'
  /** any signed-in user, about themselves or shared catalogue data */
  | 'session'
  /** a signed-in user's own rows only (someone else's row is 404) */
  | 'owner'
  /** any member of the trip, removed members included (read-only) */
  | 'member'
  /** an active member of the trip */
  | 'activeMember'
  /** the trip's organiser */
  | 'organiser'
  /** an email listed in ADMIN_EMAILS (S1-7) */
  | 'admin';

export interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  access: Access;
}

export const ENDPOINTS: readonly Endpoint[] = [
  { method: 'GET', path: '/api/health', access: 'public' },
  { method: 'GET', path: '/api/invitations/:token', access: 'public' },

  { method: 'GET', path: '/api/me', access: 'session' },
  { method: 'GET', path: '/api/me/trips', access: 'session' },
  { method: 'GET', path: '/api/me/profile', access: 'session' },
  { method: 'PATCH', path: '/api/me/profile', access: 'session' },
  { method: 'POST', path: '/api/me/past-trips', access: 'session' },
  { method: 'DELETE', path: '/api/me/past-trips/:id', access: 'owner' },
  { method: 'GET', path: '/api/hubs', access: 'session' },
  { method: 'GET', path: '/api/destinations', access: 'session' },
  { method: 'POST', path: '/api/trips', access: 'session' },
  { method: 'POST', path: '/api/invitations/:token/accept', access: 'session' },

  { method: 'GET', path: '/api/trips/:id', access: 'member' },
  { method: 'GET', path: '/api/trips/:id/activity', access: 'member' },
  { method: 'GET', path: '/api/trips/:id/preferences/me', access: 'member' },
  { method: 'GET', path: '/api/trips/:id/recommendations/latest', access: 'member' },
  { method: 'GET', path: '/api/trips/:id/group-profile', access: 'member' },

  { method: 'PUT', path: '/api/trips/:id/preferences/me', access: 'activeMember' },
  { method: 'DELETE', path: '/api/trips/:id/members/me', access: 'activeMember' },

  { method: 'PATCH', path: '/api/trips/:id', access: 'organiser' },
  { method: 'POST', path: '/api/trips/:id/cancel', access: 'organiser' },
  { method: 'POST', path: '/api/trips/:id/close-submissions', access: 'organiser' },
  { method: 'POST', path: '/api/trips/:id/invitations', access: 'organiser' },
  { method: 'GET', path: '/api/trips/:id/invitations/active', access: 'organiser' },
  { method: 'DELETE', path: '/api/trips/:id/invitations/active', access: 'organiser' },
  { method: 'DELETE', path: '/api/trips/:id/members/:userId', access: 'organiser' },
  { method: 'POST', path: '/api/trips/:id/recommendations', access: 'organiser' },
  { method: 'POST', path: '/api/trips/:id/destination', access: 'organiser' },

  { method: 'GET', path: '/api/admin/catalogue/status', access: 'admin' },
  { method: 'POST', path: '/api/admin/catalogue/import', access: 'admin' },
];
