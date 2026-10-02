import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Gift,
  Plus,
  ShieldCheck,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { formatDate, formatXAF } from "@/lib/format";
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
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardHome,
});

const XAF_PER_USD = 600;

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

function formatUSD(xaf: number) {
  const amount = xaf / XAF_PER_USD;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function DashboardHome() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);
  const [referralCount, setReferralCount] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: inv }, { count }] = await Promise.all([
        supabase.from("profiles").select("full_name,balance,referral_code,referral_earnings").eq("id", user.id).maybeSingle(),
        supabase.from("investments").select("id,amount,total_earned,start_date,end_date,is_paused,daily_roi_percent,last_payout_at,plans(name,profit_type,fixed_daily_profit)").eq("user_id", user.id).eq("status", "active").order("end_date"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("referred_by", user.id),
      ]);
      setProfile(p as Profile | null);
      setInvestments((inv as unknown as ActiveInvestment[]) ?? []);
      setReferralCount(count ?? 0);
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
    <motion.div className="-mx-3 -my-4 min-h-screen bg-background px-4 pb-32 pt-5 sm:-mx-4 md:-my-6 md:px-6 md:pb-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("home.welcomeBack")}</p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">{firstName}</h1>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
            {firstName.charAt(0).toUpperCase()}
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground shadow-elegant sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-primary-foreground/65">Total available balance</p>
              <p className="mt-3 text-4xl font-semibold leading-none tabular-nums sm:text-5xl">
                {visible ? formatUSD(balance) : "••••••"}
              </p>
              <p className="mt-3 text-sm text-primary-foreground/70">
                {visible ? `${formatXAF(balance)} total value` : "Balance hidden"}
              </p>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide balance" : "Show balance"} className="rounded-full text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              {visible ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-primary-foreground/15 pt-4 text-xs text-primary-foreground/65">
            <span>Indicative exchange rate</span>
            <strong className="font-semibold text-primary-foreground">1 USD = {formatXAF(XAF_PER_USD)}</strong>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <QuickAction to="/dashboard/deposit" label="Deposit" icon={Plus} primary />
          <QuickAction to="/dashboard/withdraw" label="Withdraw" icon={ArrowUpRight} />
          <QuickAction to="/dashboard/wallet" label="Wallet" icon={WalletCards} />
        </div>

        <TradingBot investments={investments as unknown as BotInvestment[]} />

        <AITradingRobot active />

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success"><TrendingUp className="h-5 w-5" /></div>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">Profit</span>
            </div>
            <p className="mt-5 text-xs font-medium text-muted-foreground">Total profit</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{visible ? formatUSD(profit) : "••••••"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{visible ? `${formatXAF(profit)} total value` : "Value hidden"}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground"><ShieldCheck className="h-5 w-5" /></div>
              <span className="text-xs font-medium text-success">Active</span>
            </div>
            <p className="mt-5 text-xs font-medium text-muted-foreground">Active portfolio</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{visible ? formatUSD(invested) : "••••••"}</p>
            <p className="mt-2 text-sm text-muted-foreground">{investments.length} active {investments.length === 1 ? "plan" : "plans"}</p>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Portfolio</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">Active investments</h2>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard/invest">View all <ChevronRight /></Link></Button>
          </div>
          {investments.length ? (
            <div className="space-y-3">
              {investments.slice(0, 3).map((investment) => <InvestmentRow key={investment.id} investment={investment} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">No active investment yet.</p>
              <Button asChild className="mt-4 rounded-xl"><Link to="/dashboard/invest">Explore plans</Link></Button>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-secondary p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background text-primary"><Gift className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="font-semibold text-secondary-foreground">Invite and earn</h2><p className="mt-1 text-xs text-muted-foreground">{referralCount} total referrals</p></div>
                <Button size="icon" variant="ghost" onClick={copyReferral} disabled={!referralLink} aria-label="Copy referral link"><Copy /></Button>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                <span className="text-muted-foreground">Commission earned</span>
                <strong className="text-secondary-foreground">{formatXAF(Number(profile?.referral_earnings ?? 0))}</strong>
              </div>
              <Button asChild variant="link" className="mt-2 h-auto p-0"><Link to="/dashboard/referrals"><Users /> Manage referrals</Link></Button>
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

function QuickAction({ to, label, icon: Icon, primary = false }: { to: string; label: string; icon: typeof Plus; primary?: boolean }) {
  return (
    <Button asChild variant={primary ? "default" : "outline"} className="h-20 flex-col rounded-2xl shadow-none">
      <Link to={to as never}><Icon className="h-5 w-5" /><span className="text-xs">{label}</span></Link>
    </Button>
  );
}

function InvestmentRow({ investment }: { investment: ActiveInvestment }) {
  const start = new Date(investment.start_date).getTime();
  const end = new Date(investment.end_date).getTime();
  const progress = Math.max(0, Math.min(100, ((Date.now() - start) / Math.max(1, end - start)) * 100));
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-card-foreground">{investment.plans?.name ?? "Investment plan"}</p><p className="mt-1 text-xs text-muted-foreground">Ends {formatDate(investment.end_date)}</p></div>
        <div className="text-right"><p className="text-sm font-semibold text-card-foreground">{formatUSD(Number(investment.amount))}</p><p className="mt-1 text-xs text-success">+{formatUSD(Number(investment.total_earned))}</p></div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} /></div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground"><span>{investment.is_paused ? "Paused" : "In progress"}</span><span>{Math.round(progress)}%</span></div>
    </div>
  );
}