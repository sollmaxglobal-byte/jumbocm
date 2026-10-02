import { useEffect, useState } from "react";

/**
 * A Forex-trading themed pre-loader overlay shown on first app load.
 * Displays animated candlesticks and a pulsing chart line in the app's
 * gold/dark palette, then fades out smoothly once the app is ready.
 *
 * Uses a `mounted` guard so the server and client initial render match
 * (both render null), avoiding SSR hydration mismatches.
 */
export function ForexPreloader() {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = window.setTimeout(() => setHidden(true), 1600);
    return () => window.clearTimeout(t);
  }, []);

  if (!mounted || hidden) return null;

  // 12 candlesticks with deterministic heights
  const candles = [
    { h: 40, up: true },
    { h: 65, up: false },
    { h: 30, up: true },
    { h: 80, up: true },
    { h: 50, up: false },
    { h: 70, up: true },
    { h: 35, up: false },
    { h: 90, up: true },
    { h: 55, up: false },
    { h: 75, up: true },
    { h: 45, up: false },
    { h: 60, up: true },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0f0f12] transition-opacity duration-500"
      style={{ opacity: hidden ? 0 : 1 }}
    >
      {/* Animated candlestick chart */}
      <div className="flex items-end gap-1.5" style={{ height: 120 }}>
        {candles.map((c, i) => (
          <div
            key={i}
            className="flex flex-col items-center"
            style={{
              animation: `fxPulse 1.2s ease-in-out ${i * 0.08}s infinite alternate`,
            }}
          >
            <div
              style={{
                width: 3,
                height: 16,
                background: c.up ? "#C9F158" : "#ef4444",
                borderRadius: 2,
                opacity: 0.5,
              }}
            />
            <div
              style={{
                width: 10,
                height: c.h,
                background: c.up ? "#C9F158" : "#ef4444",
                borderRadius: 3,
              }}
            />
            <div
              style={{
                width: 3,
                height: 16,
                background: c.up ? "#C9F158" : "#ef4444",
                borderRadius: 2,
                opacity: 0.5,
              }}
            />
          </div>
        ))}
      </div>

      {/* Brand text */}
      <div className="mt-8 text-center">
        <h1
          className="text-2xl font-extrabold tracking-tight text-white"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Jumbo<span style={{ color: "#C9F158" }}>CM</span>
        </h1>
        <p className="mt-1.5 text-xs font-medium tracking-widest text-white/40 uppercase">
          Loading markets…
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-6 h-1 w-44 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full"
          style={{
            background: "#C9F158",
            animation: "fxBar 1.6s ease-out forwards",
          }}
        />
      </div>

      <style>{`
        @keyframes fxPulse {
          0% { transform: translateY(0); opacity: 0.6; }
          100% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fxBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
