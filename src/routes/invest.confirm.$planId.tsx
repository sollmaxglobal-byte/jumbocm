import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronLeft, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatUSD, formatXAF } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailyProfitFor, payoutLabel, type Plan } from "@/components/invest/planMath";

const searchSchema = z.object({ amount: z.coerce.number().optional() });

export const Route = createFileRoute("/invest/confirm/$planId")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Confirm your investment — JumboCM" },
      { name: "description", content: "Review and confirm your investment plan activation." },
      { property: "og:title", content: "Confirm your investment — JumboCM" },
      {
        property: "og:description",
        content: "Review and confirm your investment plan activation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfirmInvestment,
});

function ConfirmInvestment() {
  const { planId } = Route.useParams();
  const { amount: amountParam } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [balance, setBalance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    (async () => {
      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase.from("plans").select("*").eq("id", planId).maybeSingle(),
        supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle(),
      ]);
      setPlan((p as Plan) ?? null);
      setBalance(Number(prof?.balance ?? 0));
      setReady(true);
    })();
  }, [user, loading, planId, navigate]);

  const [amountInput, setAmountInput] = useState<number | null>(null);

  useEffect(() => {
    if (plan && amountInput === null) {
      setAmountInput(
        plan.amount_type === "fixed"
          ? Number(plan.fixed_amount)
          : Number(amountParam ?? plan.min_amount),
      );
    }
  }, [plan, amountParam, amountInput]);

  const amount = plan
    ? plan.amount_type === "fixed"
      ? Number(plan.fixed_amount)
      : Number(amountInput ?? plan.min_amount)
    : 0;

  const dailyProfit = plan ? dailyProfitFor(plan, amount) : 0;
  const totalProfit = plan ? dailyProfit * plan.duration_days : 0;
  const totalReturn = amount + totalProfit;

  async function confirm() {
    if (!plan) return;
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("activate_investment_v2", {
        _plan_id: plan.id,
        _amount: amount,
      });
      if (error) throw error;
      const res = data as { investment_id: string };
      navigate({ to: "/invest/success/$id", params: { id: res.investment_id } });
    } catch (err) {
      toast.error((err as Error).message ?? "Could not activate the plan");
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-primary">Plan not found</h1>
          <Button className="mt-4" onClick={() => navigate({ to: "/dashboard/invest" })}>
            Back to plans
          </Button>
        </div>
      </div>
    );
  }

  const outOfRange =
    plan.amount_type !== "fixed" && (amount < plan.min_amount || amount > plan.max_amount);
  const insufficient = amount > balance;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#06333B] via-[#0B4E57] to-[#127A6E] px-4 pb-16 pt-5 text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-md">
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard/invest" })}
            className="inline-flex items-center gap-1 text-xs font-medium text-white/70 transition hover:text-white"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to plans
          </button>
          <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/60">
            Step 3 of 3 · Review
          </p>
          <h1 className="mt-1.5 font-display text-[26px] leading-tight">Confirm your investment</h1>
          <p className="mt-1 text-[11px] text-white/70">
            Check the details below, then activate your plan.
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-10 w-full max-w-md px-4 pb-10">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 bg-primary/[0.06] px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{plan.name}</p>
              {plan.description && (
                <p className="line-clamp-1 text-[11px] text-muted-foreground">{plan.description}</p>
              )}
            </div>
          </div>

          {plan.amount_type !== "fixed" && (
            <div className="border-b border-border px-4 py-4">
              <label htmlFor="amount" className="block text-xs font-medium text-muted-foreground">
                Amount to invest
              </label>
              <div className="mt-2 rounded-2xl border border-border bg-secondary/40 px-4 py-3 transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
                <div className="flex items-center gap-2">
                  <input
                    id="amount"
                    type="number"
                    inputMode="numeric"
                    step={500}
                    min={plan.min_amount}
                    max={plan.max_amount}
                    value={amountInput ?? plan.min_amount}
                    onChange={(e) => setAmountInput(Number(e.target.value))}
                    className="w-full min-w-0 bg-transparent text-2xl font-bold tabular-nums text-foreground outline-none"
                  />
                  <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    XAF
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  ≈ {formatUSD(amount)}
                </p>
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                <span>Min {formatXAF(plan.min_amount)}</span>
                <span>Max {formatXAF(plan.max_amount)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2.5 px-4 py-4 text-[13px]">
            <Row label="Amount" value={formatXAF(amount)} />
            <Row label="Daily profit" value={formatXAF(dailyProfit)} accent />
            <Row label="Duration" value={`${plan.duration_days} days`} />
            <Row label="Payout" value={payoutLabel(plan.payout_frequency)} />
            <Row
              label={`Total profit (${plan.duration_days} days)`}
              value={formatXAF(totalProfit)}
              accent
            />
            <div className="border-t border-dashed border-border pt-3">
              <div className="flex items-end justify-between">
                <span className="text-xs text-muted-foreground">Total back</span>
                <div className="text-right">
                  <p className="text-xl font-bold leading-none tabular-nums text-foreground">
                    {formatUSD(totalReturn)}
                  </p>
                  <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    ≈ {formatXAF(totalReturn)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Wallet balance
            </span>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                insufficient ? "text-warning" : "text-foreground",
              )}
            >
              {formatXAF(balance)}
            </span>
          </div>
        </div>

        {insufficient && (
          <div className="mt-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs">
            <p className="font-semibold text-warning">Insufficient wallet balance</p>
            <p className="mt-1 text-muted-foreground">
              You need {formatXAF(amount - balance)} more to activate this plan.
            </p>
            <Button
              onClick={() => navigate({ to: "/dashboard/deposit" })}
              className="mt-3 w-full rounded-xl bg-warning text-white hover:bg-warning/90"
            >
              Go to deposit
            </Button>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="h-12 rounded-2xl px-4"
            onClick={() => navigate({ to: "/dashboard/invest" })}
          >
            Cancel
          </Button>
          <Button
            onClick={confirm}
            disabled={busy || insufficient || outOfRange}
            className="h-12 flex-1 rounded-2xl text-sm font-semibold"
          >
            {busy ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Processing…
              </>
            ) : (
              "Confirm investment"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-right font-semibold tabular-nums",
          accent ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
