import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { MeResponse } from '@bonvoyage/shared';
import { signOutUser } from '../../lib/auth-client';
import { Alert } from '../ui/Alert';

export function UserMenu({ user }: { user: MeResponse }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
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

  async function onSignOut() {
    setBusy(true);
    setError(false);
    const result = await signOutUser();
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    queryClient.clear();
    void navigate('/');
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-white hover:bg-brand-900"
      >
        {user.name}
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => void onSignOut()}
            className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm text-slate-900 hover:bg-slate-100"
          >
            Sign out
          </button>
          {error ? (
            <div className="p-2">
              <Alert tone="error">Could not sign out. Try again.</Alert>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
