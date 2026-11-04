import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Copy, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatUSD, formatXAF, txRef } from "@/lib/format";

export const Route = createFileRoute("/invest/success/$id")({
  head: () => ({
    meta: [
      { title: "Investment activated — JumboCM" },
      { name: "description", content: "Your investment plan was purchased successfully." },
      { property: "og:title", content: "Investment activated — JumboCM" },
      { property: "og:description", content: "Your investment plan was purchased successfully." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvestSuccess,
});

type Details = {
  amount: number;
  duration_days: number;
  end_date: string;
  start_date: string;
  plan_name: string;
  tx_id: string | null;
};

function InvestSuccess() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const [d, setD] = useState<Details | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const { data: inv } = await supabase
        .from("investments")
        .select("amount, duration_days, start_date, end_date, plan_id")
        .eq("id", id)
        .maybeSingle();
      if (inv) {
        const [{ data: plan }, { data: tx }] = await Promise.all([
          supabase.from("plans").select("name").eq("id", inv.plan_id).maybeSingle(),
          supabase
            .from("transactions")
            .select("id")
            .eq("ref_id", id)
            .eq("type", "investment")
            .maybeSingle(),
        ]);
        setD({
          amount: Number(inv.amount),
          duration_days: inv.duration_days,
          start_date: inv.start_date,
          end_date: inv.end_date,
          plan_name: plan?.name ?? "Investment plan",
          tx_id: tx?.id ?? null,
        });
      }
      setReady(true);
    })();
  }, [id, user, loading]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const ref = txRef(d?.tx_id ?? id);

  return (
    <div className="min-h-screen bg-background">
      {/* Celebration header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#06333B] via-[#0B4E57] to-[#127A6E] px-4 pb-20 pt-10 text-center text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[#7BE3C4]/25 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-14 h-48 w-48 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative mx-auto w-full max-w-md">
          <div className="mx-auto flex h-16 w-16 animate-in zoom-in items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <CheckCircle2 className="h-9 w-9 text-[#C9F158]" />
          </div>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80">
            <Sparkles className="h-3 w-3" /> Plan active
          </span>
          <h1 className="mt-2 font-display text-[26px] leading-tight">
            Investment purchased successfully
          </h1>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/70">
            Your plan is now active and profit will be credited automatically.
          </p>
        </div>
      </div>

      <div className="mx-auto -mt-12 w-full max-w-md px-4 pb-10">
        {d && (
          <>
            {/* Headline figures */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> Invested
                </p>
                <p className="mt-1 text-lg font-bold leading-none tabular-nums text-foreground">
                  {formatUSD(d.amount)}
                </p>
                <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                  {formatXAF(d.amount)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <CalendarClock className="h-3 w-3" /> Matures
                </p>
                <p className="mt-1 text-lg font-bold leading-none tabular-nums text-foreground">
                  {d.duration_days}d
                </p>
                <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                  {new Date(d.end_date).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Receipt */}
            <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-card">
              <div className="space-y-2.5 px-4 py-4 text-[13px]">
                <Row label="Plan" value={d.plan_name} />
                <Row label="Duration" value={`${d.duration_days} days`} />
                <Row label="Start" value={new Date(d.start_date).toLocaleString()} />
                <Row label="Maturity" value={new Date(d.end_date).toLocaleString()} />
                <div className="flex items-center justify-between gap-3 border-t border-dashed border-border pt-3">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <button
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tabular-nums text-primary transition hover:bg-primary/15"
                    onClick={() => {
                      navigator.clipboard.writeText(ref);
                      toast.success("Transaction ID copied");
                    }}
                  >
                    #{ref} <Copy className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mt-4 space-y-2">
          <Button asChild className="h-12 w-full rounded-2xl text-sm font-semibold">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 w-full rounded-2xl text-sm font-semibold"
          >
            <Link to="/dashboard/invest">View more plans</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
