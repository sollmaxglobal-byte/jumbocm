import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowDownToLine, ArrowUpFromLine, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { Money } from "@/components/Money";
import { TransferSheet } from "@/components/wallet/TransferSheet";
import { TransactionLedger } from "@/components/wallet/TransactionLedger";
import { TransactionFilters, type TransactionFilter } from "@/components/wallet/TransactionFilters";

const searchSchema = z.object({
  filter: z.enum(["All", "Deposits", "Withdrawals", "Profits"]).optional(),
});

export const Route = createFileRoute("/dashboard/wallet")({
  validateSearch: (s) => searchSchema.parse(s),
  component: WalletPage,
});

type Filter = TransactionFilter;

function WalletPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const search = Route.useSearch();
  const [filter, setFilter] = useState<Filter>(search.filter ?? "All");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { rows, balance, setBalance } = useTransactionHistory(user?.id, filter);

  useEffect(() => {
    if (search.filter) setFilter(search.filter);
  }, [search.filter]);

  const filterLabels: Record<TransactionFilter, string> = {
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
          <Send className="h-4 w-4" /> {t("Transfer")}
        </button>
      </div>

      {/* Filters + ledger */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="text-sm font-semibold text-foreground">{t("wallet.transactions")}</h2>
          {rows.length > 0 && (
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
              {rows.length}
            </span>
          )}
        </div>

        <TransactionFilters
          value={filter}
          labels={filterLabels}
          onChange={setFilter}
          ariaLabel={t("wallet.transactions")}
        />

        <TransactionLedger
          rows={rows}
          emptyLabel={t("wallet.empty")}
          emptyHint={t("wallet.emptyHint")}
        />
      </section>

      <TransferSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userId={user?.id}
        onTransferSuccess={(amount) => setBalance((c) => c - amount)}
      />
    </div>
  );
}
