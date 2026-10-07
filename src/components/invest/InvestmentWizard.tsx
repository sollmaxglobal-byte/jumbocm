import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  Loader2,
  ShieldCheck,
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
import { Slider } from "@/components/ui/slider";
import { DualMoney } from "@/components/DualMoney";
import { formatUSD, formatXAF } from "@/lib/format";
import { cn } from "@/lib/utils";

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
const STEP_LABELS = ["Choose a plan", "Set amount", "Review"];

function payoutLabel(freq: string | undefined) {
  return (freq ?? "daily").replace("_", " ");
}

function dailyProfitFor(plan: Plan, amount: number) {
  return plan.profit_type === "fixed"
    ? Number(plan.fixed_daily_profit)
    : (amount * Number(plan.daily_roi_percent)) / 100;
}

/** Guided, three-step investment flow: pick a plan, set the amount, review and confirm. */
export function InvestmentWizard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [amountInput, setAmountInput] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase.from("plans").select("*").eq("active", true).order("min_amount"),
        supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle(),
      ]);
      setPlans((p as Plan[]) ?? []);
      setBalance(Number(prof?.balance ?? 0));
      setLoading(false);
    })();
  }, [user]);

  function choosePlan(plan: Plan) {
    setSelected(plan);
    setAmountInput(Number(plan.amount_type === "fixed" ? plan.fixed_amount : plan.min_amount));
  }

  const amount = selected
    ? Number(selected.amount_type === "fixed" ? selected.fixed_amount : amountInput)
    : 0;
  const dailyProfit = selected ? dailyProfitFor(selected, amount) : 0;
  const totalProfit = selected ? dailyProfit * Number(selected.duration_days) : 0;
  const totalReturn = amount + totalProfit;
  const outOfRange = selected
    ? selected.amount_type !== "fixed" &&
      (amount < Number(selected.min_amount) || amount > Number(selected.max_amount))
    : false;
  const insufficient = amount > balance;

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("activate_investment_v2", {
        _plan_id: selected.id,
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
            <Sparkles className="h-3 w-3" /> Guided investing
          </span>
          <h1 className="mt-2 font-display text-2xl text-primary md:text-3xl">Grow your money</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Three quick steps — no jargon, no guesswork.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-1.5 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet</div>
          <div className="text-sm font-bold text-primary">{formatXAF(balance)}</div>
          <div className="text-[10px] text-muted-foreground">≈ {formatUSD(balance)}</div>
        </div>
      </header>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium",
                i <= step ? "text-primary" : "text-muted-foreground",
              )}
            >
              {i + 1}. {label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1 — choose a plan */}
      {step === 0 && (
        <div className="space-y-3">
          {plans.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
              No investment plans are available right now.
            </div>
          )}
          {plans.map((plan, idx) => {
            const active = selected?.id === plan.id;
            const popular = plan.name === POPULAR;
            const baseAmount = Number(
              plan.amount_type === "fixed" ? plan.fixed_amount : plan.min_amount,
            );
            const perDay = dailyProfitFor(plan, baseAmount);
            return (
              <motion.button
                key={plan.id}
                type="button"
                onClick={() => choosePlan(plan)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={cn(
                  "relative w-full overflow-hidden rounded-2xl border p-4 text-left transition active:scale-[0.995]",
                  active
                    ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
                      {popular && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                          Popular
                        </span>
                      )}
                    </div>
                    {plan.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-transparent",
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
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
                    value={formatXAF(perDay * Number(plan.duration_days))}
                    tone="success"
                  />
                  <MiniStat icon={Zap} label="Payout" value={payoutLabel(plan.payout_frequency)} />
                </div>

                <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {plan.amount_type === "fixed" ? "Fixed amount" : "Invest from"}
                  </span>
                  <span className="font-semibold text-foreground">
                    {plan.amount_type === "fixed"
                      ? formatXAF(plan.fixed_amount)
                      : `${formatXAF(plan.min_amount)} – ${formatXAF(plan.max_amount)}`}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Step 2 — set the amount */}
      {step === 1 && selected && (
        <motion.div
          key="amount"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Investing in
                </p>
                <p className="text-lg font-bold text-foreground">{selected.name}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase text-primary">
                {payoutLabel(selected.payout_frequency)}
              </span>
            </div>

            {selected.amount_type === "fixed" ? (
              <div className="mt-4 rounded-2xl bg-secondary/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">This plan has a fixed amount</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {formatXAF(selected.fixed_amount)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ≈ {formatUSD(selected.fixed_amount)}
                </p>
              </div>
            ) : (
              <>
                <label
                  htmlFor="invest-amount"
                  className="mt-4 block text-xs font-medium text-muted-foreground"
                >
                  Amount to invest (XAF)
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    id="invest-amount"
                    type="number"
                    inputMode="numeric"
                    step={500}
                    min={selected.min_amount}
                    max={selected.max_amount}
                    value={amountInput || ""}
                    onChange={(e) => setAmountInput(Number(e.target.value))}
                    className="text-lg font-bold tabular-nums"
                  />
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">XAF</span>
                </div>
                <div className="mt-4">
                  <Slider
                    value={[
                      Math.min(Math.max(amountInput, selected.min_amount), selected.max_amount),
                    ]}
                    min={Number(selected.min_amount)}
                    max={Number(selected.max_amount)}
                    step={500}
                    onValueChange={([v]) => setAmountInput(v)}
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>Min {formatXAF(selected.min_amount)}</span>
                    <span>Max {formatXAF(selected.max_amount)}</span>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {(
                    [
                      ["Minimum", Number(selected.min_amount)],
                      [
                        "Halfway",
                        Math.round(
                          (Number(selected.min_amount) + Number(selected.max_amount)) / 2 / 500,
                        ) * 500,
                      ],
                      ["Maximum", Number(selected.max_amount)],
                    ] as const
                  ).map(([label, value]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAmountInput(value)}
                      className="flex-1 rounded-full border border-border bg-secondary/40 px-2 py-1.5 text-[11px] font-medium text-foreground transition hover:border-primary/40 hover:text-primary"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {outOfRange && (
                  <p className="mt-2 text-[11px] font-medium text-destructive">
                    Enter an amount between {formatXAF(selected.min_amount)} and{" "}
                    {formatXAF(selected.max_amount)}.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Live projection */}
          <div className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Projected return
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Daily profit
                </p>
                <DualMoney
                  value={dailyProfit}
                  primary="usd"
                  primaryClassName="text-lg font-bold tabular-nums text-success"
                  usdClassName="text-[10px] text-muted-foreground"
                />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total profit
                </p>
                <DualMoney
                  value={totalProfit}
                  primary="usd"
                  primaryClassName="text-lg font-bold tabular-nums text-success"
                  usdClassName="text-[10px] text-muted-foreground"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-primary/15 pt-3 text-sm">
              <span className="text-muted-foreground">
                Total back after {selected.duration_days} days
              </span>
              <span className="font-bold tabular-nums text-foreground">
                {formatXAF(totalReturn)}
              </span>
            </div>
          </div>

          {insufficient && (
            <div className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your wallet has {formatXAF(balance)}. You can still review this investment and top
                up on the next step.
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Step 3 — review & confirm */}
      {step === 2 && selected && (
        <motion.div
          key="review"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="rounded-3xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  Review the details before activating.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <Row label="Amount invested" value={formatXAF(amount)} />
              <Row label="Daily profit" value={formatXAF(dailyProfit)} accent />
              <Row label="Duration" value={`${selected.duration_days} days`} />
              <Row label="Payout" value={payoutLabel(selected.payout_frequency)} />
              <Row
                label={`Total profit (${selected.duration_days} days)`}
                value={formatXAF(totalProfit)}
                accent
              />
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Total back</span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatXAF(totalReturn)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Wallet balance</span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    insufficient ? "text-warning" : "text-foreground",
                  )}
                >
                  {formatXAF(balance)}
                </span>
              </div>
            </div>
          </div>

          {insufficient && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-xs">
              <p className="font-semibold text-warning">Insufficient wallet balance</p>
              <p className="mt-1 text-muted-foreground">
                You need {formatXAF(amount - balance)} more to activate this plan.
              </p>
              <Button
                onClick={() => navigate({ to: "/dashboard/deposit" })}
                className="mt-3 w-full rounded-xl bg-warning text-white hover:bg-warning/90"
              >
                Top up wallet <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-1">
        {step > 0 && (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setStep((s) => s - 1)}
            disabled={busy}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        )}
        {step === 0 && (
          <Button
            className="flex-1 rounded-xl font-semibold"
            disabled={!selected}
            onClick={() => setStep(1)}
          >
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        {step === 1 && (
          <Button
            className="flex-1 rounded-xl font-semibold"
            disabled={!selected || outOfRange || amount <= 0}
            onClick={() => setStep(2)}
          >
            Review investment <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        {step === 2 && (
          <Button
            className="flex-1 rounded-xl font-semibold"
            onClick={confirm}
            disabled={busy || insufficient || outOfRange}
          >
            {busy ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Processing…
              </>
            ) : (
              <>Confirm investment</>
            )}
          </Button>
        )}
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

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-bold tabular-nums", accent ? "text-success" : "text-foreground")}>
        {value}
      </span>
    </div>
  );
}
