import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  Share2,
  Copy,
  Users,
  TrendingUp,
  ChevronRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Wallet,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

// Animated count-up for the balance hero — feels like a live investing app.
function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = display;
    const delta = value - start;
    if (delta === 0) return;
    const duration = 900;
    const startTs = performance.now();
    let raf = 0;
    const step = (ts: number) => {
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + delta * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <Money value={Math.round(display)} />;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 220, damping: 22 } },
};

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
  const [referralCount, setReferralCount] = useState(0);
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const toggleBalance = () => setBalanceVisible((visible) => !visible);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { count: refCount }, { data: inv }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name,balance,referral_code,referral_earnings")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("referred_by", user.id),
        supabase
          .from("investments")
          .select("id,amount,total_earned,start_date,end_date,is_paused,plans(name)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("end_date", { ascending: true }),
      ]);
      setProfile(p as Profile);
      setReferralCount(refCount ?? 0);
      setInvestments((inv as unknown as ActiveInvestment[]) ?? []);
    })();
  }, [user]);

  const totalInvested = useMemo(
    () => investments.reduce((s, i) => s + Number(i.amount), 0),
    [investments],
  );
  const totalProfit = useMemo(
    () => investments.reduce((s, i) => s + Number(i.total_earned), 0),
    [investments],
  );

  const firstName = (profile?.full_name ?? t("home.investor")).split(" ")[0];

  return (
    <motion.div
      className="dh -mx-3 -my-4 min-h-screen space-y-5 px-4 pb-32 pt-5 sm:-mx-4 md:-my-6 md:pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="show"
      style={{
        // Scoped premium palette — ink violet + lime on warm ivory
        ["--dh-bg" as never]: "#F5F4EF",
        ["--dh-ink" as never]: "#14112B",
        ["--dh-ink-2" as never]: "#1E1A3E",
        ["--dh-lime" as never]: "#C9F158",
        ["--dh-violet" as never]: "#6C5CE7",
        ["--dh-muted" as never]: "#75728C",
        backgroundColor: "var(--dh-bg)",
      }}
    >
      {/* Greeting header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--dh-ink)] text-base font-bold text-[var(--dh-lime)]">
            {firstName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--dh-muted)]">
              {t("home.welcomeBack")}
            </p>
            <h1 className="truncate text-lg font-bold tracking-tight text-[var(--dh-ink)]">
              {firstName}
            </h1>
          </div>
        </div>
        <motion.span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--dh-lime)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--dh-ink)]"
          animate={{ opacity: [0.75, 1, 0.75] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--dh-ink)]" /> Live
        </motion.span>
      </motion.div>

      {/* Balance hero — dark ink slab */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-[1.75rem] bg-[var(--dh-ink)] p-6 shadow-[0_24px_48px_-16px_rgba(20,17,43,0.45)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--dh-violet)] opacity-30 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-[var(--dh-lime)] opacity-20 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
              {t("home.availableBalance")}
            </span>
            <button
              type="button"
              onClick={toggleBalance}
              aria-label={balanceVisible ? "Hide available balance" : "Show available balance"}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 transition active:scale-90"
            >
              {balanceVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="mt-3 text-[2.1rem] font-bold leading-none tracking-tight text-white sm:text-4xl">
            {balanceVisible ? (
              <AnimatedNumber value={profile?.balance ?? 0} />
            ) : (
              <span aria-label="Balance hidden">••••••••</span>
            )}
          </div>

          {/* Actions — Deposit prominent, Transfer/Withdraw compact */}
          <div className="mt-6 flex items-center gap-2.5">
            <ActionSheet
              label={t("common.deposit")}
              icon={<ArrowDownToLine className="h-4 w-4" />}
              title={t("common.deposit")}
              description="Fund your account with Mobile Money or bank transfer. Funds appear once approved."
              to="/dashboard/deposit"
              cta={t("common.deposit")}
              className="h-12 flex-1 rounded-full bg-[var(--dh-lime)] text-sm font-bold text-[var(--dh-ink)] shadow-[0_10px_24px_-8px_rgba(201,241,88,0.6)] transition active:scale-95"
            />
            <ActionSheet
              label="Transfer"
              icon={<Send className="h-5 w-5" />}
              title="Transfer funds"
              description="Send funds securely to another JumboCM user by email."
              to="/dashboard/wallet"
              cta="Open wallet"
              iconOnly
              className="h-12 w-12 shrink-0 rounded-full bg-white/10 text-white transition active:scale-90"
            />
            <ActionSheet
              label={t("common.withdraw")}
              icon={<ArrowUpFromLine className="h-5 w-5" />}
              title={t("common.withdraw")}
              description="Minimum withdrawal is 250 XAF. Payouts are processed within 10 minutes."
              to="/dashboard/withdraw"
              cta={t("common.withdraw")}
              iconOnly
              className="h-12 w-12 shrink-0 rounded-full bg-white/10 text-white transition active:scale-90"
            />
          </div>
        </div>
      </motion.div>

      {/* Wallet / Profit — paired stat rows */}
      <motion.div variants={itemVariants} className="overflow-hidden rounded-3xl bg-white shadow-[0_12px_32px_-16px_rgba(20,17,43,0.18)]">
        <div className="flex items-center gap-4 border-b border-[#EFEEE7] p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--dh-violet)]/10">
            <Wallet className="h-5 w-5 text-[var(--dh-violet)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--dh-ink)]">Main Wallet</p>
            <p className="text-xs text-[var(--dh-muted)]">Available balance</p>
          </div>
          <p className="text-base font-bold text-[var(--dh-ink)]">
            {balanceVisible ? <Money value={Number(profile?.balance ?? 0)} /> : "••••••"}
          </p>
        </div>
        <div className="flex items-center gap-4 p-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--dh-lime)]/30">
            <Sparkles className="h-5 w-5 text-[var(--dh-ink)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--dh-ink)]">Total Profit</p>
            <p className="text-xs text-[var(--dh-muted)]">Lifetime earnings</p>
          </div>
          <p className="text-base font-bold text-[var(--dh-ink)]">
            {balanceVisible ? <Money value={totalProfit} /> : "••••••"}
          </p>
        </div>
      </motion.div>

      {/* Portfolio health */}
      <motion.div
        variants={itemVariants}
        className="rounded-3xl border border-[#EAE8E0] bg-white p-5 shadow-[0_12px_32px_-16px_rgba(20,17,43,0.12)]"
      >
        <div className="flex items-center gap-4">
          {/* Health ring */}
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
              <circle cx="32" cy="32" r="27" fill="none" stroke="#EFEEE7" strokeWidth="7" />
              <circle
                cx="32"
                cy="32"
                r="27"
                fill="none"
                stroke="var(--dh-lime)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 27}
                strokeDashoffset={2 * Math.PI * 27 * 0.18}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <ShieldCheck className="h-5 w-5 text-[var(--dh-ink)]" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-[var(--dh-ink)]">Portfolio Health</p>
              <span className="rounded-full bg-[var(--dh-lime)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--dh-ink)]">
                On track
              </span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-[var(--dh-violet)]">
              {totalInvested > 0 ? "Balanced growth" : "Ready to invest"}
            </p>
            <p className="mt-1 text-xs leading-4 text-[var(--dh-muted)]">
              Your account is protected with secure transaction monitoring.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Portfolio allocation */}
      <motion.div
        variants={itemVariants}
        className="rounded-3xl bg-white p-5 shadow-[0_12px_32px_-16px_rgba(20,17,43,0.12)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--dh-muted)]">
              Investment weight
            </p>
            <h2 className="mt-1 text-base font-bold tracking-tight text-[var(--dh-ink)]">
              Portfolio allocation
            </h2>
          </div>
          <TrendingUp className="h-5 w-5 text-[var(--dh-violet)]" aria-hidden="true" />
        </div>
        <div className="mt-5 space-y-4">
          {investments.length === 0 ? (
            <div className="rounded-2xl bg-[var(--dh-bg)] p-4 text-sm text-[var(--dh-muted)]">
              Your allocation will appear after you activate an investment plan.
            </div>
          ) : (
            investments.slice(0, 3).map((inv, index) => {
              const share = totalInvested ? (Number(inv.amount) / totalInvested) * 100 : 0;
              return (
                <div key={inv.id}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[var(--dh-ink)]">
                      {inv.plans?.name ?? "Investment plan"}
                    </span>
                    <span className="tabular-nums text-[var(--dh-muted)]">{Math.round(share)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--dh-bg)]">
                    <div
                      className={`h-full rounded-full ${
                        index === 0
                          ? "bg-[var(--dh-ink)]"
                          : index === 1
                            ? "bg-[var(--dh-violet)]"
                            : "bg-[var(--dh-lime)]"
                      }`}
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Referral card */}
      <motion.div variants={itemVariants}>
        <ReferralCard
          code={profile?.referral_code ?? null}
          earnings={Number(profile?.referral_earnings ?? 0)}
          count={referralCount}
        />
      </motion.div>

      {/* Active investments */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-[var(--dh-ink)]">
            Active investments
          </h2>
          <Link
            to="/dashboard/invest"
            className="text-xs font-bold text-[var(--dh-violet)]"
          >
            View all
          </Link>
        </div>
        {investments.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[#E2E0D6] p-6 text-center text-sm text-[var(--dh-muted)]">
            No active plan yet.{" "}
            <Link to="/dashboard/invest" className="font-bold text-[var(--dh-violet)] underline">
              Start investing
            </Link>
          </div>
        ) : (
          investments.map((inv) => <InvestmentCard key={inv.id} inv={inv} />)
        )}
      </motion.div>
    </motion.div>
  );
}

function InvestmentCard({ inv }: { inv: ActiveInvestment }) {
  const start = new Date(inv.start_date).getTime();
  const end = new Date(inv.end_date).getTime();
  const progress = Math.max(
    0,
    Math.min(100, ((Date.now() - start) / Math.max(1, end - start)) * 100),
  );

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="rounded-3xl bg-white p-4 shadow-[0_12px_32px_-16px_rgba(20,17,43,0.12)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--dh-ink)]">
            <TrendingUp className="h-4 w-4 text-[var(--dh-lime)]" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--dh-ink)]">
              {inv.plans?.name ?? "Investment plan"}
            </div>
            <div className="mt-0.5 text-xs text-[var(--dh-muted)]">
              <Money value={Number(inv.amount)} /> ·{" "}
              <span className="font-semibold text-[var(--dh-violet)]">
                +<Money value={Number(inv.total_earned)} />
              </span>{" "}
              earned
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            inv.is_paused
              ? "bg-[var(--dh-bg)] text-[var(--dh-muted)]"
              : "bg-[var(--dh-lime)] text-[var(--dh-ink)]"
          }`}
        >
          {inv.is_paused ? "Paused" : "Running"}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[var(--dh-muted)]">
          <span>Progress</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--dh-bg)]">
          <div
            className="h-full rounded-full bg-[var(--dh-violet)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--dh-muted)]">
          <span>Started {formatDate(inv.start_date)}</span>
          <span>Ends {formatDate(inv.end_date)}</span>
        </div>
      </div>
    </motion.div>
  );
}

function ActionSheet({
  label,
  icon,
  title,
  description,
  to,
  cta,
  className,
  iconOnly,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  cta: string;
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button aria-label={label} className={`flex items-center justify-center gap-2 ${className ?? ""}`}>
          {icon} {iconOnly ? null : label}
        </button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <SheetHeader className="text-left">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <Button asChild size="lg" className="mt-4 w-full rounded-xl">
          <Link to={to as never}>
            {cta} <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function ReferralCard({
  code,
  earnings,
  count,
}: {
  code: string | null;
  earnings: number;
  count: number;
}) {
  const link = useMemo(
    () =>
      code && typeof window !== "undefined"
        ? `${window.location.origin}/register?ref=${encodeURIComponent(code)}`
        : "",
    [code],
  );
  const share = async () => {
    if (!link) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join me on JumboCM", url: link });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied");
  };
  const copy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Copied");
  };
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[var(--dh-violet)] p-5 text-white shadow-[0_16px_36px_-14px_rgba(108,92,231,0.6)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/15 blur-2xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          <h2 className="text-base font-bold">Refer &amp; earn</h2>
        </div>
        <p className="mt-1 text-xs text-white/70">
          Earn commission on every profit your invitees make.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/60">
              <Users className="h-3 w-3" /> Total referrals
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums">{count}</div>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
              Commissions
            </div>
            <div className="mt-1 text-xl font-bold text-[var(--dh-lime)]">
              <Money value={earnings} />
            </div>
          </div>
        </div>
        <div className="mt-3 rounded-2xl bg-white/10 p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Your referral link
          </div>
          <div className="mt-1 truncate font-mono text-xs text-white/90">{link || "—"}</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copy}
            disabled={!link}
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <Copy className="mr-1 h-4 w-4" /> Copy
          </Button>
          <Button
            size="sm"
            onClick={share}
            disabled={!link}
            className="bg-[var(--dh-lime)] font-bold text-[var(--dh-ink)] hover:opacity-90"
          >
            <Share2 className="mr-1 h-4 w-4" /> Share
          </Button>
        </div>
        <Button
          asChild
          size="sm"
          className="mt-2 w-full bg-white/10 text-white hover:bg-white/20"
        >
          <Link to="/dashboard/referrals">
            <Users className="mr-1 h-4 w-4" /> My referrals
          </Link>
        </Button>
      </div>
    </div>
  );
}
