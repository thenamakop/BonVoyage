const SAFE_FALLBACK = '/trips';

// Only same-origin absolute paths are safe redirect targets: reject "//evil.com",
// "/\evil.com" and anything carrying a scheme such as "https:" or "javascript:".
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/')) return SAFE_FALLBACK;
  if (value.startsWith('//') || value.startsWith('/\\')) return SAFE_FALLBACK;
  if (/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return SAFE_FALLBACK;
  return value;
}
