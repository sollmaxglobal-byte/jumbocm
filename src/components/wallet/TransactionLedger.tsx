import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { Money } from "@/components/Money";
import { useI18n } from "@/hooks/useI18n";

export type TransactionRow = {
  id: string;
  kind: "deposit" | "withdrawal" | "profit" | "investment";
  amount: number;
  date: string;
  status: string;
  label: string;
};

const KIND_STYLE: Record<TransactionRow["kind"], { icon: typeof Sparkles; className: string }> = {
  deposit: { icon: ArrowDownToLine, className: "bg-success/10 text-success" },
  withdrawal: { icon: ArrowUpFromLine, className: "bg-warning/10 text-warning" },
  profit: { icon: Sparkles, className: "bg-gold/10 text-gold" },
  investment: { icon: TrendingUp, className: "bg-primary/10 text-primary" },
};

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  approved: { label: "Completed", className: "bg-success/10 text-success" },
  completed: { label: "Completed", className: "bg-success/10 text-success" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning" },
  processing: { label: "Processing", className: "bg-warning/10 text-warning" },
  dispatched: { label: "Processing", className: "bg-warning/10 text-warning" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
};

/** UTC clock time so it always matches the UTC date shown next to it. */
function timeOf(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function TransactionLedger({
  rows,
  emptyLabel,
  emptyHint,
}: {
  rows: TransactionRow[];
  emptyLabel: string;
  emptyHint?: string;
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <ArrowLeftRight className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">{emptyLabel}</p>
        {emptyHint && <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      {rows.map((row) => (
        <LedgerRow key={row.id} row={row} />
      ))}
    </ul>
  );
}

function LedgerRow({ row }: { row: TransactionRow }) {
  const { t } = useI18n();
  const kind = KIND_STYLE[row.kind];
  const Icon = kind.icon;
  const status = STATUS_STYLE[row.status] ?? {
    label: "Completed",
    className: "bg-muted text-muted-foreground",
  };
  const income = row.amount >= 0;

  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${kind.className}`}
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold leading-5 text-foreground">
          {row.label}
        </p>
        <p className="mt-0.5 text-[11.5px] font-medium tabular-nums text-muted-foreground">
          {formatDate(row.date)} · {timeOf(row.date)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`text-[14px] leading-5 tabular-nums ${
            income ? "text-success" : "text-foreground"
          }`}
        >
          {income ? "+" : "−"}
          <Money value={Math.abs(row.amount)} />
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status.className}`}
        >
          {t(status.label)}
        </span>
      </div>
    </li>
  );
}
