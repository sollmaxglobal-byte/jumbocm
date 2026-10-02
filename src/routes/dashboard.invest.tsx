import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Zap, Calendar, Wallet, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatXAF } from "@/lib/format";

export const Route = createFileRoute("/dashboard/invest")({
  component: InvestPage,
});

type Plan = {
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

const XAF_PER_USD = 600;
const POPULAR = "Growth Plan";

function formatUSD(xaf: number) {
  const amount = xaf / XAF_PER_USD;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InvestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase.from("plans").select("*").eq("active", true).order("min_amount"),
        supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle(),
      ]);
      setPlans((p as Plan[]) ?? []);
      setBalance(Number(prof?.balance ?? 0));
      setLoading(false);
    })();
  }, [user]);

  function handlePlanClick(p: Plan) {
    const amount = Number(p.amount_type === "fixed" ? p.fixed_amount : p.min_amount);
    // If balance is insufficient, redirect to deposit
    if (amount > balance) {
      navigate({ to: "/dashboard/deposit" });
      return;
    }
    navigate({
      to: "/invest/confirm/$planId",
      params: { planId: p.id },
      search: { amount },
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
    <div className="space-y-5">
      {/* Header with wallet balance */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-primary md:text-3xl">Investment plans</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Capital + profit paid at end of term.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-1.5 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet</div>
          <div className="text-sm font-bold text-primary">{formatUSD(balance)}</div>
          <div className="text-[10px] text-muted-foreground">{formatXAF(balance)}</div>
        </div>
      </div>

      {/* Plan cards */}
      <div className="space-y-3">
        {plans.map((p, idx) => {
          const popular = p.name === POPULAR;
          const planAmount = Number(p.amount_type === "fixed" ? p.fixed_amount : p.min_amount);
          const insufficient = planAmount > balance;
          const dailyProfit = p.profit_type === "fixed"
            ? p.fixed_daily_profit
            : (planAmount * p.daily_roi_percent) / 100;
          const totalProfit = dailyProfit * p.duration_days;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${
                popular
                  ? "border-primary bg-card shadow-md"
                  : "border-border bg-card"
              }`}
            >
              {popular && (
                <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                  Popular
                </span>
              )}

              {/* Plan name + profit headline */}
              <div className="flex items-start justify-between gap-3 pr-16">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{p.name}</h3>
                  {p.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  )}
                </div>
              </div>

              {/* Profit display */}
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-success">
                  {p.profit_type === "fixed"
                    ? formatUSD(p.fixed_daily_profit)
                    : `${p.daily_roi_percent}%`}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  / day
                </span>
              </div>
              {p.profit_type === "fixed" && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatXAF(p.fixed_daily_profit)} / day
                </p>
              )}

              {/* Key stats row */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Duration
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground">{p.duration_days}d</div>
                </div>
                <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <TrendingUp className="h-3 w-3" /> Total profit
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-success">{formatUSD(totalProfit)}</div>
                </div>
                <div className="rounded-lg bg-secondary/60 px-2.5 py-2">
                  <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                    <Zap className="h-3 w-3" /> Payout
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground capitalize">
                    {(p.payout_frequency ?? "daily").replace("_", " ")}
                  </div>
                </div>
              </div>

              {/* Amount range */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  {p.amount_type === "fixed" ? "Fixed amount" : "Range"}
                </span>
                <span className="font-semibold text-foreground">
                  {p.amount_type === "fixed"
                    ? formatXAF(p.fixed_amount)
                    : `${formatXAF(p.min_amount)} – ${formatXAF(p.max_amount)}`}
                </span>
              </div>

              {/* Insufficient balance notice */}
              {insufficient && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  <Wallet className="h-3.5 w-3.5 shrink-0" />
                  <span>Insufficient balance — deposit to activate this plan.</span>
                </div>
              )}

              {/* Activate button */}
              <Button
                onClick={() => handlePlanClick(p)}
                className={`mt-4 w-full rounded-xl font-semibold ${
                  insufficient
                    ? "bg-warning text-white hover:bg-warning/90"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {insufficient ? (
                  <>
                    Deposit to activate <ArrowRight className="ml-1 h-4 w-4" />
                  </>
                ) : (
                  "Activate plan"
                )}
              </Button>
            </motion.div>
          );
        })}
      </div>

      <p className="px-2 text-center text-[10px] leading-relaxed text-muted-foreground">
        Profit is paid according to each plan's payout schedule. Investments carry risk.
        Past performance does not guarantee future returns.
      </p>
    </div>
  );
}
