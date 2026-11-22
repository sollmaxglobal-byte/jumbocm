import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgePercent,
  Check,
  ChevronRight,
  Copy,
  Gift,
  Share2,
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
import { useI18n } from "@/hooks/useI18n";

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
  const { t } = useI18n();
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
    toast.success(t("Referral link copied"));
    window.setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!link) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: t("Join JumboCM"),
          text: t("Join me on JumboCM and start investing. Use my referral link:"),
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
    ? `https://wa.me/?text=${encodeURIComponent(`${t("Join me on JumboCM and start investing")}: ${link}`)}`
    : "";

  return (
    <motion.div className="space-y-4 pb-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Header */}
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0 rounded-full">
          <Link to="/dashboard" aria-label={t("Back to dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight text-foreground">
            {t("Refer & Earn")}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {t("Invite friends, earn rewards")}
          </p>
        </div>
      </header>

      {/* Earnings hero */}
      <section
        className="relative overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-[var(--shadow-elegant)]"
        style={{ background: "var(--gradient-hero)" }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-white/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-6 h-44 w-44 rounded-full border border-white/15"
        />
        <Gift
          aria-hidden
          className="pointer-events-none absolute -right-3 -top-2 h-24 w-24 text-white/10"
        />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ring-white/25">
            <BadgePercent className="h-3.5 w-3.5" />
            {t("{percent}% commission", { percent })}
          </span>

          <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.08em] text-primary-foreground/70">
            {t("Total commission earned")}
          </p>
          <div className="mt-1.5">
            <DualMoney
              value={earned}
              primary="usd"
              primaryClassName="text-[clamp(28px,8vw,36px)] font-semibold leading-none tracking-tight tabular-nums"
              usdClassName="text-xs font-medium text-primary-foreground/70 tabular-nums"
            />
          </div>

          <dl className="mt-5 grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 pt-3.5">
            <Meta icon={Users} label={t("Friends")} value={String(referralCount)} />
            <Meta icon={TrendingUp} label={t("Active")} value={String(activeCount)} />
            <Meta icon={Gift} label={t("Reward")} value={t("Unlimited")} />
          </dl>
        </div>
      </section>

      {/* Invite link */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Share2 className="h-3.5 w-3.5 text-primary" />
            {t("Your invite link")}
          </h2>
          {code && (
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground">
              {code}
            </span>
          )}
        </div>

        <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/40 px-3.5 py-3">
          <p className="line-clamp-2 break-all font-mono text-[12px] leading-relaxed text-foreground">
            {link || t("Your link will appear here once your account is ready.")}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Button
            onClick={copy}
            disabled={!link}
            className={`h-11 rounded-xl text-sm font-semibold transition ${
              copied ? "bg-success text-white hover:bg-success/90" : ""
            }`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t("Copied") : t("Copy link")}
          </Button>
          <Button
            onClick={share}
            disabled={!link}
            variant="outline"
            className="h-11 rounded-xl border-input text-sm font-semibold"
          >
            <Share2 className="h-4 w-4" /> {t("Share")}
          </Button>
        </div>

        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white transition active:scale-[0.99]"
          >
            <Share2 className="h-4 w-4" /> {t("Share on WhatsApp")}
          </a>
        )}

        {code && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            {t("Your referral code:")}{" "}
            <span className="font-mono font-semibold text-foreground">{code}</span>
          </p>
        )}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-2.5">
        <StatTile icon={Users} label={t("Invited")} value={String(referralCount)} />
        <StatTile
          icon={TrendingUp}
          label={t("Active")}
          value={String(activeCount)}
          tone="success"
        />
        <StatTile icon={Gift} label={t("Rate")} value={`${percent}%`} />
      </section>

      {/* How it works */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">{t("How it works")}</h2>
        <ol className="mt-4 space-y-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[15px] top-9 h-[calc(100%-1.5rem)] w-px bg-border"
                />
              )}
              <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/15 bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm font-semibold text-foreground">
                  <span className="mr-1 tabular-nums text-muted-foreground">{i + 1}.</span>
                  {t(step.title)}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t(step.text)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Referral network */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-semibold text-foreground">{t("Your referral network")}</h2>
          <Link
            to="/dashboard/referrals"
            className="flex items-center gap-0.5 text-xs font-medium text-primary"
          >
            {t("View all")} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ReferralNetwork rows={rows.slice(0, 3)} loading={networkLoading} error={networkError} />
      </section>
    </motion.div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <dt className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-primary-foreground/60">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums text-primary-foreground">
        {value}
      </dd>
    </div>
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
    <div className="rounded-2xl border border-border bg-card px-2.5 py-3 text-center shadow-sm">
      <span
        className={`mx-auto grid h-8 w-8 place-items-center rounded-full ${
          tone === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2 text-base font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
