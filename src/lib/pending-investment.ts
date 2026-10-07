// Carries the plan a customer intends to activate through the deposit flow, so it
// can be activated automatically once the deposit is confirmed (approved) server-side.
// Persisted in localStorage only — no schema change, and it is cleared the moment
// the plan is activated or the deposit is rejected, so a plan can never activate twice.

const KEY = "jumbo_pending_investment";

export type PendingInvestment = {
  planId: string;
  amount: number;
  /** The deposit that must be approved before the plan activates. */
  depositId: string;
};

export function setPendingInvestment(value: PendingInvestment) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable — auto-activation simply won't run */
  }
}

export function getPendingInvestment(): PendingInvestment | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingInvestment>;
    if (!parsed?.planId || !parsed?.amount || !parsed?.depositId) return null;
    return { planId: parsed.planId, amount: Number(parsed.amount), depositId: parsed.depositId };
  } catch {
    return null;
  }
}

export function clearPendingInvestment() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
