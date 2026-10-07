import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Gift,
  Share2,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { DualMoney } from "@/components/DualMoney";
import { ReferralNetwork } from "@/components/referral/ReferralNetwork";
import { useMyReferrals } from "@/hooks/useMyReferrals";

export const Route = createFileRoute("/dashboard/refer")({
  head: () => ({
    meta: [
      { title: "Refer & Earn — JumboCM" },
      {
        name: "description",
        content:
          "Share your JumboCM referral link and earn commission on every friend who invests.",
      },
      { property: "og:title", content: "Refer & Earn — JumboCM" },
      {
        property: "og:description",
        content: "Invite friends to JumboCM and earn commission on their investments.",
      },
      { property: "og:type", content: "website" },
      { property: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferAndEarnPage,
});

type Profile = {
  referral_code: string | null;
  referral_earnings: number | null;
};

const STEPS = [
  {
    icon: Share2,
    title: "Share your link",
    text: "Send your personal link to friends and family.",
  },
  { icon: UserPlus, title: "They join", text: "Your friend creates an account with your link." },
  { icon: Wallet, title: "You earn", text: "Get commission every time they invest." },
];

function ReferAndEarnPage() {
  const { user } = useAuth();
  const { rows, loading: networkLoading, error: networkError } = useMyReferrals();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [percent, setPercent] = useState(5);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: p }, { count }, { data: s }] = await Promise.all([
        supabase
          .from("profiles")
          .select("referral_code,referral_earnings")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("referred_by", user.id),
        supabase.from("public_settings").select("referral_percent").eq("id", 1).maybeSingle(),
      ]);
      setProfile(p as Profile | null);
      setReferralCount(count ?? 0);
      if (s?.referral_percent != null) setPercent(Number(s.referral_percent));
    })();
  }, [user]);

  const code = profile?.referral_code ?? "";
  const link = code ? `${origin}/register?ref=${encodeURIComponent(code)}` : "";
  const earned = Number(profile?.referral_earnings ?? 0);
  const activeCount = rows.filter((r) => r.investment_status === "active").length;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API can be blocked (e.g. inside an iframe) — fall back to a hidden field.
      const field = document.createElement("textarea");
      field.value = link;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      document.body.removeChild(field);
    }
    setCopied(true);
    toast.success("Referral link copied");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!link) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join JumboCM",
          text: "Join me on JumboCM and start investing. Use my referral link:",
          url: link,
        });
        return;
      } catch {
        return;
      }
    }
    await copy();
  };

  const whatsapp = link
    ? `https://wa.me/?text=${encodeURIComponent(`Join me on JumboCM and start investing: ${link}`)}`
    : "";

  return (
    <motion.div
      className="-mx-3 -my-4 min-h-screen bg-background px-4 pb-32 pt-4 sm:-mx-4 md:-my-6 md:px-6 md:pb-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Header */}
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link to="/dashboard" aria-label="Back to dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Refer &amp; Earn</h1>
            <p className="text-xs text-muted-foreground">Invite friends, earn rewards</p>
          </div>
        </header>

        {/* Earnings hero */}
        <section
          className="relative overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-sm"
          style={{ background: "var(--gradient-hero)" }}
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[var(--gold)] opacity-30 blur-2xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-white opacity-10 blur-2xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> {percent}% commission
            </span>

            <p className="mt-4 text-xs font-medium text-primary-foreground/75">
              Total commission earned
            </p>
            <div className="mt-1.5">
              <DualMoney
                value={earned}
                primary="usd"
                primaryClassName="text-4xl font-bold leading-none tabular-nums"
                usdClassName="text-sm font-medium text-primary-foreground/75"
              />
            </div>

            <div className="mt-5 flex items-center gap-4 border-t border-white/15 pt-3 text-xs text-primary-foreground/85">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {referralCount}{" "}
                {referralCount === 1 ? "friend" : "friends"}
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> {activeCount} active
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <Gift className="h-3.5 w-3.5" /> Unlimited
              </span>
            </div>
          </div>
        </section>

        {/* Invite link */}
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Share2 className="h-3.5 w-3.5 text-primary" /> Your invite link
          </div>
          <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 px-3.5 py-3">
            <p className="break-all font-mono text-[13px] font-medium text-foreground">
              {link || "Your link will appear here once your account is ready."}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Button onClick={copy} disabled={!link} className="rounded-xl">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button onClick={share} disabled={!link} variant="outline" className="rounded-xl">
              <Share2 className="h-4 w-4" /> Share
            </Button>
          </div>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white transition active:scale-[0.99]"
            >
              <Share2 className="h-4 w-4" /> Share on WhatsApp
            </a>
          )}
          {code && (
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Your referral code:{" "}
              <span className="font-mono font-semibold text-foreground">{code}</span>
            </p>
          )}
        </section>

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3">
          <StatTile icon={Users} label="Invited" value={String(referralCount)} />
          <StatTile icon={TrendingUp} label="Active" value={String(activeCount)} tone="success" />
          <StatTile icon={Gift} label="Rate" value={`${percent}%`} />
        </section>

        {/* How it works */}
        <section className="rounded-3xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">How it works</h2>
          <div className="mt-4 space-y-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Referral network */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-semibold text-foreground">Your referral network</h2>
            <Link
              to="/dashboard/referrals"
              className="flex items-center gap-0.5 text-xs font-medium text-primary"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ReferralNetwork rows={rows.slice(0, 3)} loading={networkLoading} error={networkError} />
        </section>
      </div>
    </motion.div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 text-center">
      <span
        className={`mx-auto grid h-9 w-9 place-items-center rounded-full ${
          tone === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-lg font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
