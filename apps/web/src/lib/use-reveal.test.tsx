import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReveal } from './use-reveal';

function Section() {
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} aria-label="Revealed">
      Content
    </section>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('useReveal', () => {
  it('reveals at once when IntersectionObserver is missing (jsdom)', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Section />);
    expect(screen.getByRole('region', { name: 'Revealed' })).toHaveAttribute('data-revealed');
    expect(screen.getByText('Content')).toBeVisible();
  });

  it('waits until the section is in view, then reveals once and stops watching', () => {
    let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
    const disconnect = vi.fn();
    class FakeObserver {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    render(<Section />);
    const section = screen.getByRole('region', { name: 'Revealed' });
    expect(section).not.toHaveAttribute('data-revealed');
    act(() => notify([{ isIntersecting: false }]));
    expect(section).not.toHaveAttribute('data-revealed');
    act(() => notify([{ isIntersecting: true }]));
    expect(section).toHaveAttribute('data-revealed');
    expect(disconnect).toHaveBeenCalled();
  });
});
