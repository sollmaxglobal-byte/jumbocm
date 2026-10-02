// Deterministic formatting (no Intl) to avoid SSR/CSR hydration mismatches
// caused by different ICU versions on server vs client.

/** Indicative exchange rate used across the dashboard for display only. */
export const XAF_PER_USD = 600;

export function formatXAF(n: number | string | null | undefined): string {
  const num = Math.round(Number(n ?? 0));
  const abs = Math.abs(num);
  const grouped = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${num < 0 ? "-" : ""}${grouped} XAF`;
}

/** Deterministic XAF → USD display conversion (never the source of truth). */
export function formatUSD(n: number | string | null | undefined): string {
  const value = Math.round((Number(n ?? 0) / XAF_PER_USD) * 100) / 100;
  const [intPart, decPart] = Math.abs(value).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${value < 0 ? "-" : ""}$${grouped}.${decPart}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const day = String(dt.getUTCDate()).padStart(2, "0");
  const month = MONTHS[dt.getUTCMonth()];
  const year = dt.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

/** Short, human-friendly transaction reference derived from a UUID. */
export function txRef(id: string | null | undefined): string {
  if (!id) return "—";
  return id.replace(/-/g, "").slice(0, 12).toUpperCase();
}
