import { ArrowLeft, Check, Clock3, Copy, ShieldCheck } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { formatXAF } from "@/lib/format";

type Brand = {
  /** Brand accent used for the frame, amount border and primary action. */
  accent: string;
  /** Logo badge text shown in the header. */
  badge: string;
  /** Wordmark shown next to the badge. */
  word: string;
};

const MTN: Brand = { accent: "#ffd700", badge: "MTN", word: "MoMo" };
const ORANGE: Brand = { accent: "#ff7900", badge: "orange", word: "Money" };

/** Brand colours follow the wallet the customer picked: MTN yellow or Orange orange. */
function brandOf(name: string): Brand {
  const lower = name.toLowerCase();
  if (lower.includes("mtn")) return MTN;
  if (lower.includes("orange")) return ORANGE;
  return { accent: "#f6c85a", badge: name.slice(0, 3).toUpperCase(), word: "" };
}

type MethodPaymentScreenProps = {
  methodName: string;
  accountName: string;
  number: string;
  amount: number;
  /** mm:ss countdown of the payment window. */
  timer: string;
  onBack: () => void;
  onPaid: () => void;
  onCopy: (value: string) => void;
};

/**
 * "Finalise your payment" screen for a manual mobile-money deposit.
 * Mirrors the wallet's own send-money screen: amount, verified recipient,
 * the number to send to, the payment window and the two bottom actions.
 */
export function MethodPaymentScreen({
  methodName,
  accountName,
  number,
  amount,
  timer,
  onBack,
  onPaid,
  onCopy,
}: MethodPaymentScreenProps) {
  const { t } = useI18n();
  const brand = brandOf(methodName);
  const amountOnly = formatXAF(amount).replace(" XAF", "");

  return (
    <div className="fixed inset-0 z-40 mx-auto flex h-dvh w-full max-w-md flex-col bg-[#121212] text-white">
      {/* Wallet header — the brand of the method the customer picked. */}
      <header className="shrink-0 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
        <div className="flex items-center gap-2">
          <span
            className="rounded-md px-2 py-1 text-[15px] font-black italic leading-none tracking-tight text-black"
            style={{ background: brand.accent }}
          >
            {brand.badge}
          </span>
          {brand.word && (
            <span
              className="text-[21px] font-black italic leading-none tracking-tight"
              style={{ color: brand.accent }}
            >
              {brand.word}
            </span>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
        <div className="text-center">
          <h1
            className="text-[23px] font-black uppercase leading-tight tracking-tight"
            style={{ color: brand.accent }}
          >
            {t("Complete your payment")}
          </h1>
          <p className="mt-1.5 text-[13px] leading-snug text-white/75">
            {t("Send the exact amount — secure payment")}
          </p>
        </div>

        {/* Amount to send */}
        <div
          className="relative mt-5 rounded-2xl border-[3px] bg-black p-4"
          style={{ borderColor: brand.accent }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {t("Amount to send")}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[30px] font-black leading-none tracking-tight tabular-nums">
              {amountOnly}
            </span>
            <span className="text-[15px] font-bold text-white/80">FCFA</span>
          </div>
          <span
            className="absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-black"
            style={{ background: brand.accent }}
          >
            {t("Exact")}
          </span>
        </div>

        {/* Recipient */}
        <div
          className="mt-3 rounded-2xl border bg-black p-4"
          style={{ borderColor: `${brand.accent}99` }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
            {t("Recipient")}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-black uppercase tracking-wide">{accountName}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black">
              <ShieldCheck className="size-3" style={{ color: brand.accent }} />
              {t("Verified")}
            </span>
          </div>

          <div className="mt-3 text-[11px] text-white/60">
            {t("{method} number", { method: methodName })}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div
              className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-full border px-3 text-[17px] font-bold tabular-nums"
              style={{ borderColor: `${brand.accent}99` }}
            >
              <span className="truncate">{number}</span>
            </div>
            <button
              type="button"
              onClick={() => onCopy(number)}
              aria-label={t("Copy")}
              className="flex size-11 shrink-0 items-center justify-center rounded-md border transition-opacity hover:opacity-80"
              style={{ borderColor: brand.accent, color: brand.accent }}
            >
              <Copy className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onCopy(number)}
            className="mt-2 w-full text-center text-[11px] leading-none text-white/55"
          >
            {t("Tap to copy the number")}
          </button>
        </div>

        {/* Payment window */}
        <div
          className="mt-3 rounded-2xl px-4 py-3 text-center text-black"
          style={{ background: brand.accent }}
        >
          <div className="flex items-center justify-center gap-2">
            <Clock3 className="size-5 shrink-0" strokeWidth={2.5} />
            <span className="font-mono text-[24px] font-black leading-none tabular-nums">
              {timer}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-semibold leading-tight">
            {t("Payment window expires in")}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto grid grid-cols-[auto_1fr] gap-3 pt-6">
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl border bg-transparent px-5 text-[15px] font-bold transition-colors hover:bg-white/5"
            style={{ borderColor: brand.accent, color: brand.accent }}
          >
            <ArrowLeft className="size-4" />
            {t("Back")}
          </button>
          <button
            type="button"
            onClick={onPaid}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl text-[15px] font-black text-black transition-opacity hover:opacity-90"
            style={{ background: brand.accent }}
          >
            <Check className="size-4" strokeWidth={3} />
            {t("I have paid")}
          </button>
        </div>
      </div>
    </div>
  );
}
