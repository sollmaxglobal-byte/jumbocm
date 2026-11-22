// Builds the public chat links shown on the Support page from the values an
// administrator saves in Admin → Settings → Support channels.

/** Accepts a full URL, a number with spaces/+/dashes, or a bare number. */
export function whatsappHref(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

/** Accepts a full URL, "@username", "t.me/name" or a bare username. */
export function telegramHref(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^t\.me\//i.test(raw)) return `https://${raw}`;
  const handle = raw.replace(/^@/, "").replace(/^\/+/, "");
  return handle ? `https://t.me/${handle}` : null;
}
