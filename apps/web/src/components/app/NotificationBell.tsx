import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { indiaDateTime, type NotificationItem } from '@bonvoyage/shared';
import { useMarkAllRead, useMarkRead, useNotifications } from '../../features/notifications/api';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// S5-3: the bell in the header (M4: in-app only). The count is text, never a dot
// alone, and it all works by keyboard: Tab reaches the panel that follows the
// button, Escape closes it and returns to the button. On narrow screens the panel
// spans the header, so it never runs off a 360 px screen.

const countLabel = (unread: number) =>
  `Notifications, ${unread === 0 ? 'none' : String(unread)} unread`;

function Row({ item, onOpen }: { item: NotificationItem; onOpen: () => void }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{item.tripTitle}</span>
        {item.readAt === null ? <Badge>New</Badge> : null}
      </span>
      <span className="block text-sm text-slate-900">{item.message}</span>
      <span className="block text-xs text-slate-600">
        {indiaDateTime(new Date(item.createdAt))}
      </span>
    </>
  );
  return item.tripId ? (
    <Link
      to={`/trips/${item.tripId}`}
      onClick={onOpen}
      className="block min-h-11 rounded px-3 py-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
    >
      {body}
    </Link>
  ) : (
    <div className="px-3 py-2">{body}</div>
  );
}

export function NotificationBell() {
  const notifications = useNotifications();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const unread = notifications.data?.unreadCount ?? 0;
  const items = notifications.data?.items ?? [];

  return (
    <div ref={rootRef} className="shrink-0 sm:relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={countLabel(unread)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold text-white hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {unread > 0 ? <span>{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open ? (
        <section
          id={panelId}
          aria-label="Notifications"
          className="absolute inset-x-4 top-full z-10 mt-1 rounded-md border border-slate-200 bg-white p-2 text-slate-900 shadow-lg sm:inset-x-auto sm:right-0 sm:w-96"
        >
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="px-2 text-sm font-semibold">Notifications</h2>
            {unread > 0 ? (
              <Button variant="ghost" loading={markAll.isPending} onClick={() => markAll.mutate()}>
                Mark all as read
              </Button>
            ) : null}
          </div>
          {notifications.isPending ? (
            <p className="px-3 py-2 text-sm text-slate-600">Loading…</p>
          ) : notifications.isError && items.length === 0 ? (
            <div className="space-y-1 px-3 py-2">
              <p className="text-sm text-slate-900">Your notifications could not be loaded.</p>
              <Button variant="secondary" onClick={() => void notifications.refetch()}>
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-600">Nothing yet.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-slate-200 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Row
                    item={item}
                    onOpen={() => {
                      if (item.readAt === null) markRead.mutate(item.id);
                      setOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
