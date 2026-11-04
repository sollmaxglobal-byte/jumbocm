import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Segmented three-step navigation; completed steps can be tapped to go back. */
export function StepRail({
  labels,
  step,
  onBack,
}: {
  labels: string[];
  step: number;
  onBack: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-sm">
      {labels.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <button
            key={label}
            type="button"
            onClick={() => done && onBack(i)}
            disabled={i > step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-left transition",
              active && "bg-primary text-primary-foreground shadow-sm",
              done && "text-primary hover:bg-primary/10",
              !active && !done && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                active && "bg-primary-foreground/20 text-primary-foreground",
                done && "bg-primary/10 text-primary",
                !active && !done && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className="min-w-0 truncate text-[11px] font-semibold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
