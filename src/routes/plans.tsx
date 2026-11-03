import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Coins,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Money } from "@/components/Money";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  min_amount: number;
  max_amount: number;
  daily_roi_percent: number;
  duration_days: number;
};

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Investment Plans — JumboCM" },
      { name: "description", content: "Browse JumboCM investment plans with daily ROI in XAF." },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("active", true)
        .order("min_amount", { ascending: true });
      setPlans((data as Plan[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#06333B] via-[#0B4E57] to-[#127A6E] py-16 text-white md:py-24">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#7BE3C4]/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-6xl px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
            <Sparkles className="h-3 w-3" /> Investment plans
          </span>
          <h1 className="mt-4 max-w-xl font-display text-4xl leading-[1.05] md:text-6xl">
            Pick your pace.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 md:text-base">
            Three transparent tiers with flexible amounts and daily returns paid in XAF. Start with
            what you have — scale when you're ready.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { icon: Coins, label: "Daily returns" },
              { icon: CalendarClock, label: "Fixed terms" },
              { icon: ShieldCheck, label: "Principal back" },
            ].map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/80"
              >
                <chip.icon className="h-3.5 w-3.5" /> {chip.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="mx-auto -mt-10 max-w-6xl px-4 pb-16 md:-mt-14 md:pb-24">
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          {loading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="rounded-3xl border border-border bg-card p-6">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-2/3" />
                <Skeleton className="mt-6 h-10 w-28" />
                <Skeleton className="mt-5 h-16 w-full rounded-2xl" />
                <Skeleton className="mt-4 h-3 w-3/4" />
                <Skeleton className="mt-2 h-3 w-2/3" />
                <Skeleton className="mt-6 h-11 w-full rounded-xl" />
              </div>
            ))}

          {!loading && plans.length === 0 && (
            <p className="col-span-full rounded-3xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No plans are available right now. Please check back shortly.
            </p>
          )}

          {plans.map((p, i) => {
            const featured = i === 1;
            const totalReturn = p.daily_roi_percent * p.duration_days;
            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-3xl border p-6 transition",
                  featured
                    ? "border-transparent bg-gradient-to-br from-[#0B3B45] via-[#0E5C63] to-[#0F8C7A] text-white shadow-[0_30px_70px_-35px_rgba(11,59,69,0.9)] md:-mt-4 md:mb-4"
                    : "border-border bg-card shadow-sm hover:shadow-elegant",
                )}
              >
                {featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-[#C9F158] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#14112B]">
                    Most chosen
                  </span>
                )}

                <h3
                  className={cn("font-display text-2xl", featured ? "text-white" : "text-primary")}
                >
                  {p.name}
                </h3>
                <p
                  className={cn(
                    "mt-1.5 min-h-10 text-xs leading-relaxed",
                    featured ? "text-white/70" : "text-muted-foreground",
                  )}
                >
                  {p.description}
                </p>

                <div className="mt-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold leading-none tabular-nums">
                      {p.daily_roi_percent}
                      <span className="text-xl">%</span>
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        featured ? "text-white/70" : "text-muted-foreground",
                      )}
                    >
                      / day
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-[11px] uppercase tracking-wider",
                      featured ? "text-white/60" : "text-muted-foreground",
                    )}
                  >
                    for {p.duration_days} days
                  </p>
                </div>

                <div
                  className={cn(
                    "mt-5 grid grid-cols-2 gap-2 rounded-2xl p-3",
                    featured ? "bg-white/10" : "bg-secondary/50",
                  )}
                >
                  <div>
                    <p
                      className={cn(
                        "text-[9px] uppercase tracking-wider",
                        featured ? "text-white/60" : "text-muted-foreground",
                      )}
                    >
                      Total return
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums">
                      ~{totalReturn.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p
                      className={cn(
                        "text-[9px] uppercase tracking-wider",
                        featured ? "text-white/60" : "text-muted-foreground",
                      )}
                    >
                      Term
                    </p>
                    <p className="mt-0.5 text-sm font-bold tabular-nums">{p.duration_days} days</p>
                  </div>
                </div>

                <ul
                  className={cn(
                    "mt-4 space-y-2 text-xs",
                    featured ? "text-white/80" : "text-foreground/80",
                  )}
                >
                  <li className="flex items-start gap-2">
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        featured ? "text-[#C9F158]" : "text-success",
                      )}
                    />
                    <span>
                      Start from <Money value={p.min_amount} />
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        featured ? "text-[#C9F158]" : "text-success",
                      )}
                    />
                    <span>
                      Up to <Money value={p.max_amount} />
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0",
                        featured ? "text-[#C9F158]" : "text-success",
                      )}
                    />
                    <span>Principal returned at the end of term</span>
                  </li>
                </ul>

                <Button
                  asChild
                  className={cn(
                    "mt-6 h-11 w-full rounded-xl text-sm font-semibold",
                    featured
                      ? "bg-[#C9F158] text-[#14112B] hover:bg-[#C9F158]/90"
                      : "bg-primary text-primary-foreground hover:opacity-90",
                  )}
                >
                  <Link to="/dashboard/invest">
                    Invest now <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-secondary/40 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-xl">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              How it works
            </span>
            <h2 className="mt-2 font-display text-3xl text-primary md:text-4xl">
              Three steps to your first payout.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {[
              {
                icon: Sparkles,
                title: "Choose a plan",
                copy: "Compare daily returns, terms and payout schedules side by side.",
              },
              {
                icon: Wallet,
                title: "Set your amount",
                copy: "Fund from your wallet within the plan range and preview your return.",
              },
              {
                icon: Coins,
                title: "Earn daily",
                copy: "Profit is credited automatically on the plan's payout schedule.",
              },
            ].map((step, i) => (
              <div key={step.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
