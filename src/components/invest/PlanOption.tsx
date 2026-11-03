import { motion } from "framer-motion";
import { Calendar, Check, Repeat, TrendingUp } from "lucide-react";
import { formatUSD, formatXAF } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dailyProfitFor, payoutLabel, type Plan } from "./planMath";

/** One selectable plan inside the guided invest flow. */
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
  const popular = plan.name === "Growth Plan";
  const baseAmount = Number(plan.amount_type === "fixed" ? plan.fixed_amount : plan.min_amount);
  const perDay = dailyProfitFor(plan, baseAmount);
  const totalProfit = perDay * Number(plan.duration_days);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border bg-card p-4 text-left transition active:scale-[0.995]",
        active
          ? "border-primary shadow-[0_12px_30px_-18px_rgba(11,59,69,0.7)] ring-2 ring-primary/25"
          : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[15px] font-semibold text-foreground">{plan.name}</h3>
            {popular && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                Popular
              </span>
            )}
          </div>
          {plan.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {plan.description}
            </p>
          )}
        </div>
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full border transition",
            active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-transparent",
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] font-bold leading-none tabular-nums text-success">
              {formatUSD(perDay)}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">/ day</span>
          </div>
          <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
            ≈ {formatXAF(perDay)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
          {plan.profit_type === "percent"
            ? `${plan.daily_roi_percent}% daily`
            : "Fixed daily return"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Meta icon={Calendar} label="Term" value={`${plan.duration_days} days`} />
        <Meta icon={TrendingUp} label="Profit" value={formatUSD(totalProfit)} accent />
        <Meta icon={Repeat} label="Payout" value={payoutLabel(plan.payout_frequency)} />
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-[11px]">
        <span className="text-muted-foreground">
          {plan.amount_type === "fixed" ? "Fixed stake" : "Invest between"}
        </span>
        <span className="truncate font-semibold tabular-nums text-foreground">
          {plan.amount_type === "fixed"
            ? formatXAF(plan.fixed_amount)
            : `${formatXAF(plan.min_amount)} – ${formatXAF(plan.max_amount)}`}
        </span>
      </div>
    </motion.button>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-secondary/40 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-0.5 truncate text-[11px] font-semibold capitalize tabular-nums",
          accent ? "text-success" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
