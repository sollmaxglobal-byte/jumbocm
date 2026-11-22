import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { formatUSD, formatXAF } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { cn } from "@/lib/utils";
import { payoutLabel, type Plan } from "./planMath";

/** One selectable plan row inside the invest flow. */
export function PlanOption({
  plan,
  active,
  index,
  onSelect,
}: {
  plan: Plan;
  active: boolean;
  index: number;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const popular = plan.name === "Growth Plan";
  const rate =
    plan.profit_type === "percent"
      ? `${plan.daily_roi_percent}%`
      : formatUSD(plan.fixed_daily_profit);

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition active:scale-[0.99]",
        active
          ? "border-primary shadow-[0_10px_24px_-18px_rgba(11,59,69,0.7)] ring-2 ring-primary/20"
          : "border-border hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border text-transparent",
        )}
      >
        <Check className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{plan.name}</span>
          {popular && (
            <span className="shrink-0 rounded-full bg-gold/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-accent">
              {t("Popular")}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
          <span>{t("{days} days", { days: plan.duration_days })}</span>
          <span aria-hidden>·</span>
          <span className="capitalize">{t(payoutLabel(plan.payout_frequency))}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">
            {plan.amount_type === "fixed"
              ? formatXAF(plan.fixed_amount)
              : `${t("Min")} ${formatXAF(plan.min_amount)}`}
          </span>
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="block text-[15px] font-bold leading-none tabular-nums text-success">
          {rate}
        </span>
        <span className="mt-1 block text-[10px] font-medium text-muted-foreground">
          {t("/ day")}
        </span>
      </span>
    </motion.button>
  );
}
