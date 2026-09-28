import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Activity } from "lucide-react";
import { formatXAF } from "@/lib/format";

export type BotInvestment = {
  id: string;
  amount: number;
  daily_roi_percent: number;
  start_date: string;
  last_payout_at: string | null;
  is_paused: boolean;
  plans: { name: string; profit_type?: string | null; fixed_daily_profit?: number | null } | null;
};

const DAY = 86_400_000;
const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT"];

function dailyProfit(i: BotInvestment) {
  if (i.plans?.profit_type === "fixed" && Number(i.plans.fixed_daily_profit) > 0) return Number(i.plans.fixed_daily_profit);
  return (Number(i.amount) * Number(i.daily_roi_percent)) / 100;
}

function cycleProgress(i: BotInvestment, now: number) {
  const start = new Date(i.last_payout_at ?? i.start_date).getTime();
  const elapsed = Math.max(0, now - start) % DAY;
  return elapsed / DAY;
}

const usd = (xaf: number) => `$${(xaf / 600).toFixed(2)}`;

export function TradingBot({ investments }: { investments: BotInvestment[] }) {
  const running = investments.filter((i) => !i.is_paused);
  const [now, setNow] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setTick((n) => n + 1); }, 2000);
    return () => clearInterval(t);
  }, []);

  if (!running.length) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-5 text-center">
        <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-semibold text-foreground">Trading bot is idle</p>
        <p className="mt-1 text-xs text-muted-foreground">Activate an investment plan to start the bot.</p>
      </section>
    );
  }

  const target = running.reduce((s, i) => s + dailyProfit(i), 0);
  const earned = running.reduce((s, i) => s + dailyProfit(i) * cycleProgress(i, now), 0);
  const pct = target ? (earned / target) * 100 : 0;
  const pair = PAIRS[tick % PAIRS.length];
  const step = target / (DAY / 2000);

  return (
    <section className="overflow-hidden rounded-2xl border border-success/25 bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div className="grid h-11 w-11 place-items-center rounded-xl bg-success/10 text-success"
            animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            <Bot className="h-6 w-6" />
          </motion.div>
          <div>
            <p className="text-sm font-semibold text-foreground">Trading bot</p>
            <p className="flex items-center gap-1 text-xs text-success">
              <motion.span className="h-1.5 w-1.5 rounded-full bg-success" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1 }} />
              Active · {running.length} {running.length === 1 ? "plan" : "plans"}
            </p>
          </div>
        </div>
        <Activity className="h-5 w-5 text-success" />
      </div>

      <div className="mt-4 flex h-12 items-end gap-1">
        {Array.from({ length: 24 }).map((_, i) => (
          <motion.div key={i} className="flex-1 rounded-sm bg-success/60"
            animate={{ height: [`${20 + ((i * 37 + tick * 13) % 70)}%`, `${20 + ((i * 53 + tick * 7) % 80)}%`] }}
            transition={{ duration: 1.8, ease: "easeInOut" }} />
        ))}
      </div>

      <motion.div key={tick} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="mt-3 flex items-center justify-between rounded-lg bg-success/10 px-3 py-2 text-xs">
        <span className="font-medium text-foreground">{pair}</span>
        <span className="font-semibold text-success">+{formatXAF(Math.max(1, step))}</span>
      </motion.div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Today's profit</p>
          <p className="text-2xl font-semibold tabular-nums text-success">{usd(earned)}</p>
          <p className="text-xs text-muted-foreground">{formatXAF(earned)} of {formatXAF(target)}</p>
        </div>
        <p className="text-sm font-semibold text-foreground">{pct.toFixed(1)}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
