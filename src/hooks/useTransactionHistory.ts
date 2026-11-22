import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";
import type { TransactionRow } from "@/components/wallet/TransactionLedger";
import type { TransactionFilter } from "@/components/wallet/TransactionFilters";

type Tx = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};
type Pending = { id: string; amount: number; status: string; created_at: string };

/**
 * Loads the signed-in customer's full money history — recorded transactions plus
 * pending/approved deposits and withdrawals — and shapes it into ledger rows.
 */
export function useTransactionHistory(
  userId: string | undefined,
  filter: TransactionFilter = "All",
) {
  const { t } = useI18n();
  const [tx, setTx] = useState<Tx[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<Pending[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<Pending[]>([]);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [{ data: txData }, { data: pd }, { data: pw }, { data: prof }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("deposits")
          .select("id,amount,status,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("withdrawals")
          .select("id,amount,status,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("profiles").select("balance").eq("id", userId).maybeSingle(),
      ]);
      setTx((txData as Tx[]) ?? []);
      setPendingDeposits((pd as Pending[]) ?? []);
      setPendingWithdrawals((pw as Pending[]) ?? []);
      setBalance(Number(prof?.balance ?? 0));
    })();
  }, [userId]);

  const rows = useMemo(() => {
    const out: TransactionRow[] = [];

    for (const item of tx) {
      if (item.type === "deposit" || item.type === "withdrawal") continue;
      let kind: TransactionRow["kind"] = "profit";
      let label = item.description ?? "";
      if (item.type === "investment") {
        kind = "investment";
        label = label || t("Investment");
      } else if (item.type === "profit" || item.type === "investment_return") {
        kind = "profit";
        label = label || t("Profit");
      } else continue;
      out.push({
        id: item.id,
        kind,
        amount: Number(item.amount),
        date: item.created_at,
        status: "approved",
        label,
      });
    }
    for (const d of pendingDeposits) {
      const label =
        d.status === "pending"
          ? t("Deposit submitted")
          : d.status === "rejected"
            ? t("Deposit rejected")
            : t("Deposit approved");
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
          ? t("Withdrawal requested")
          : w.status === "rejected"
            ? t("Withdrawal rejected")
            : t("Withdrawal paid");
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
  }, [tx, pendingDeposits, pendingWithdrawals, filter, t]);

  return { rows, balance, setBalance };
}
