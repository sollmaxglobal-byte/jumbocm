import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  Loader2,
  Sparkles,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DualMoney } from "@/components/DualMoney";
import { formatUSD, formatXAF } from "@/lib/format";
import { cn } from "@/lib/utils";
import { clearPendingInvestment, getPendingInvestment } from "@/lib/pending-investment";

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

const POPULAR = "Growth Plan";

function payoutLabel(freq: string | undefined) {
  return (freq ?? "daily").replace("_", " ");
}

function dailyProfitFor(plan: Plan, amount: number) {
  return plan.profit_type === "fixed"
    ? Number(plan.fixed_daily_profit)
    : (amount * Number(plan.daily_roi_percent)) / 100;
}

function defaultAmount(plan: Plan) {
  return Number(plan.amount_type === "fixed" ? plan.fixed_amount : plan.min_amount);
}

/** Plans are activated in one tap. When the wallet is short, the shortfall is shown
 *  with a Deposit action that carries the full plan amount straight into payment. */
export function InvestmentWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase.from("plans").select("*").eq("active", true).order("min_amount"),
        supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle(),
      ]);
      setPlans((p as Plan[]) ?? []);
      setBalance(Number(prof?.balance ?? 0));
      setPendingPlanId(getPendingInvestment()?.planId ?? null);
      setLoading(false);
    })();
  }, [user]);

  function amountFor(plan: Plan) {
    return plan.amount_type === "fixed"
      ? Number(plan.fixed_amount)
      : (amounts[plan.id] ?? defaultAmount(plan));
  }

  function outOfRange(plan: Plan, amount: number) {
    return (
      plan.amount_type !== "fixed" &&
      (amount < Number(plan.min_amount) || amount > Number(plan.max_amount))
    );
  }

  async function activate(plan: Plan, amount: number) {
    setBusyId(plan.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("activate_investment_v2", {
        _plan_id: plan.id,
        _amount: amount,
      });
      if (error) throw error;
      const res = data as { investment_id: string };
      clearPendingInvestment();
      navigate({ to: "/invest/success/$id", params: { id: res.investment_id } });
    } catch (err) {
      toast.error((err as Error).message ?? "Could not activate the plan");
      setBusyId(null);
    }
  }

  function goDeposit(plan: Plan, amount: number) {
    navigate({
      to: "/dashboard/deposit",
      search: { amount, plan: plan.id } as never,
    });
  }

  if (loading) {
    return (
      <div className="grid h-dvh place-items-center text-sm text-muted-foreground">
        Loading plans…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      {/* Intro */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3 w-3" /> Activate in one tap
          </span>
          <h1 className="mt-2 font-display text-2xl text-primary md:text-3xl">Investment plans</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Activate with your wallet, or deposit the plan amount to activate automatically.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-border bg-card px-3 py-1.5 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet</div>
          <div className="text-sm font-bold text-primary">{formatXAF(balance)}</div>
          <div className="text-[10px] text-muted-foreground">≈ {formatUSD(balance)}</div>
        </div>
      </header>

      {pendingPlanId && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 text-xs text-foreground">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
          <span>
            Your deposit is being confirmed. This plan will activate on its own as soon as the
            payment clears — no need to do anything.
          </span>
        </div>
      )}

      {plans.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          No investment plans are available right now.
        </div>
      )}

      <div className="space-y-3">
        {plans.map((plan, idx) => {
          const popular = plan.name === POPULAR;
          const amount = amountFor(plan);
          const perDay = dailyProfitFor(plan, amount);
          const totalProfit = perDay * Number(plan.duration_days);
          const invalid = outOfRange(plan, amount) || amount <= 0;
          const insufficient = !invalid && amount > balance;
          const shortfall = Math.max(0, amount - balance);
          const isPending = pendingPlanId === plan.id;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-4",
                popular ? "border-primary/50 bg-primary/[0.04]" : "border-border bg-card",
              )}
            >
              {popular && (
                <span className="absolute right-0 top-0 rounded-bl-xl bg-primary px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                  Popular
                </span>
              )}

              <div className="flex items-start justify-between gap-3 pr-16">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                  {plan.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {plan.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-success">{formatXAF(perDay)}</span>
                <span className="text-xs font-medium text-muted-foreground">/ day</span>
                <span className="ml-auto text-[11px] font-medium text-muted-foreground">
                  {plan.profit_type === "percent"
                    ? `${plan.daily_roi_percent}% ROI`
                    : "fixed daily"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniStat icon={Calendar} label="Duration" value={`${plan.duration_days}d`} />
                <MiniStat
                  icon={TrendingUp}
                  label="Total profit"
                  value={formatXAF(totalProfit)}
                  tone="success"
                />
                <MiniStat icon={Zap} label="Payout" value={payoutLabel(plan.payout_frequency)} />
              </div>

              {/* Amount */}
              <div className="mt-3">
                {plan.amount_type === "fixed" ? (
                  <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Plan amount</span>
                    <span className="text-sm font-bold text-foreground">
                      {formatXAF(plan.fixed_amount)}
                    </span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Amount (XAF)</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        step={500}
                        min={plan.min_amount}
                        max={plan.max_amount}
                        value={amounts[plan.id] ?? defaultAmount(plan)}
                        onChange={(e) =>
                          setAmounts((prev) => ({ ...prev, [plan.id]: Number(e.target.value) }))
                        }
                        className="h-8 w-32 border-0 bg-transparent text-right text-sm font-bold shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <div className="mt-1 flex justify-between px-1 text-[10px] text-muted-foreground">
                      <span>Min {formatXAF(plan.min_amount)}</span>
                      <span>Max {formatXAF(plan.max_amount)}</span>
                    </div>
                  </div>
                )}
              </div>

              {invalid && (
                <p className="mt-2 text-[11px] font-medium text-destructive">
                  Enter an amount between {formatXAF(plan.min_amount)} and{" "}
                  {formatXAF(plan.max_amount)}.
                </p>
              )}

              {/* Action */}
              {insufficient ? (
                <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-warning">
                    <Wallet className="h-4 w-4 shrink-0" />
                    Insufficient balance
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    You need {formatXAF(shortfall)} more. Deposit {formatXAF(amount)} and this plan
                    activates automatically once your payment is confirmed.
                  </p>
                  <Button
                    onClick={() => goDeposit(plan, amount)}
                    className="mt-2.5 h-11 w-full rounded-xl bg-warning text-white hover:bg-warning/90"
                  >
                    Deposit {formatXAF(amount)} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => activate(plan, amount)}
                  disabled={busyId !== null || invalid}
                  className="mt-3 h-11 w-full rounded-xl font-semibold"
                >
                  {busyId === plan.id ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Activating…
                    </>
                  ) : isPending ? (
                    <>
                      <Check className="mr-1 h-4 w-4" /> Activate plan
                    </>
                  ) : (
                    <>Activate plan · {formatXAF(amount)}</>
                  )}
                </Button>
              )}
            </motion.div>
          );
        })}
      </div>

      <p className="px-2 text-center text-[10px] leading-relaxed text-muted-foreground">
        Profit is paid according to each plan's payout schedule. Investments carry risk. Past
        performance does not guarantee future returns.
      </p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-xs font-semibold capitalize",
          tone === "success" ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
