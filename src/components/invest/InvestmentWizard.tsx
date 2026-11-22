import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, Loader2, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { DualMoney } from "@/components/DualMoney";
import { formatUSD, formatXAF } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlanOption } from "./PlanOption";
import { dailyProfitFor, type Plan } from "./planMath";

/**
 * Single-screen investment activation: choose a plan, set the amount, and
 * activate from the always-visible action bar. When the wallet can't cover the
 * amount, activating sends the customer to the deposit page with that amount
 * already filled in.
 */
export function InvestmentWizard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
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

  /** Sends the customer to the deposit page with the amount they entered. */
  function goToDeposit() {
    navigate({ to: "/dashboard/deposit", search: { amount } });
  }

  async function activate() {
    if (!selected) return;
    if (amount <= 0 || outOfRange) {
      toast.error(
        t("Enter an amount between {min} and {max}.", {
          min: formatXAF(selected.min_amount),
          max: formatXAF(selected.max_amount),
        }),
      );
      return;
    }
    if (insufficient) {
      goToDeposit();
      return;
    }
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
      toast.error((err as Error).message ?? t("Could not activate the plan"));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="grid h-dvh place-items-center text-sm text-muted-foreground">
        {t("Loading plans…")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pb-52 md:max-w-2xl md:pb-6">
      {/* Back out of the flow */}
      <div className="mb-3 flex items-center justify-between text-xs">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 font-medium text-muted-foreground transition hover:text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {t("Dashboard")}
        </Link>
        <Link
          to="/dashboard/wallet"
          className="inline-flex items-center gap-1 font-medium text-muted-foreground transition hover:text-primary"
        >
          <Wallet className="h-3.5 w-3.5" /> {t("Wallet")}
        </Link>
      </div>

      {/* Compact header with the wallet balance */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#06333B] via-[#0B4E57] to-[#127A6E] p-4 text-white shadow-[0_20px_50px_-32px_rgba(6,51,59,0.9)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/80">
              <Sparkles className="h-3 w-3" /> {t("Investment plan")}
            </span>
            <h1 className="mt-2 font-display text-[24px] leading-tight">{t("Activate a plan")}</h1>
            <p className="mt-1 text-[11px] leading-relaxed text-white/70">
              {t("Pick a plan, set the amount, activate in one tap.")}
            </p>
          </div>
          <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-right backdrop-blur">
            <p className="text-[9px] uppercase tracking-wider text-white/60">{t("Wallet")}</p>
            <p className="mt-0.5 text-[15px] font-bold leading-none tabular-nums">
              {formatUSD(balance)}
            </p>
            <p className="mt-1 text-[9px] tabular-nums text-white/60">{formatXAF(balance)}</p>
          </div>
        </div>
      </section>

      {/* 1 — choose a plan */}
      <section className="mt-4">
        <div className="mb-2 flex items-end justify-between">
          <h2 className="text-sm font-semibold text-foreground">{t("1. Choose a plan")}</h2>
          <span className="text-[11px] text-muted-foreground">
            {t("{count} available", { count: plans.length })}
          </span>
        </div>

        {plans.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            {t("No investment plans are available right now.")}
          </div>
        ) : (
          <div
            role="radiogroup"
            aria-label={t("Choose a plan")}
            className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0"
          >
            {plans.map((plan, idx) => (
              <PlanOption
                key={plan.id}
                plan={plan}
                index={idx}
                active={selected?.id === plan.id}
                onSelect={() => choosePlan(plan)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 2 — set the amount */}
      {selected && (
        <motion.section
          key={selected.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4"
        >
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t("2. Set the amount")}</h2>
          <div className="rounded-3xl border border-border bg-card p-4">
            {selected.amount_type === "fixed" ? (
              <div className="rounded-2xl bg-secondary/50 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">
                  {t("This plan has a fixed amount")}
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
                  {formatXAF(selected.fixed_amount)}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  ≈ {formatUSD(selected.fixed_amount)}
                </p>
              </div>
            ) : (
              <>
                <label
                  htmlFor="invest-amount"
                  className="block text-xs font-medium text-muted-foreground"
                >
                  {t("How much do you want to invest?")}
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

                <div className="mt-3 flex gap-2">
                  {(
                    [
                      [t("Minimum"), Number(selected.min_amount)],
                      [
                        t("Halfway"),
                        Math.round(
                          (Number(selected.min_amount) + Number(selected.max_amount)) / 2 / 500,
                        ) * 500,
                      ],
                      [t("Maximum"), Number(selected.max_amount)],
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
                    {t("Enter an amount between {min} and {max}.", {
                      min: formatXAF(selected.min_amount),
                      max: formatXAF(selected.max_amount),
                    })}
                  </p>
                )}
              </>
            )}
          </div>
        </motion.section>
      )}

      {/* 3 — review the projection */}
      {selected && (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">{t("3. Review")}</h2>
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="space-y-2 text-[13px]">
              <Row label={t("Amount invested")} value={formatXAF(amount)} />
              <Row
                label={t("Daily profit")}
                value={`${formatXAF(dailyProfit)} · ${formatUSD(dailyProfit)}`}
                accent
              />
              <Row
                label={t("Duration")}
                value={t("{days} days", { days: selected.duration_days })}
              />
              <Row
                label={t("Total profit ({days} days)", { days: selected.duration_days })}
                value={`${formatXAF(totalProfit)} · ${formatUSD(totalProfit)}`}
                accent
              />
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-dashed border-border pt-3">
              <span className="text-xs text-muted-foreground">{t("Total back")}</span>
              <DualMoney
                value={totalReturn}
                primary="usd"
                className="items-end"
                primaryClassName="text-xl font-bold leading-none tabular-nums text-foreground"
                usdClassName="text-[10px] text-muted-foreground"
              />
            </div>
          </div>
        </section>
      )}

      <p className="mt-4 px-2 text-center text-[10px] leading-relaxed text-muted-foreground">
        {t(
          "Profit is paid according to each plan's payout schedule. Investments carry risk. Past performance does not guarantee future returns.",
        )}
      </p>

      {/* Always-visible activation bar */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 px-3 md:static md:mt-4 md:px-0">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-3 shadow-[0_-12px_30px_-20px_rgba(0,0,0,0.45)] backdrop-blur md:max-w-none">
          {selected && insufficient && (
            <p className="mb-2 rounded-xl bg-warning/10 px-2.5 py-1.5 text-[11px] leading-snug text-warning">
              {t(
                "Your balance is short. Activating opens the payment page with {amount} filled in.",
                { amount: formatXAF(amount) },
              )}
            </p>
          )}

          <Button
            onClick={activate}
            disabled={!selected || busy || amount <= 0 || outOfRange}
            className="h-12 w-full rounded-2xl text-sm font-semibold"
          >
            {busy ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> {t("Processing…")}
              </>
            ) : !selected ? (
              t("Select a plan")
            ) : insufficient ? (
              <>
                {t("Deposit & activate")} <ArrowRight className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                {t("Activate plan")} <ArrowRight className="ml-1 h-4 w-4" />
              </>
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
