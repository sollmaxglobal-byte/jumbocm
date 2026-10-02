import { formatUSD, formatXAF } from "@/lib/format";

type DualMoneyProps = {
  /** XAF amount (the source-of-truth denomination). */
  value: number | string | null | undefined;
  /** When false, both figures are masked. */
  visible?: boolean;
  /** Which currency is shown as the large figure. Defaults to XAF. */
  primary?: "xaf" | "usd";
  className?: string;
  primaryClassName?: string;
  usdClassName?: string;
};

/**
 * Amount shown in two currencies — a large primary figure with a small
 * equivalent underneath. XAF remains the source of truth; USD is a display
 * conversion only.
 */
export function DualMoney({
  value,
  visible = true,
  primary = "xaf",
  className = "",
  primaryClassName = "text-2xl font-bold text-foreground",
  usdClassName = "text-muted-foreground",
}: DualMoneyProps) {
  const big = primary === "usd" ? formatUSD(value) : formatXAF(value);
  const small = primary === "usd" ? `≈ ${formatXAF(value)}` : `≈ ${formatUSD(value)}`;
  return (
    <div className={`flex flex-col leading-tight ${className}`}>
      <span className={`whitespace-nowrap tabular-nums ${primaryClassName}`}>
        {visible ? big : "••••••"}
      </span>
      <span className={`mt-0.5 text-xs font-medium tabular-nums ${usdClassName}`}>
        {visible ? small : "••••"}
      </span>
    </div>
  );
}
