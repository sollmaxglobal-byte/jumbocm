export type TransactionFilter = "All" | "Deposits" | "Withdrawals" | "Profits";

const FILTERS: TransactionFilter[] = ["All", "Deposits", "Withdrawals", "Profits"];

export function TransactionFilters({
  value,
  labels,
  onChange,
  ariaLabel,
}: {
  value: TransactionFilter;
  labels: Record<TransactionFilter, string>;
  onChange: (filter: TransactionFilter) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="-mx-1 flex gap-1 overflow-x-auto rounded-full border border-border/70 bg-muted/60 p-1"
      role="group"
      aria-label={ariaLabel}
    >
      {FILTERS.map((filter) => {
        const active = value === filter;
        return (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            aria-pressed={active}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
              active
                ? "bg-card text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {labels[filter]}
          </button>
        );
      })}
    </div>
  );
}
