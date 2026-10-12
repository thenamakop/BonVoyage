// The footer health indicator's words (never colour alone).
export function describeHealth(
  isPending: boolean,
  isSuccess: boolean,
): { ok: boolean; text: string } {
  if (isPending) return { ok: true, text: 'Checking the service' };
  if (isSuccess) return { ok: true, text: 'All systems normal' };
  return { ok: false, text: 'Service problem' };
}
