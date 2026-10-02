export function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{status}</span>;
}
