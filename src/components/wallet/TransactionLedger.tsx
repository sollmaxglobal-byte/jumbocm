import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  ReceiptText,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { Money } from "@/components/Money";

export type TransactionRow = {
  id: string;
  kind: "deposit" | "withdrawal" | "profit" | "investment";
  amount: number;
  date: string;
  status: string;
  label: string;
  receipt?: { kind: "deposit" | "withdrawal"; id: string };
};

const KIND_STYLE: Record<TransactionRow["kind"], { icon: typeof Sparkles; className: string }> = {
  deposit: { icon: ArrowDownToLine, className: "bg-success/10 text-success" },
  withdrawal: { icon: ArrowUpFromLine, className: "bg-warning/10 text-warning" },
  profit: { icon: Sparkles, className: "bg-gold/10 text-gold" },
  investment: { icon: TrendingUp, className: "bg-primary/10 text-primary" },
};

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "text-warning" },
  processing: { label: "Processing", className: "text-warning" },
  dispatched: { label: "Processing", className: "text-warning" },
  rejected: { label: "Rejected", className: "text-destructive" },
  failed: { label: "Failed", className: "text-destructive" },
};

function dayKey(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function timeOf(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const groups = useMemo(() => {
    const map = new Map<string, TransactionRow[]>();
    for (const row of rows) {
      const key = dayKey(row.date);
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <ReceiptText className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">{emptyLabel}</p>
        {emptyHint && <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([day, items]) => (
        <section key={day}>
          <h3 className="px-1 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {formatDate(day)}
          </h3>
          <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/70 bg-card">
            {items.map((row) => (
              <li key={row.id}>
                <LedgerRow row={row} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LedgerRow({ row }: { row: TransactionRow }) {
  const kind = KIND_STYLE[row.kind];
  const Icon = kind.icon;
  const status = STATUS_STYLE[row.status];
  const income = row.amount >= 0;

  const content = (
    <>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${kind.className}`}>
        <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold leading-5 text-foreground">
          {row.label}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="tabular-nums">{timeOf(row.date)}</span>
          {status && (
            <>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <span className={status.className}>{status.label}</span>
            </>
          )}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end">
        <span
          className={`text-[13.5px] leading-5 tabular-nums ${
            income ? "text-success" : "text-foreground"
          }`}
        >
          {income ? "+" : "−"}
          <Money value={Math.abs(row.amount)} />
        </span>
        <span className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">
          {row.receipt ? "Receipt" : income ? "Credit" : "Debit"}
        </span>
      </span>

      {row.receipt && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={2} />
      )}
    </>
  );

  const cls = "flex min-h-[64px] items-center gap-3 px-4 py-3 transition-colors active:bg-muted/50";

  return row.receipt ? (
    <Link
      to="/dashboard/receipt/$kind/$id"
      params={{ kind: row.receipt.kind, id: row.receipt.id }}
      className={`${cls} hover:bg-muted/40`}
    >
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
