import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Sparkles,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { formatDate } from "@/lib/format";
import { Money } from "@/components/Money";
import { TransferSheet } from "@/components/wallet/TransferSheet";

const searchSchema = z.object({
  filter: z.enum(["All", "Deposits", "Withdrawals", "Profits"]).optional(),
});

export const Route = createFileRoute("/dashboard/wallet")({
  validateSearch: (s) => searchSchema.parse(s),
  component: WalletPage,
});

type Tx = {
  id: string;
  type: "deposit" | "withdrawal" | "investment" | "profit" | "investment_return" | string;
  amount: number;
  description: string | null;
  created_at: string;
};
type Pending = { id: string; amount: number; status: string; created_at: string };

const FILTERS = ["All", "Deposits", "Withdrawals", "Profits"] as const;
type Filter = (typeof FILTERS)[number];

function WalletPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const search = Route.useSearch();
  const [tx, setTx] = useState<Tx[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<Pending[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<Pending[]>([]);
  const [filter, setFilter] = useState<Filter>(search.filter ?? "All");
  const [balance, setBalance] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (search.filter) setFilter(search.filter);
  }, [search.filter]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: t }, { data: pd }, { data: pw }, { data: prof }] =
        await Promise.all([
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("deposits")
            .select("id,amount,status,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("withdrawals")
            .select("id,amount,status,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle(),
        ]);
      setTx((t as Tx[]) ?? []);
      setPendingDeposits((pd as Pending[]) ?? []);
      setPendingWithdrawals((pw as Pending[]) ?? []);
      setBalance(Number(prof?.balance ?? 0));
    })();
  }, [user]);

  const rows = useMemo(() => {
    type Row = {
      id: string;
      kind: "deposit" | "withdrawal" | "profit" | "investment";
      amount: number;
      date: string;
      status: string;
      label: string;
      receipt?: { kind: "deposit" | "withdrawal"; id: string };
    };
    const out: Row[] = [];

    for (const t of tx) {
      if (t.type === "deposit" || t.type === "withdrawal") continue;
      let kind: Row["kind"] = "profit";
      let label = t.description ?? "";
      if (t.type === "investment") {
        kind = "investment";
        label = label || "Investment";
      } else if (t.type === "profit" || t.type === "investment_return") {
        kind = "profit";
        label = label || "Profit";
      } else continue;
      out.push({
        id: t.id,
        kind,
        amount: Number(t.amount),
        date: t.created_at,
        status: "approved",
        label,
      });
    }
    for (const d of pendingDeposits) {
      const label =
        d.status === "pending"
          ? "Deposit submitted"
          : d.status === "rejected"
            ? "Deposit rejected"
            : "Deposit approved";
      out.push({
        id: `pd-${d.id}`,
        kind: "deposit",
        amount: Number(d.amount),
        date: d.created_at,
        status: d.status,
        label,
        receipt: { kind: "deposit", id: d.id },
      });
    }
    for (const w of pendingWithdrawals) {
      const label =
        w.status === "pending"
          ? "Withdrawal requested"
          : w.status === "rejected"
            ? "Withdrawal rejected"
            : "Withdrawal paid";
      out.push({
        id: `pw-${w.id}`,
        kind: "withdrawal",
        amount: -Number(w.amount),
        date: w.created_at,
        status: w.status,
        label,
        receipt: { kind: "withdrawal", id: w.id },
      });
    }

    out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    if (filter === "Deposits") return out.filter((r) => r.kind === "deposit");
    if (filter === "Withdrawals") return out.filter((r) => r.kind === "withdrawal");
    if (filter === "Profits") return out.filter((r) => r.kind === "profit");
    return out;
  }, [tx, pendingDeposits, pendingWithdrawals, filter]);

  const filterLabels: Record<(typeof FILTERS)[number], string> = {
    All: t("wallet.filter.all"),
    Deposits: t("wallet.filter.deposits"),
    Withdrawals: t("wallet.filter.withdrawals"),
    Profits: t("wallet.filter.profits"),
  };

  return (
    <div className="space-y-5">
      {/* Balance card */}
      <div className="rounded-2xl bg-card p-5 shadow-sm">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t("wallet.balance")}
        </div>
        <div className="mt-1.5 font-display text-3xl text-foreground">
          <Money value={balance} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            to="/dashboard/deposit"
            className="flex items-center justify-center gap-2 rounded-xl bg-success px-3 py-2.5 text-sm font-semibold text-white hover:bg-success/90"
          >
            <ArrowDownToLine className="h-4 w-4" /> {t("common.deposit")}
          </Link>
          <Link
            to="/dashboard/withdraw"
            className="flex items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-accent"
          >
            <ArrowUpFromLine className="h-4 w-4" /> {t("common.withdraw")}
          </Link>
        </div>

        <button
          onClick={() => setSheetOpen(true)}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          <Send className="h-4 w-4" /> Transfer
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Transactions */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("wallet.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const inner = (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      r.kind === "profit"
                        ? "bg-success/10 text-success"
                        : r.kind === "deposit"
                          ? "bg-success/10 text-success"
                          : r.kind === "withdrawal"
                            ? "bg-warning/10 text-warning"
                            : "bg-primary/10 text-primary"
                    }`}
                  >
                    {r.kind === "profit" ? (
                      <Sparkles className="h-4 w-4" />
                    ) : r.kind === "deposit" ? (
                      <ArrowDownToLine className="h-4 w-4" />
                    ) : r.kind === "withdrawal" ? (
                      <ArrowUpFromLine className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDate(r.date)}
                      {r.receipt ? " · View receipt" : ""}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      r.amount >= 0 ? "text-success" : "text-destructive"
                    }`}
                  >
                    {r.amount >= 0 ? "+" : "-"}
                    <Money value={Math.abs(r.amount)} />
                  </span>
                  <StatusPill status={r.status} />
                </div>
              </>
            );
            const cls =
              "flex items-center justify-between gap-3 rounded-xl bg-card p-3 shadow-sm";
            return r.receipt ? (
              <Link
                key={r.id}
                to="/dashboard/receipt/$kind/$id"
                params={{ kind: r.receipt.kind, id: r.receipt.id }}
                className={`${cls} transition hover:shadow-md`}
              >
                {inner}
              </Link>
            ) : (
              <div key={r.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      )}

      <TransferSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userId={user?.id}
        onTransferSuccess={(amount) => setBalance((c) => c - amount)}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-success/10 text-success",
    paid: "bg-success/10 text-success",
    completed: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    rejected: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[9px] font-medium uppercase ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
