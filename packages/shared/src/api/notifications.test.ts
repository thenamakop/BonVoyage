import { describe, expect, it } from 'vitest';
import { NOTIFICATION_TYPES, notificationMessage } from './notifications';

// S5-3: one sentence per type, from the type, the excluded flag and the actor's
// name as it reads today.

describe('notificationMessage', () => {
  it('words every type', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(notificationMessage(type, {}, 'Asha').length, type).toBeGreaterThan(10);
    }
  });

  it('names the actor where the sentence needs one', () => {
    expect(notificationMessage('member_joined', {}, 'Asha')).toBe('Asha joined the trip');
    expect(notificationMessage('preferences_reminder', {}, 'Asha')).toBe(
      'Asha asked you to add your preferences',
    );
    expect(notificationMessage('shortlist_reopened', {}, 'Asha')).toBe(
      'Asha asked for new recommendations',
    );
    expect(notificationMessage('package_chosen', {}, 'Asha')).toBe('Asha chose a package');
    expect(notificationMessage('trip_cancelled', {}, 'Asha')).toBe('Asha cancelled the trip');
  });

  it('reads "A former member" once the actor’s account is gone', () => {
    expect(notificationMessage('member_joined', {}, null)).toBe('A former member joined the trip');
    expect(notificationMessage('trip_cancelled', {}, null)).toBe(
      'A former member cancelled the trip',
    );
  });

  it('tells a member who was left out, and everyone else that preferences closed', () => {
    expect(notificationMessage('submissions_closed', { excluded: true }, null)).toBe(
      'You were not included because preferences closed before you submitted',
    );
    expect(notificationMessage('submissions_closed', {}, null)).toBe(
      'Preferences are closed. The trip is ready for recommendations',
    );
  });
});
