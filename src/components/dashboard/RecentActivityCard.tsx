import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { DualMoney } from "@/components/DualMoney";
import { formatDate } from "@/lib/format";

type Activity = {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  status: string;
  date: string;
};

type RawRow = { id: string; amount: number; status: string; created_at: string };

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-[#F59E0B]/12 text-[#F59E0B]" },
  approved: { label: "Completed", className: "bg-[#00FF88]/12 text-[#00FF88]" },
  paid: { label: "Paid", className: "bg-[#00FF88]/12 text-[#00FF88]" },
  dispatched: { label: "Processing", className: "bg-[#F59E0B]/12 text-[#F59E0B]" },
  rejected: { label: "Rejected", className: "bg-[#EF4444]/12 text-[#EF4444]" },
  failed: { label: "Failed", className: "bg-[#EF4444]/12 text-[#EF4444]" },
};

/** UTC clock time so it always matches the UTC date shown next to it. */
function timeOf(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Latest deposits and withdrawals, shown on the dashboard home. */
export function RecentActivityCard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [rows, setRows] = useState<Activity[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: deposits }, { data: withdrawals }] = await Promise.all([
        supabase
          .from("deposits")
          .select("id,amount,status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("withdrawals")
          .select("id,amount,status,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(4),
      ]);
      const merged: Activity[] = [
        ...((deposits as RawRow[] | null) ?? []).map((d) => ({
          id: `d-${d.id}`,
          type: "deposit" as const,
          amount: Number(d.amount),
          status: d.status,
          date: d.created_at,
        })),
        ...((withdrawals as RawRow[] | null) ?? []).map((w) => ({
          id: `w-${w.id}`,
          type: "withdrawal" as const,
          amount: Number(w.amount),
          status: w.status,
          date: w.created_at,
        })),
      ]
        .sort((a, b) => +new Date(b.date) - +new Date(a.date))
        .slice(0, 5);
      setRows(merged);
    })();
  }, [user]);

  return (
    <section className="rounded-2xl border border-white/5 bg-[#0F1012] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{t("Recent activity")}</h2>
        <Link
          to="/dashboard/transactions"
          className="flex items-center gap-0.5 text-[11px] font-medium text-[#00FF88]"
        >
          {t("View all")} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-white/45">{t("No deposits or withdrawals yet.")}</p>
      ) : (
        <ul className="mt-1 divide-y divide-white/5">
          {rows.map((row) => {
            const deposit = row.type === "deposit";
            const status = STATUS_STYLE[row.status] ?? {
              label: row.status,
              className: "bg-white/5 text-white/50",
            };
            return (
              <li key={row.id} className="flex items-center gap-3 py-3">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                    deposit ? "bg-[#00FF88]/12 text-[#00FF88]" : "bg-[#F59E0B]/12 text-[#F59E0B]"
                  }`}
                  aria-hidden
                >
                  {deposit ? (
                    <ArrowDownLeft className="h-4 w-4" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-white">
                    {deposit ? t("Deposit") : t("Withdrawal")}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium tabular-nums text-white/40">
                    {formatDate(row.date)} · {timeOf(row.date)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <DualMoney
                    value={row.amount}
                    primary="usd"
                    primaryClassName={`text-[13px] font-semibold ${
                      deposit ? "text-[#00FF88]" : "text-white"
                    }`}
                    usdClassName="text-[10px] font-medium text-white/40"
                  />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.className}`}
                  >
                    {t(status.label)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
