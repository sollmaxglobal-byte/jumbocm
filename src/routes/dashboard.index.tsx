import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpCircle,
  ArrowUpRight,
  ChevronRight,
  Copy,
  Gift,
  Headphones,
  Home,
  MoreHorizontal,
  PieChart,
  Settings,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { formatUSD, formatXAF, XAF_PER_USD } from "@/lib/format";

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
  phone: string | null;
  balance: number;
  referral_code: string | null;
  referral_earnings: number | null;
};

const DIAL_FLAGS: Record<string, string> = {
  "237": "🇨🇲",
  "225": "🇨🇮",
  "221": "🇸🇳",
  "241": "🇬🇦",
  "242": "🇨🇬",
  "243": "🇨🇩",
  "235": "🇹🇩",
  "236": "🇨🇫",
  "240": "🇬🇶",
  "229": "🇧🇯",
  "228": "🇹🇬",
  "226": "🇧🇫",
  "223": "🇲🇱",
  "227": "🇳🇪",
  "234": "🇳🇬",
  "233": "🇬🇭",
  "254": "🇰🇪",
  "27": "🇿🇦",
  "33": "🇫🇷",
  "44": "🇬🇧",
  "49": "🇩🇪",
  "1": "🇺🇸",
};

function countryFlag(phone?: string | null) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const code = Object.keys(DIAL_FLAGS)
    .sort((a, b) => b.length - a.length)
    .find((c) => digits.startsWith(c));
  if (code) return DIAL_FLAGS[code];
  // Numbers saved without a dial code default to the app's home market.
  return digits ? "🇨🇲" : "";
}

type ActiveInvestment = {
  id: string;
  amount: number;
  total_earned: number;
  start_date: string;
  end_date: string;
  is_paused: boolean;
  plans: { name: string; payout_frequency: string | null } | null;
};

const GREEN = "#00FF88";

function DashboardHome() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { data: inv }, { data: wd }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name,phone,balance,referral_code,referral_earnings")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("investments")
          .select(
            "id,amount,total_earned,start_date,end_date,is_paused,plans(name,payout_frequency)",
          )
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("end_date"),
        supabase
          .from("withdrawals")
          .select("amount,status")
          .eq("user_id", user.id)
          .in("status", ["approved", "paid"]),
      ]);
      setProfile(p as Profile | null);
      setInvestments((inv as unknown as ActiveInvestment[]) ?? []);
      setTotalWithdrawn(
        ((wd as { amount: number }[] | null) ?? []).reduce(
          (sum, item) => sum + Number(item.amount),
          0,
        ),
      );
    })();
  }, [user]);

  const balance = Number(profile?.balance ?? 0);
  const profit = useMemo(
    () => investments.reduce((sum, item) => sum + Number(item.total_earned), 0),
    [investments],
  );
  const invested = useMemo(
    () => investments.reduce((sum, item) => sum + Number(item.amount), 0),
    [investments],
  );
  const firstName = (profile?.full_name ?? t("home.investor")).split(" ")[0];
  const flag = countryFlag(profile?.phone);
  const growth = invested > 0 ? (profit / invested) * 100 : 0;

  const portfolioTotal = balance + profit + totalWithdrawn;
  const share = (value: number) => (portfolioTotal > 0 ? (value / portfolioTotal) * 100 : 0);
  const balanceShare = share(balance);
  const profitShare = share(profit);
  const donut =
    portfolioTotal > 0
      ? `conic-gradient(${GREEN} 0% ${balanceShare}%, #3B82F6 ${balanceShare}% ${balanceShare + profitShare}%, #8B5CF6 ${balanceShare + profitShare}% 100%)`
      : `conic-gradient(${GREEN} 0% 100%)`;

  const copyBalance = async () => {
    await navigator.clipboard.writeText(formatXAF(balance));
    toast.success("Balance copied");
  };

  return (
    <motion.div
      className="min-h-screen bg-[#0A0B0D] pb-28 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="mx-auto max-w-md space-y-4 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
        {/* Header */}
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              to="/dashboard/profile"
              aria-label="Profile"
              className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#00FF88] to-[#0E9F6E] text-sm font-bold text-[#04120B] ring-2 ring-[#00FF88]/30"
            >
              {firstName.charAt(0).toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#0A0B0D]">
                <Star className="h-3 w-3 fill-[#00FF88] text-[#00FF88]" />
              </span>
            </Link>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-white/45">Welcome back,</p>
              <p className="truncate text-sm font-semibold text-white">
                {firstName}
                {flag && <span className="ml-1.5">{flag}</span>}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Link
              to="/dashboard/profile"
              aria-label="Settings"
              className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Link>
          </div>
        </header>

        {/* Balance hero */}
        <section className="relative overflow-hidden rounded-3xl border border-[#00FF88]/20 bg-gradient-to-br from-[#0F1A17] via-[#0C1211] to-[#0A0B0D] p-5 shadow-[0_0_44px_-18px_rgba(0,255,136,0.55)]">
          <span
            className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#00FF88]/10 blur-3xl"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-[#0EA5E9]/10 blur-3xl"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-white/50">Total Available Balance</p>
              <p className="mt-2 text-[clamp(24px,7vw,34px)] font-bold leading-none tracking-tight text-white tabular-nums">
                {formatUSD(balance)}
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-xs font-medium text-white/45 tabular-nums">
                  {formatXAF(balance)}
                </span>
                <button
                  type="button"
                  onClick={copyBalance}
                  aria-label="Copy balance"
                  className="grid h-6 w-6 place-items-center rounded-full text-white/40 transition hover:bg-white/5 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="mt-3.5 inline-flex rounded-full bg-[#00FF88]/10 px-2.5 py-1 text-[10px] font-semibold text-[#00FF88] ring-1 ring-inset ring-[#00FF88]/25">
                1 USD = {formatXAF(XAF_PER_USD)}
              </span>
            </div>
            <div className="relative w-[124px] shrink-0 pt-1 sm:w-[138px]">
              <GrowthChart />
              <span className="absolute -bottom-1 right-0 inline-flex items-center gap-0.5 rounded-full bg-[#00FF88]/15 px-2 py-0.5 text-[10px] font-bold text-[#00FF88] ring-1 ring-inset ring-[#00FF88]/20">
                <TrendingUp className="h-3 w-3" /> +{growth.toFixed(1)}%
              </span>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="grid grid-cols-4 gap-2.5">
          <QuickAction to="/dashboard/deposit" label="Deposit" icon={ArrowDownLeft} tone="green" />
          <QuickAction to="/dashboard/withdraw" label="Withdraw" icon={ArrowUpRight} tone="blue" />
          <QuickAction to="/dashboard/refer" label="Refer & Earn" icon={Gift} tone="amber" />
          <QuickAction to="/contact" label="Support" icon={Headphones} tone="purple" />
        </section>

        {/* Money summary */}
        <section className="grid grid-cols-2 gap-3">
          <SummaryCard
            to="/dashboard/invest"
            label="Total Profit"
            value={profit}
            tone="green"
            icon={TrendingUp}
          />
          <SummaryCard
            to="/dashboard/invest"
            label="Active Portfolio"
            value={invested}
            tone="violet"
            icon={PieChart}
          />
        </section>

        {/* Withdrawal info */}
        <section className="rounded-2xl bg-gradient-to-r from-[#00FF88]/45 via-[#3B82F6]/30 to-[#8B5CF6]/45 p-px">
          <div className="grid grid-cols-2 gap-3 rounded-[15px] bg-[#0E0F11] px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00FF88]/10 text-[#00FF88]">
                <Wallet className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] text-white/45">Total Withdrawn</p>
                <p className="text-sm font-semibold text-white tabular-nums">
                  {formatUSD(totalWithdrawn)}
                </p>
                <p className="text-[10px] text-white/40 tabular-nums">
                  ≈ {formatXAF(totalWithdrawn)}
                </p>
              </div>
            </div>
            <div className="min-w-0 border-l border-white/10 pl-3">
              <p className="text-[10px] text-white/45">Available to Withdraw</p>
              <p className="text-sm font-semibold text-white tabular-nums">{formatUSD(balance)}</p>
              <p className="text-[10px] text-white/40 tabular-nums">≈ {formatXAF(balance)}</p>
            </div>
          </div>
        </section>

        {/* Portfolio overview */}
        <section className="rounded-2xl border border-white/5 bg-[#0F1012] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Portfolio Overview</h2>
            <Link
              to="/dashboard/wallet"
              className="flex items-center gap-0.5 text-[11px] font-medium text-[#00FF88]"
            >
              View Details <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
              style={{ background: donut }}
            >
              <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-[#0F1012]">
                <div className="text-center">
                  <p className="text-lg font-bold leading-none text-white">100%</p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/45">
                    Portfolio
                  </p>
                </div>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2.5">
              <LegendRow color={GREEN} label="Available Balance" value={balance} />
              <LegendRow color="#3B82F6" label="Total Profit" value={profit} />
              <LegendRow color="#8B5CF6" label="Withdrawn" value={totalWithdrawn} />
            </ul>
          </div>
        </section>
      </div>

      {/* Bottom navigation */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
        <div className="pointer-events-auto grid w-full max-w-md grid-cols-5 items-end border-t border-white/5 bg-[#0B0C0E]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] pt-2 backdrop-blur-md">
          <NavItem to="/dashboard" label="Home" icon={Home} active />
          <NavItem to="/dashboard/invest" label="Invest" icon={TrendingUp} />
          <div className="flex flex-col items-center gap-1">
            <Link
              to="/plans"
              aria-label="Upgrade"
              className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-[#00FF88] text-[#04120B] shadow-[0_12px_30px_-6px_rgba(0,255,136,0.65)] ring-4 ring-[#0A0B0D] transition active:scale-95"
            >
              <ArrowUpCircle className="h-6 w-6" />
            </Link>
            <span className="text-[10px] font-medium leading-none text-white/45">Upgrade</span>
          </div>
          <NavItem to="/dashboard/profile" label="Settings" icon={Settings} />
          <NavItem to="/contact" label="Support" icon={Headphones} />
        </div>
      </nav>
    </motion.div>
  );
}

function QuickAction({
  to,
  label,
  icon: Icon,
  tone,
}: {
  to: string;
  label: string;
  icon: typeof ArrowDownLeft;
  tone: "green" | "blue" | "amber" | "purple";
}) {
  const tones: Record<string, string> = {
    green: "bg-[#00FF88]/15 text-[#00FF88]",
    blue: "bg-[#3B82F6]/15 text-[#3B82F6]",
    amber: "bg-[#F59E0B]/15 text-[#F59E0B]",
    purple: "bg-[#8B5CF6]/15 text-[#8B5CF6]",
  };
  return (
    <Link
      to={to as never}
      className="flex flex-col items-center gap-2 rounded-2xl border border-white/5 bg-[#101113] px-1 py-3 transition active:scale-[0.97]"
    >
      <span className={`grid h-10 w-10 place-items-center rounded-full ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-center text-[10px] font-medium leading-tight text-white/80">
        {label}
      </span>
    </Link>
  );
}

function SummaryCard({
  to,
  label,
  value,
  tone,
  icon: Icon,
}: {
  to: string;
  label: string;
  value: number;
  tone: "green" | "violet";
  icon: typeof TrendingUp;
}) {
  const green = tone === "green";
  return (
    <Link
      to={to as never}
      className={`relative overflow-hidden rounded-2xl border p-4 ${
        green
          ? "border-[#00FF88]/20 bg-gradient-to-br from-[#00FF88]/10 via-[#00FF88]/[0.04] to-transparent"
          : "border-[#8B5CF6]/20 bg-gradient-to-br from-[#8B5CF6]/10 via-[#3B82F6]/[0.06] to-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="pt-0.5 text-[11px] font-medium text-white/60">{label}</p>
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            green ? "bg-[#00FF88]/15 text-[#00FF88]" : "bg-[#8B5CF6]/15 text-[#A78BFA]"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2.5 text-xl font-bold leading-none text-white tabular-nums">
        {formatUSD(value)}
      </p>
      <p className="mt-1 text-[10px] text-white/40 tabular-nums">≈ {formatXAF(value)}</p>
      <div className="mt-3 flex items-end justify-between">
        {green ? <Sparkline /> : <MiniBars />}
        <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/70">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="flex min-w-0 items-center gap-2 text-white/55">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 font-semibold text-white tabular-nums">{formatUSD(value)}</span>
    </li>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active = false,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className={`flex flex-col items-center gap-1 py-1 text-[10px] font-medium transition ${
        active ? "text-[#00FF88]" : "text-white/45 hover:text-white/70"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="leading-none">{label}</span>
    </Link>
  );
}

function Sparkline() {
  return (
    <svg viewBox="0 0 64 24" className="h-6 w-16" aria-hidden>
      <path
        d="M2 19 L12 15 L22 17 L32 11 L42 13 L52 6 L62 3"
        fill="none"
        stroke={GREEN}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MiniBars() {
  return (
    <svg viewBox="0 0 64 24" className="h-6 w-16" aria-hidden>
      <g fill="#A78BFA">
        <rect x="2" y="14" width="6" height="8" rx="2" opacity="0.55" />
        <rect x="12" y="10" width="6" height="12" rx="2" opacity="0.7" />
        <rect x="22" y="12" width="6" height="10" rx="2" opacity="0.6" />
        <rect x="32" y="6" width="6" height="16" rx="2" opacity="0.85" />
        <rect x="42" y="9" width="6" height="13" rx="2" opacity="0.75" />
        <rect x="52" y="3" width="6" height="19" rx="2" />
      </g>
    </svg>
  );
}

function GrowthChart() {
  return (
    <svg viewBox="0 0 160 130" className="h-auto w-full" aria-hidden>
      <defs>
        <linearGradient id="hero-bar-teal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DFFE0" />
          <stop offset="100%" stopColor="#0E9F8C" />
        </linearGradient>
        <linearGradient id="hero-bar-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="100%" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id="hero-pedestal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16241F" />
          <stop offset="100%" stopColor="#0A100E" />
        </linearGradient>
        <filter id="hero-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <ellipse
        cx="80"
        cy="110"
        rx="64"
        ry="16"
        fill="url(#hero-pedestal)"
        stroke={GREEN}
        strokeOpacity="0.28"
      />
      <ellipse
        cx="80"
        cy="105"
        rx="52"
        ry="11"
        fill="#0D1714"
        stroke={GREEN}
        strokeOpacity="0.12"
      />
      <g filter="url(#hero-glow)">
        <rect
          x="34"
          y="72"
          width="14"
          height="32"
          rx="4"
          fill="url(#hero-bar-teal)"
          opacity="0.85"
        />
        <rect
          x="54"
          y="56"
          width="14"
          height="48"
          rx="4"
          fill="url(#hero-bar-blue)"
          opacity="0.9"
        />
        <rect
          x="74"
          y="64"
          width="14"
          height="40"
          rx="4"
          fill="url(#hero-bar-teal)"
          opacity="0.85"
        />
        <rect
          x="94"
          y="42"
          width="14"
          height="62"
          rx="4"
          fill="url(#hero-bar-blue)"
          opacity="0.95"
        />
        <rect x="114" y="30" width="14" height="74" rx="4" fill="url(#hero-bar-teal)" />
      </g>
      <path
        d="M30 88 C 52 80, 62 62, 82 58 S 112 40, 130 24"
        fill="none"
        stroke={GREEN}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M121 21 L 132 24 L 129 35"
        fill="none"
        stroke={GREEN}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
