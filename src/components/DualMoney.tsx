import { formatUSD, formatXAF } from "@/lib/format";

type DualMoneyProps = {
  /** XAF amount (the source-of-truth denomination). */
  value: number | string | null | undefined;
  /** When false, both figures are masked. */
  visible?: boolean;
  className?: string;
  primaryClassName?: string;
  usdClassName?: string;
};

/**
 * XAF-primary amount with a small USD equivalent underneath.
 * XAF stays the source of truth; USD is a display conversion only.
 */
export function DualMoney({
  value,
  visible = true,
  className = "",
  primaryClassName = "text-2xl font-bold text-foreground",
  usdClassName = "text-muted-foreground",
}: DualMoneyProps) {
  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className={`whitespace-nowrap tabular-nums ${primaryClassName}`}>
        {visible ? formatXAF(value) : "••••••"}
      </span>
      <span className={`mt-0.5 text-xs font-medium tabular-nums ${usdClassName}`}>
        {visible ? `≈ ${formatUSD(value)}` : "••••"}
      </span>
    </div>
  );
}
