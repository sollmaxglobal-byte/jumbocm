/** Shared investment-plan shape and projections used across the invest flow. */
export type Plan = {
  id: string;
  name: string;
  description: string | null;
  min_amount: number;
  max_amount: number;
  daily_roi_percent: number;
  duration_days: number;
  profit_type: "percent" | "fixed";
  fixed_daily_profit: number;
  payout_frequency: "daily" | "weekly" | "monthly" | "end_of_term";
  amount_type: "range" | "fixed";
  fixed_amount: number;
};

export function payoutLabel(freq: string | null | undefined) {
  return (freq ?? "daily").replace("_", " ");
}

export function dailyProfitFor(plan: Plan, amount: number) {
  return plan.profit_type === "fixed"
    ? Number(plan.fixed_daily_profit)
    : (amount * Number(plan.daily_roi_percent)) / 100;
}
