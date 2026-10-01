import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Zap } from "lucide-react";

const ASSETS = [
  { symbol: "BTC/USD", price: "67,420", change: 2.4 },
  { symbol: "ETH/USD", price: "3,280", change: 1.8 },
  { symbol: "EUR/USD", price: "1.0842", change: -0.3 },
  { symbol: "XAU/USD", price: "2,340", change: 0.9 },
  { symbol: "AAPL", price: "189.42", change: 1.2 },
  { symbol: "GBP/JPY", price: "198.45", change: -0.5 },
  { symbol: "TSLA", price: "248.50", change: 3.1 },
  { symbol: "USD/CAD", price: "1.3640", change: -0.2 },
];

const WIN_RATE = 90;

type Trade = {
  id: number;
  asset: string;
  direction: "BUY" | "SELL";
  pnl: string;
  win: boolean;
};

function makeTrade(id: number): Trade {
  const asset = ASSETS[Math.floor(Math.random() * ASSETS.length)];
  const win = Math.random() * 100 < WIN_RATE;
  const direction: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
  const amount = win
    ? Math.floor(Math.random() * 2000 + 200)
    : Math.floor(Math.random() * 400 + 50);
  return {
    id,
    asset: asset.symbol,
    direction,
    pnl: `${win ? "+" : "-"}$${amount.toLocaleString()}`,
    win,
  };
}

export function AITradingRobot({ active }: { active: boolean }) {
  const [trades, setTrades] = useState<Trade[]>(() =>
    Array.from({ length: 5 }, (_, i) => makeTrade(i))
  );
  const [tradeCount, setTradeCount] = useState(1247);
  const [winCount, setWinCount] = useState(1122);
  const [chartBars, setChartBars] = useState(() =>
    Array.from({ length: 28 }, () => ({
      height: 25 + Math.random() * 65,
      up: Math.random() > 0.25,
    }))
  );
  const [nextId, setNextId] = useState(5);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      const trade = makeTrade(nextId);
      setNextId((n) => n + 1);
      setTrades((prev) => [trade, ...prev].slice(0, 5));
      setTradeCount((c) => c + 1);
      if (trade.win) setWinCount((c) => c + 1);
      setChartBars((prev) => [
        ...prev.slice(1),
        { height: 25 + Math.random() * 65, up: Math.random() > 0.25 },
      ]);
    }, 2500);
    return () => clearInterval(interval);
  }, [active, nextId]);

  if (!active) return null;

  const winRate = (winCount / tradeCount) * 100;

  return (
    <section className="overflow-hidden rounded-2xl border border-auth-accent/20 bg-auth-panel text-auth-foreground">
      {/* Header with animated AI core */}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 place-items-center">
            <motion.div
              className="absolute inset-0 rounded-full border border-auth-accent/40"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-auth-accent/25"
              animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
            />
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-auth-accent/15 text-auth-accent">
              <Cpu className="h-5 w-5" />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-auth-foreground">AI Trading Robot</p>
            <p className="flex items-center gap-1 text-[11px] text-auth-muted">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-success"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1 }}
              />
              Live · Auto-trading
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-auth-accent/15 px-3 py-1.5">
          <Zap className="h-3.5 w-3.5 text-auth-accent" />
          <span className="text-sm font-bold text-auth-accent">{WIN_RATE}% Win Rate</span>
        </div>
      </div>

      {/* Scrolling asset ticker */}
      <div className="overflow-hidden border-b border-white/5 py-2">
        <motion.div
          className="flex gap-6 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
        >
          {[...ASSETS, ...ASSETS].map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-auth-foreground">{a.symbol}</span>
              <span className="text-auth-muted">{a.price}</span>
              <span className={a.change >= 0 ? "text-success" : "text-destructive"}>
                {a.change >= 0 ? "▲" : "▼"}
                {Math.abs(a.change)}%
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Mini live chart with scanning line */}
      <div className="relative flex h-16 items-end gap-0.5 overflow-hidden border-b border-white/5 px-5 py-3">
        {chartBars.map((bar, i) => (
          <motion.div
            key={i}
            className={`flex-1 rounded-sm ${bar.up ? "bg-success/50" : "bg-destructive/40"}`}
            animate={{ height: `${bar.height}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        ))}
        <motion.div
          className="pointer-events-none absolute inset-y-0 w-px bg-auth-accent/50"
          animate={{ left: ["0%", "100%"] }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        />
      </div>

      {/* Live trade feed */}
      <div className="px-5 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-auth-muted">
          Recent Trades
        </p>
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {trades.map((trade) => (
              <motion.div
                key={trade.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${
                      trade.win
                        ? "bg-success/20 text-success"
                        : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {trade.win ? "✓" : "✗"}
                  </span>
                  <span className="text-xs font-semibold text-auth-foreground">
                    {trade.asset}
                  </span>
                  <span
                    className={`text-[10px] font-medium ${
                      trade.direction === "BUY" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {trade.direction}
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    trade.win ? "text-success" : "text-destructive"
                  }`}
                >
                  {trade.pnl}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Win rate footer */}
      <div className="border-t border-white/5 px-5 py-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-auth-muted">Win Rate</span>
          <span className="font-semibold text-auth-accent">{winRate.toFixed(1)}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-auth-accent"
            animate={{ width: `${winRate}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-auth-muted">
          <span>{winCount.toLocaleString()} wins</span>
          <span>{tradeCount.toLocaleString()} total trades</span>
        </div>
      </div>
    </section>
  );
}
