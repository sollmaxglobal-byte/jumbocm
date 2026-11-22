import { motion } from "framer-motion";
import { UserPlus, Users } from "lucide-react";
import { Money } from "@/components/Money";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { Referral } from "@/hooks/useMyReferrals";

function initials(name: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ReferralNetwork({
  rows,
  loading,
  error,
}: {
  rows: Referral[];
  loading: boolean;
  error: string | null;
}) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="space-y-2.5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-[84px] animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-9 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
          <UserPlus className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">{t("No referrals yet")}</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
          {t("Share your invite link above — the friends who join will appear here.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => {
        const active = r.investment_status === "active";
        return (
          <motion.div
            key={r.user_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.3) }}
            className="rounded-2xl border border-border bg-card p-3.5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/15">
                {initials(r.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-foreground">
                  {r.full_name || t("Member")}
                </p>
                {r.joined_at && (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {t("Joined {date}", { date: formatDate(r.joined_at) })}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${
                  active
                    ? "bg-success/10 text-success ring-1 ring-inset ring-success/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {active ? t("Active") : t("No plan")}
              </span>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-2.5">
              <div className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  {t("Investment plan")}
                </dt>
                <dd className="mt-0.5 truncate text-[13px] font-medium text-foreground">
                  {r.plan_name ?? "—"}
                </dd>
              </div>
              <div className="min-w-0 text-right">
                <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  {t("Invested")}
                </dt>
                <dd className="mt-0.5 truncate text-[13px] font-semibold text-success tabular-nums">
                  {r.invested ? <Money value={Number(r.invested)} /> : "—"}
                </dd>
              </div>
            </dl>
          </motion.div>
        );
      })}
      <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
        <Users className="h-3.5 w-3.5" />{" "}
        {t("{count} joined with your link", { count: rows.length })}
      </p>
    </div>
  );
}
