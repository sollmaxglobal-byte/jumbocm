import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Gift, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Money } from "@/components/Money";
import { DualMoney } from "@/components/DualMoney";
import { Button } from "@/components/ui/button";
import { formatDate, formatUSD, formatXAF, XAF_PER_USD } from "@/lib/format";

export const Route = createFileRoute("/dashboard/referrals")({
  head: () => ({
    meta: [
      { title: "My referrals — JumboCM" },
      {
        name: "description",
        content:
          "Track everyone you referred to JumboCM and the investment plan they are running.",
      },
      { property: "og:title", content: "My referrals — JumboCM" },
      {
        property: "og:description",
        content: "See your referral team and their active investment plans.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralsPage,
});

type Referral = {
  user_id: string;
  full_name: string | null;
  joined_at: string | null;
  plan_name: string | null;
  invested: number | null;
  investment_status: string | null;
};

function ReferralsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralEarnings, setReferralEarnings] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { data, error: err },
        { data: profile },
      ] = await Promise.all([
        (supabase as any).rpc("my_referrals"),
        supabase
          .from("profiles")
          .select("referral_code,referral_earnings")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      if (err) setError(err.message);
      setRows((data as Referral[]) ?? []);
      setReferralCode((profile as { referral_code: string | null } | null)?.referral_code ?? null);
      setReferralEarnings(Number((profile as { referral_earnings: number | null } | null)?.referral_earnings ?? 0));
      setLoading(false);
    })();
  }, [user]);

  const active = rows.filter((r) => r.investment_status === "active").length;
  const referralLink = referralCode && typeof window !== "undefined"
    ? `${window.location.origin}/register?ref=${encodeURIComponent(referralCode)}`
    : "";

  const copyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="px-2">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl text-primary md:text-3xl">Refer & Earn</h1>
          <p className="text-xs text-muted-foreground">Invite friends and earn commission on their investments.</p>
        </div>
      </div>

      {/* Promotion banner with referral link */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-foreground/15">
            <Gift className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Earn commission on every referral</h2>
            <p className="mt-1 text-xs text-primary-foreground/75">
              Share your link — you earn a commission each time your referral starts an investment plan.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-primary-foreground/10 p-3">
          <input
            readOnly
            value={referralLink || "Loading…"}
            className="min-w-0 flex-1 truncate bg-transparent text-xs font-medium text-primary-foreground/90 outline-none"
            aria-label="Your referral link"
          />
          <Button
            type="button"
            size="sm"
            onClick={copyLink}
            disabled={!referralLink}
            className="shrink-0 rounded-xl bg-primary-foreground text-primary hover:bg-primary-foreground/90"
          >
            <Copy className="h-4 w-4" /> Copy
          </Button>
        </div>
      </section>

      {/* Stats: total referrals + amount earned */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Users className="h-3 w-3" /> Total referrals
          </div>
          <div className="mt-1 font-display text-2xl font-bold uppercase tabular-nums text-primary">
            {loading ? "—" : rows.length}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Commission earned
          </div>
          <div className="mt-1.5">
            <DualMoney
              value={referralEarnings}
              primary="usd"
              primaryClassName="text-xl font-bold text-success"
              usdClassName="text-[11px] text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {/* Referral list */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No referrals yet. Share your referral link above to start earning.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <motion.div
              key={r.user_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-base text-primary">
                    {r.full_name || "Member"}
                  </div>
                  {r.joined_at && (
                    <div className="text-xs text-muted-foreground">
                      Joined {formatDate(r.joined_at)}
                    </div>
                  )}
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase ${
                    r.investment_status === "active"
                      ? "bg-success/15 text-success"
                      : "bg-muted text-foreground/70"
                  }`}
                >
                  {r.investment_status === "active" ? "Active" : "No plan"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Investment plan
                  </div>
                  <div className="text-sm font-semibold">{r.plan_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Invested
                  </div>
                  <div className="text-sm font-bold uppercase tabular-nums text-success">
                    {r.invested ? <Money value={Number(r.invested)} /> : "—"}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
