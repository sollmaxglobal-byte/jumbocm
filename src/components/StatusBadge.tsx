const TONES: Record<string, string> = {
  pending: "border-warning/25 bg-warning/10 text-warning",
  processing: "border-primary/25 bg-primary/10 text-primary",
  approved: "border-success/25 bg-success/10 text-success",
  paid: "border-success/25 bg-success/10 text-success",
  completed: "border-success/25 bg-success/10 text-success",
  rejected: "border-destructive/25 bg-destructive/10 text-destructive",
  failed: "border-destructive/25 bg-destructive/10 text-destructive",
};

export function StatusBadge({ status }: { status: string }) {
  const tone =
    TONES[String(status ?? "").toLowerCase()] ?? "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {status}
    </span>
  );
}
