import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, Loader2, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatXAF } from "@/lib/format";
import { PlanOption } from "@/components/invest/PlanOption";
import { StepRail } from "@/components/invest/StepRail";
import { payoutLabel, type Plan } from "@/components/invest/planMath";

export const Route = createFileRoute("/dashboard/upgrade/$investmentId")({
  head: () => ({
    meta: [
      { title: "Upgrade your plan — JumboCM" },
      { name: "description", content: "Move an active investment to a higher plan." },
      { property: "og:title", content: "Upgrade your plan — JumboCM" },
      { property: "og:description", content: "Move an active investment to a higher plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UpgradePage,
});

type Investment = {
  id: string;
  amount: number;
  plan_id: string;
  plans: { name: string } | null;
};

type Quote = {
  investment_id: string;
  plan_id: string;
  plan_name: string;
  current_amount: number;
  target_amount: number;
  duration_days: number;
  daily_roi_percent: number;
  eligible_principal: number;
  eligible_wallet: number;
  eligible_total: number;
  required_total: number;
  wallet_needed: number;
  shortfall: number;
  pending_upgrade_id: string | null;
};

type BeginResult = Quote & {
  ok?: boolean;
  status?: string;
  upgrade_id?: string;
  deposit_amount?: number;
};

const STEPS = ["Choose plan", "Review", "Activate"];

function planTargetAmount(plan: Plan) {
  return Number(plan.amount_type === "fixed" ? plan.fixed_amount : plan.min_amount);
}

function UpgradePage() {
  const { investmentId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [investment, setInvestment] = useState<Investment | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    void (async () => {
      const [{ data: inv }, { data: planRows }] = await Promise.all([
        supabase
          .from("investments")
          .select("id,amount,plan_id,plans(name)")
          .eq("id", investmentId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("plans").select("*").eq("active", true).order("min_amount"),
      ]);
      setInvestment((inv as Investment) ?? null);
      setPlans((planRows as Plan[]) ?? []);
      setLoading(false);
    })();
  }, [user, authLoading, investmentId, navigate]);

  useEffect(() => {
    if (!selected) {
      setQuote(null);
      return;
    }
    let alive = true;
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("investment_upgrade_quote", {
        _investment_id: investmentId,
        _plan_id: selected.id,
      });
      if (!alive) return;
      if (error) {
        toast.error((error as Error).message);
        setQuote(null);
        return;
      }
      const q = data as Quote;
      setQuote(q);
      setPendingId(q.pending_upgrade_id ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [selected, investmentId]);

  const currentAmount = Number(investment?.amount ?? 0);
  const higherPlans = useMemo(
    () => plans.filter((plan) => planTargetAmount(plan) > currentAmount),
    [plans, currentAmount],
  );

  async function confirm() {
    if (!selected || !quote || busy) return;
    setBusy(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("begin_investment_upgrade", {
        _investment_id: investmentId,
        _plan_id: selected.id,
      });
      if (error) throw error;
      const res = data as BeginResult;
      if (res.status === "applied") {
        toast.success(`Upgraded to ${selected.name}`);
        navigate({ to: "/dashboard" });
        return;
      }
      const depositAmount = Number(res.deposit_amount ?? res.shortfall ?? 0);
      toast.info(`Deposit ${formatXAF(depositAmount)} to finish your upgrade`);
      navigate({
        to: "/dashboard/deposit",
        search: { amount: depositAmount, upgrade: res.upgrade_id },
      });
    } catch (err) {
      toast.error((err as Error).message ?? "Could not start the upgrade");
      setBusy(false);
    }
  }

  async function cancelPending() {
    if (!pendingId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("cancel_investment_upgrade", {
      _upgrade_id: pendingId,
    });
    if (error) {
      toast.error((error as Error).message);
      return;
    }
    setPendingId(null);
    toast.success("Pending upgrade cancelled");
  }

  if (loading || authLoading) {
    return (
      <div className="grid h-dvh place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!investment) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold text-foreground">Investment not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This investment is no longer active on your account.
        </p>
        <Button asChild className="mt-4 rounded-xl">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-2xl space-y-4 pb-6"
    >
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      {/* Current position */}
      <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#06333B] via-[#0B4E57] to-[#127A6E] p-5 text-white shadow-[0_24px_60px_-32px_rgba(6,51,59,0.9)]">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-12 h-40 w-40 rounded-full bg-[#7BE3C4]/25 blur-3xl"
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/80">
            <Sparkles className="h-3 w-3" /> Plan upgrade
          </span>
          <h1 className="mt-2 font-display text-[26px] leading-tight sm:text-3xl">
            Move up a tier
          </h1>
          <p className="mt-1 text-[11px] leading-relaxed text-white/70">
            Your active investment switches to the plan you pick and restarts its term.
          </p>
          <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-white/60">Current plan</p>
              <p className="mt-0.5 text-sm font-semibold">
                {investment.plans?.name ?? "Investment plan"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-white/60">Invested</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{formatXAF(currentAmount)}</p>
            </div>
          </div>
        </div>
      </section>

      <StepRail labels={STEPS} step={step} onBack={setStep} />

      {pendingId && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="text-[11px] leading-relaxed">
            An upgrade is waiting on its deposit. It completes automatically once that deposit is
            approved.
          </p>
          <button
            type="button"
            onClick={cancelPending}
            className="shrink-0 rounded-full bg-amber-900/10 px-2.5 py-1 text-[10px] font-semibold"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Step 1 — choose a higher plan */}
      {step === 0 && (
        <motion.div
          key="plans"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <div>
            <h2 className="text-base font-semibold text-foreground">Choose your new plan</h2>
            <p className="text-[11px] text-muted-foreground">
              Only plans above {formatXAF(currentAmount)} can be selected.
            </p>
          </div>

          {higherPlans.length === 0 && (
            <div className="rounded-3xl border border-dashed border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
              You are already on the highest available plan.
            </div>
          )}

          {higherPlans.map((plan, idx) => (
            <PlanOption
              key={plan.id}
              plan={plan}
              index={idx}
              active={selected?.id === plan.id}
              onSelect={() => {
                setSelected(plan);
                setStep(1);
              }}
            />
          ))}
        </motion.div>
      )}

      {/* Step 2 — review the money */}
      {step === 1 && selected && (
        <motion.div
          key="review"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-3"
        >
          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  New plan
                </p>
                <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(0)}
                className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary"
              >
                Change
              </button>
            </div>

            {!quote ? (
              <div className="grid place-items-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <dl className="mt-3 space-y-2 text-[12px]">
                  <Row
                    label="Required for this plan"
                    value={formatXAF(quote.required_total)}
                    strong
                  />
                  <Row
                    label="Your current investment"
                    value={`− ${formatXAF(quote.eligible_principal)}`}
                  />
                  <Row
                    label="Deposited wallet funds"
                    value={`− ${formatXAF(quote.eligible_wallet)}`}
                  />
                  <div className="border-t border-border pt-2">
                    <Row
                      label={quote.shortfall > 0 ? "Deposit needed" : "Covered by your deposits"}
                      value={formatXAF(quote.shortfall)}
                      strong
                      accent={quote.shortfall > 0 ? "warn" : "ok"}
                    />
                  </div>
                </dl>

                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success" />
                  Only deposited money counts — profits and referral bonuses are never used.
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <Mini label="Term" value={`${quote.duration_days} days`} />
                  <Mini label="Daily" value={`${quote.daily_roi_percent}%`} />
                  <Mini label="Payout" value={payoutLabel(selected.payout_frequency)} />
                </div>
              </>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <TrendingUp className="h-4 w-4" />
              </span>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {quote && quote.shortfall > 0
                  ? `You will be taken to the payment page for exactly ${formatXAF(quote.shortfall)}. As soon as that deposit is approved, your investment moves to ${selected.name} automatically.`
                  : `Your deposited funds already cover the full ${formatXAF(quote?.required_total ?? 0)}, so the upgrade activates immediately.`}
              </p>
            </div>

            <Button
              disabled={busy || !quote}
              onClick={confirm}
              className="mt-4 h-11 w-full rounded-xl text-sm font-semibold"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {quote && quote.shortfall > 0
                    ? `Deposit ${formatXAF(quote.shortfall)} & upgrade`
                    : "Confirm upgrade"}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Row({
  label,
  value,
  strong = false,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: "ok" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          accent === "warn"
            ? "font-bold tabular-nums text-accent"
            : accent === "ok"
              ? "font-bold tabular-nums text-success"
              : strong
                ? "font-semibold tabular-nums text-foreground"
                : "tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold capitalize tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
