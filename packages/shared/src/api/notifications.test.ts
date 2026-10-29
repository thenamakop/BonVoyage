import { describe, expect, it } from 'vitest';
import { NOTIFICATION_TYPES, notificationMessage, type NotificationPayload } from './notifications';

// S5-3: one sentence per type, from the payload alone.

const payload = (over: Partial<NotificationPayload> = {}): NotificationPayload => ({
  tripId: 't1',
  tripTitle: 'Hills',
  actorName: 'Asha',
  ...over,
});

describe('notificationMessage', () => {
  it('words every type, and none of them carries the trip id', () => {
    for (const type of NOTIFICATION_TYPES) {
      const message = notificationMessage(type, payload());
      expect(message.length, type).toBeGreaterThan(10);
      expect(message, type).not.toContain('t1');
    }
  });

  it('names the actor where the sentence needs one', () => {
    expect(notificationMessage('member_joined', payload())).toBe('Asha joined the trip');
    expect(notificationMessage('preferences_reminder', payload())).toBe(
      'Asha asked you to add your preferences',
    );
    expect(notificationMessage('shortlist_reopened', payload())).toBe(
      'Asha asked for new recommendations',
    );
    expect(notificationMessage('package_chosen', payload())).toBe('Asha chose a package');
    expect(notificationMessage('trip_cancelled', payload())).toBe('Asha cancelled the trip');
  });

  it('reads "Someone" when the actor is unknown', () => {
    expect(notificationMessage('trip_cancelled', payload({ actorName: undefined }))).toBe(
      'Someone cancelled the trip',
    );
  });

  it('tells a member who was left out, and everyone else that preferences closed', () => {
    expect(notificationMessage('submissions_closed', payload({ excluded: true }))).toBe(
      'You were not included because preferences closed before you submitted',
    );
    expect(notificationMessage('submissions_closed', payload())).toBe(
      'Preferences are closed. The trip is ready for recommendations',
    );
  });
});
