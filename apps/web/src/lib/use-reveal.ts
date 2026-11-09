import { useEffect, useRef } from 'react';

/**
 * Marks an element with data-revealed once it scrolls into view, so CSS can
 * rise it in (the `reveal` utility). It reveals once and then stops watching.
 * Without IntersectionObserver (jsdom, very old browsers) it reveals at once,
 * so nothing stays hidden.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      element.dataset.revealed = '';
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          element.dataset.revealed = '';
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}
