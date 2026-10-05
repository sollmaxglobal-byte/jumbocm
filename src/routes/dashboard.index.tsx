import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Gift,
  PiggyBank,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { DualMoney } from "@/components/DualMoney";
import { formatDate, formatUSD, formatXAF, XAF_PER_USD } from "@/lib/format";
import { TradingBot, type BotInvestment } from "@/components/TradingBot";
import { AITradingRobot } from "@/components/AITradingRobot";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Account overview — JumboCM" },
      { name: "description", content: "View your JumboCM balance, profit and active investments." },
      { property: "og:title", content: "Account overview — JumboCM" },
      { property: "og:description", content: "Your secure JumboCM account overview." },
      { property: "og:type", content: "website" },
      { property: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardHome,
});

type Profile = {
  full_name: string | null;
  balance: number;
  referral_code: string | null;
  referral_earnings: number | null;
};

type ActiveInvestment = {
  id: string;
  amount: number;
  total_earned: number;
  start_date: string;
  end_date: string;
  is_paused: boolean;
  plans: { name: string } | null;
};

function DashboardHome() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: inv }, { count }, { data: wd }] = await Promise.all([
        supabase.from("profiles").select("full_name,balance,referral_code,referral_earnings").eq("id", user.id).maybeSingle(),
        supabase.from("investments").select("id,amount,total_earned,start_date,end_date,is_paused,plans(name)").eq("user_id", user.id).eq("status", "active").order("end_date"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("referred_by", user.id),
        supabase.from("withdrawals").select("amount,status").eq("user_id", user.id).in("status", ["approved", "paid"]),
      ]);
      setProfile(p as Profile | null);
      setInvestments((inv as unknown as ActiveInvestment[]) ?? []);
      setReferralCount(count ?? 0);
      setTotalWithdrawn(
        ((wd as { amount: number }[] | null) ?? []).reduce((sum, item) => sum + Number(item.amount), 0),
      );
    })();
  }, [user]);

  const balance = Number(profile?.balance ?? 0);
  const profit = useMemo(() => investments.reduce((sum, item) => sum + Number(item.total_earned), 0), [investments]);
  const invested = useMemo(() => investments.reduce((sum, item) => sum + Number(item.amount), 0), [investments]);
  const firstName = (profile?.full_name ?? t("home.investor")).split(" ")[0];
  const referralLink = profile?.referral_code && typeof window !== "undefined"
    ? `${window.location.origin}/register?ref=${encodeURIComponent(profile.referral_code)}`
    : "";

  const copyReferral = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  };

  return (
    <motion.div
      className="-mx-3 -my-4 min-h-screen bg-background px-4 pb-32 pt-4 sm:-mx-4 md:-my-6 md:px-6 md:pb-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Greeting */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("home.welcomeBack")}</p>
            <h1 className="mt-0.5 text-lg font-semibold text-foreground">{firstName}</h1>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {firstName.charAt(0).toUpperCase()}
          </div>
        </header>

        {/* Balance — USD primary, XAF underneath */}
        <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary-foreground/70">Total available balance</p>
              <p className="mt-2.5 text-4xl font-semibold leading-none tabular-nums sm:text-[42px]">
                {visible ? formatUSD(balance) : "••••••"}
              </p>
              <p className="mt-2 text-sm font-medium text-primary-foreground/75">
                {visible ? formatXAF(balance) : "Balance hidden"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              aria-label={visible ? "Hide balance" : "Show balance"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-primary-foreground/80 transition hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between border-t border-primary-foreground/15 pt-3 text-[11px] text-primary-foreground/70">
            <span>Indicative rate</span>
            <span className="font-medium text-primary-foreground/90">1 USD = {formatXAF(XAF_PER_USD)}</span>
          </div>
        </section>

        {/* Quick actions */}
        <section className="grid grid-cols-3 gap-3">
          <QuickAction to="/dashboard/deposit" label="Deposit" icon={Plus} tone="teal" />
          <QuickAction to="/dashboard/withdraw" label="Withdraw" icon={ArrowUpRight} tone="bronze" />
          <QuickAction to="/dashboard/refer" label="Refer & Earn" icon={Gift} tone="emerald" />
        </section>

        {/* Money summary */}
        <section className="grid grid-cols-2 gap-3">
          <StatCard label="Total profit" value={profit} visible={visible} tone="profit" icon={TrendingUp} />
          <StatCard label="Active portfolio" value={invested} visible={visible} tone="portfolio" icon={PiggyBank} />
          <StatCard label="Total withdrawn" value={totalWithdrawn} visible={visible} tone="withdrawn" icon={Banknote} />
          <StatCard label="Available to withdraw" value={balance} visible={visible} tone="available" icon={Wallet} />
        </section>

        <TradingBot investments={investments as unknown as BotInvestment[]} />

        <AITradingRobot active />

        {/* Active investments */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-base font-semibold text-foreground">Active investments</h2>
            <Button asChild variant="ghost" size="sm" className="text-primary">
              <Link to="/dashboard/invest">
                View all <ChevronRight />
              </Link>
            </Button>
          </div>
          {investments.length ? (
            <div className="space-y-3">
              {investments.slice(0, 3).map((investment) => (
                <InvestmentRow key={investment.id} investment={investment} visible={visible} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No active investment yet.</p>
              <Button asChild className="mt-4 rounded-xl">
                <Link to="/dashboard/invest">Explore plans</Link>
              </Button>
            </div>
          )}
        </section>

        {/* Referral */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Gift className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Invite and earn</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{referralCount} total referrals</p>
                </div>
                <button
                  type="button"
                  onClick={copyReferral}
                  disabled={!referralLink}
                  aria-label="Copy referral link"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Commission earned</span>
                <strong className="text-foreground">{formatXAF(Number(profile?.referral_earnings ?? 0))}</strong>
              </div>
              <Button asChild variant="link" className="mt-1 h-auto p-0 text-primary">
                <Link to="/dashboard/referrals">
                  <Users className="h-4 w-4" /> Manage referrals
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

const ACTION_TONES: Record<string, string> = {
  teal: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)",
  bronze: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
  emerald: "linear-gradient(135deg, #047857 0%, #10B981 100%)",
};

function QuickAction({
  to,
  label,
  icon: Icon,
  tone = "teal",
}: {
  to: string;
  label: string;
  icon: typeof Plus;
  tone?: "teal" | "bronze" | "emerald";
}) {
  return (
    <Link
      to={to as never}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-3.5 transition active:scale-[0.97]"
    >
      <span
        className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-sm"
        style={{ backgroundImage: ACTION_TONES[tone] }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-xs font-semibold text-foreground">{label}</span>
    </Link>
  );
}

const CARD_TONES: Record<string, { gradient: string; glow: string }> = {
  profit: { gradient: "linear-gradient(135deg, #047857 0%, #10B981 100%)", glow: "rgba(16,185,129,0.35)" },
  portfolio: { gradient: "linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)", glow: "rgba(20,184,166,0.35)" },
  withdrawn: { gradient: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)", glow: "rgba(245,158,11,0.35)" },
  available: { gradient: "linear-gradient(135deg, #3730A3 0%, #6366F1 100%)", glow: "rgba(99,102,241,0.35)" },
};

function StatCard({
  label,
  value,
  visible = true,
  tone = "portfolio",
  icon: Icon,
}: {
  label: string;
  value: number;
  visible?: boolean;
  tone?: "profit" | "portfolio" | "withdrawn" | "available";
  icon: typeof TrendingUp;
}) {
  const theme = CARD_TONES[tone] ?? CARD_TONES.portfolio;
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-4 text-white transition active:scale-[0.98]"
      style={{ backgroundImage: theme.gradient, boxShadow: `0 16px 32px -18px ${theme.glow}` }}
    >
      <span className="pointer-events-none absolute -right-6 -top-10 h-24 w-24 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-black/10" />
      <div className="relative flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20 text-white backdrop-blur-sm">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs font-semibold leading-tight text-white/90">{label}</p>
      </div>
      <div className="relative mt-3">
        <DualMoney
          value={value}
          visible={visible}
          primary="usd"
          primaryClassName="text-2xl font-bold tabular-nums text-white"
          usdClassName="text-[11px] font-medium text-white/75"
        />
      </div>
    </div>
  );
}

function InvestmentRow({ investment, visible = true }: { investment: ActiveInvestment; visible?: boolean }) {
  const start = new Date(investment.start_date).getTime();
  const end = new Date(investment.end_date).getTime();
  const progress = Math.max(0, Math.min(100, ((Date.now() - start) / Math.max(1, end - start)) * 100));
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-card-foreground">
            {investment.plans?.name ?? "Investment plan"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Ends {formatDate(investment.end_date)}</p>
        </div>
        <div className="text-right">
          <DualMoney
            value={Number(investment.amount)}
            visible={visible}
            primary="usd"
            primaryClassName="text-sm font-semibold text-card-foreground"
            usdClassName="text-[10px] text-muted-foreground"
          />
          <p className="mt-1 text-xs text-success">+{formatXAF(Number(investment.total_earned))}</p>
        </div>
      </div>
      <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{investment.is_paused ? "Paused" : "In progress"}</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  );
}
