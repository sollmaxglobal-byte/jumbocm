import { motion } from "framer-motion";
import { UserPlus, Users } from "lucide-react";
import { Money } from "@/components/Money";
import { formatDate } from "@/lib/format";
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
  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
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
      <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-10 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <UserPlus className="h-6 w-6" />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">No referrals yet</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
          Share your invite link above — the friends who join will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r, i) => {
        const active = r.investment_status === "active";
        return (
          <motion.div
            key={r.user_id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.04, 0.4) }}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {initials(r.full_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {r.full_name || "Member"}
                </p>
                {r.joined_at && (
                  <p className="text-xs text-muted-foreground">Joined {formatDate(r.joined_at)}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                  active ? "bg-success/15 text-success" : "bg-muted text-foreground/60"
                }`}
              >
                {active ? "Active" : "No plan"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Investment plan
                </p>
                <p className="truncate text-sm font-semibold text-foreground">
                  {r.plan_name ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Invested
                </p>
                <p className="text-sm text-success">
                  {r.invested ? <Money value={Number(r.invested)} /> : "—"}
                </p>
              </div>
            </div>
          </motion.div>
        );
      })}
      <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
        <Users className="h-3.5 w-3.5" /> {rows.length}{" "}
        {rows.length === 1 ? "person joined" : "people joined"} with your link
      </p>
    </div>
  );
}
