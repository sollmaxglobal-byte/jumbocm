import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { DualMoney } from "@/components/DualMoney";
import { formatUSD, formatXAF } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlanOption } from "./PlanOption";
import { StepRail } from "./StepRail";
import { dailyProfitFor, payoutLabel, type Plan } from "./planMath";

const STEP_LABELS = ["Choose plan", "Set amount", "Review"];

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
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      {/* Back out of the flow */}
      <div className="flex items-center justify-between text-xs">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 font-medium text-muted-foreground transition hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
        <Link
          to="/dashboard/wallet"
          className="inline-flex items-center gap-1 font-medium text-muted-foreground transition hover:text-primary"
        >
          <Wallet className="h-3.5 w-3.5" /> Wallet
        </Link>
      </div>

      {/* Plan summary */}
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#06333B] via-[#0B4E57] to-[#127A6E] p-5 text-white shadow-[0_24px_60px_-32px_rgba(6,51,59,0.9)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-[#7BE3C4]/25 blur-3xl"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/80">
              <Sparkles className="h-3 w-3" /> Investment plan
            </span>
            <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-3xl">
              Grow your money
            </h1>
            <p className="mt-1 text-[11px] leading-relaxed text-white/70">
              Choose a plan, set your amount, confirm.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur">
            <p className="text-[9px] uppercase tracking-wider text-white/60">Wallet</p>
            <p className="mt-0.5 text-[15px] font-bold leading-none tabular-nums">
              {formatUSD(balance)}
            </p>
            <p className="mt-1 text-[9px] tabular-nums text-white/60">{formatXAF(balance)}</p>
          </div>
        </div>
        <div className="relative mt-4 flex items-center justify-between border-t border-white/15 pt-2.5 text-[10px] text-white/70">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> About 2 minutes
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Secure activation
          </span>
        </div>
      </section>

      <StepRail labels={STEP_LABELS} step={step} onBack={setStep} />

      {/* Step 1 — choose a plan */}
      {step === 0 && (
        <motion.div
          key="plans"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Choose a plan</h2>
              <p className="text-[11px] text-muted-foreground">
                Profit figures are per day at the plan minimum.
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {plans.length} available
            </span>
          </div>

          {plans.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
              No investment plans are available right now.
            </div>
          )}

          {plans.map((plan, idx) => (
            <PlanOption
              key={plan.id}
              plan={plan}
              index={idx}
              active={selected?.id === plan.id}
              onSelect={() => choosePlan(plan)}
            />
          ))}
        </motion.div>
      )}

      {/* Step 2 — set the amount */}
      {step === 1 && selected && (
        <motion.div
          key="amount"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Selected plan
                </p>
                <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
              >
                Change
              </button>
            </div>

            {selected.amount_type === "fixed" ? (
              <div className="mt-4 rounded-2xl bg-secondary/50 p-4 text-center">
                <p className="text-xs text-muted-foreground">This plan has a fixed amount</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
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
                  How much do you want to invest?
                </label>
                <div className="mt-2 rounded-2xl border border-border bg-secondary/40 px-4 py-3 transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
                  <div className="flex items-center gap-2">
                    <input
                      id="invest-amount"
                      type="number"
                      inputMode="numeric"
                      step={500}
                      min={selected.min_amount}
                      max={selected.max_amount}
                      value={amountInput || ""}
                      onChange={(e) => setAmountInput(Number(e.target.value))}
                      placeholder="0"
                      className="w-full min-w-0 bg-transparent text-2xl font-bold tabular-nums text-foreground outline-none placeholder:text-muted-foreground/50"
                    />
                    <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      XAF
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                    ≈ {formatUSD(amount)}
                  </p>
                </div>

                <div className="mt-3">
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
                      className={cn(
                        "flex-1 rounded-full border px-2 py-1.5 text-[11px] font-medium transition",
                        amountInput === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/40 text-foreground hover:border-primary/40 hover:text-primary",
                      )}
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
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B3B45] via-[#0E5C63] to-[#0F8C7A] p-4 text-white shadow-[0_20px_50px_-30px_rgba(11,59,69,0.85)]">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl"
            />
            <div className="relative">
              <p className="text-[9px] uppercase tracking-[0.18em] text-white/60">
                Projected return
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-white/60">Daily profit</p>
                  <DualMoney
                    value={dailyProfit}
                    primary="usd"
                    primaryClassName="text-lg font-bold tabular-nums text-white"
                    usdClassName="text-[10px] text-white/60"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-white/60">
                    Total profit · {selected.duration_days}d
                  </p>
                  <DualMoney
                    value={totalProfit}
                    primary="usd"
                    primaryClassName="text-lg font-bold tabular-nums text-white"
                    usdClassName="text-[10px] text-white/60"
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/15 pt-2.5 text-xs">
                <span className="text-white/70">
                  Total back after {selected.duration_days} days
                </span>
                <span className="font-bold tabular-nums text-white">{formatUSD(totalReturn)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
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
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex items-center gap-3 bg-primary/[0.06] px-4 py-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  Review the details before activating.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="ml-auto shrink-0 rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm transition hover:bg-primary/10"
              >
                Change
              </button>
            </div>

            <div className="space-y-2.5 px-4 py-4 text-[13px]">
              <Row label="Amount invested" value={formatXAF(amount)} />
              <Row label="Daily profit" value={formatXAF(dailyProfit)} accent />
              <Row label="Duration" value={`${selected.duration_days} days`} />
              <Row label="Payout" value={payoutLabel(selected.payout_frequency)} />
              <Row
                label={`Total profit (${selected.duration_days} days)`}
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
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
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
      <div className="flex gap-2 pt-1">
        {step > 0 && (
          <Button
            variant="outline"
            className="h-12 rounded-2xl px-4"
            onClick={() => setStep((s) => s - 1)}
            disabled={busy}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
        )}
        {step === 0 && (
          <Button
            className="h-12 flex-1 rounded-2xl text-sm font-semibold"
            disabled={!selected}
            onClick={() => setStep(1)}
          >
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        {step === 1 && (
          <Button
            className="h-12 flex-1 rounded-2xl text-sm font-semibold"
            disabled={!selected || outOfRange || amount <= 0}
            onClick={() => setStep(2)}
          >
            Review investment <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
        {step === 2 && (
          <Button
            className="h-12 flex-1 rounded-2xl text-sm font-semibold"
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
