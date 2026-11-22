import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { TransactionLedger } from "@/components/wallet/TransactionLedger";
import { TransactionFilters, type TransactionFilter } from "@/components/wallet/TransactionFilters";

const searchSchema = z.object({
  filter: z.enum(["All", "Deposits", "Withdrawals", "Profits"]).optional(),
});

export const Route = createFileRoute("/dashboard/transactions")({
  validateSearch: (s) => searchSchema.parse(s),
  component: TransactionsPage,
});

function TransactionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const search = Route.useSearch();
  const [filter, setFilter] = useState<TransactionFilter>(search.filter ?? "All");
  const { rows } = useTransactionHistory(user?.id, filter);

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
      <header className="flex items-baseline justify-between px-1">
        <div className="space-y-1">
          <h1 className="font-display text-2xl text-foreground">{t("Transactions")}</h1>
          <p className="text-sm text-muted-foreground">{t("wallet.subtitle")}</p>
        </div>
        {rows.length > 0 && (
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
            {rows.length}
          </span>
        )}
      </header>

      <TransactionFilters
        value={filter}
        labels={filterLabels}
        onChange={setFilter}
        ariaLabel={t("Transactions")}
      />

      <TransactionLedger
        rows={rows}
        emptyLabel={t("wallet.empty")}
        emptyHint={t("wallet.emptyHint")}
      />
    </div>
  );
}
