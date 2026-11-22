// Builds the public chat links shown on the Support page from the values an
// administrator saves in Admin → Settings → Support channels. Each field holds
// one entry per line, so an admin can publish several WhatsApp numbers and
// several Telegram links.

export type SupportLink = { label: string; href: string };

/** Splits the stored value into its individual entries (one per line). */
export function parseSupportList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

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

/** Readable button label for a Telegram link: "@handle" instead of the full URL. */
function telegramLabel(value: string): string {
  const raw = value.trim();
  if (/^https?:\/\//i.test(raw) || /^t\.me\//i.test(raw)) {
    const handle = raw
      .replace(/^https?:\/\//i, "")
      .replace(/^t\.me\//i, "")
      .replace(/\/+$/, "");
    return handle ? `@${handle}` : raw;
  }
  return raw.startsWith("@") ? raw : `@${raw}`;
}

/** Every WhatsApp chat link the admin published. */
export function whatsappLinks(value: string | null | undefined): SupportLink[] {
  return parseSupportList(value).flatMap((entry) => {
    const href = whatsappHref(entry);
    return href ? [{ label: entry, href }] : [];
  });
}

/** Every Telegram link the admin published. */
export function telegramLinks(value: string | null | undefined): SupportLink[] {
  return parseSupportList(value).flatMap((entry) => {
    const href = telegramHref(entry);
    return href ? [{ label: telegramLabel(entry), href }] : [];
  });
}
