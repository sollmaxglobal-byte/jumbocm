import { useI18n } from "@/hooks/useI18n";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  dispatched: "Processing",
  approved: "Approved",
  paid: "Paid",
  completed: "Completed",
  rejected: "Rejected",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const label = STATUS_LABELS[status.toLowerCase()] ?? status;
  return <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{t(label)}</span>;
}
