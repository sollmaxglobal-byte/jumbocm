import { AlertCircle, ArrowLeft, Clock3, Copy, HelpCircle, Info, Wallet } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";
import { formatXAF } from "@/lib/format";

type MethodTheme = {
  /** Header band background + its text/icon colour. */
  header: string;
  headerInk: string;
  /** Primary brand colour for the amount, hints and field borders. */
  accent: string;
  /** Readable ink that sits on white for the brand colour. */
  accentInk: string;
  copyBg: string;
  copyInk: string;
  ctaBg: string;
  ctaInk: string;
  tint: string;
  infoBg: string;
  infoBorder: string;
  infoInk: string;
};

const MTN: MethodTheme = {
  header: "#ffcb05",
  headerInk: "#00305b",
  accent: "#ffcb05",
  accentInk: "#00305b",
  copyBg: "#00305b",
  copyInk: "#ffffff",
  ctaBg: "#ffcb05",
  ctaInk: "#00305b",
  tint: "#fff6d1",
  infoBg: "#fffbeb",
  infoBorder: "#f0d264",
  infoInk: "#6b5a1f",
};

const ORANGE: MethodTheme = {
  header: "#ff7900",
  headerInk: "#ffffff",
  accent: "#ff7900",
  accentInk: "#ff7900",
  copyBg: "#ff7900",
  copyInk: "#ffffff",
  ctaBg: "#ff7900",
  ctaInk: "#ffffff",
  tint: "#ffe7d6",
  infoBg: "#fff9e5",
  infoBorder: "#f0e0a8",
  infoInk: "#6b5a1f",
};

const GENERIC: MethodTheme = {
  header: "#f6c85a",
  headerInk: "#101014",
  accent: "#f6c85a",
  accentInk: "#8a6d13",
  copyBg: "#101014",
  copyInk: "#f6c85a",
  ctaBg: "#f6c85a",
  ctaInk: "#101014",
  tint: "#fdf3d4",
  infoBg: "#fffbeb",
  infoBorder: "#f0e0a8",
  infoInk: "#6b5a1f",
};

/** Brand colours follow the wallet the customer picked: MTN yellow/blue or Orange orange. */
function methodTheme(name: string): MethodTheme {
  const lower = name.toLowerCase();
  if (lower.includes("mtn")) return MTN;
  if (lower.includes("orange")) return ORANGE;
  return GENERIC;
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
 * "Complete your payment" screen for a manual mobile-money deposit.
 * Mirrors the provider's own send-money screen: amount, recipient, number to
 * send to, the payment window and the two bottom actions.
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
  const theme = methodTheme(methodName);
  const amountLabel = formatXAF(amount).replace("XAF", "FCFA");
  const amountOnly = amountLabel.replace(" FCFA", "");

  return (
    <div
      className="fixed inset-0 z-40 mx-auto flex h-dvh w-full max-w-md flex-col"
      style={{ background: theme.header }}
    >
      {/* Provider header — the method the customer chose is the page title. */}
      <header
        className="flex shrink-0 items-center gap-2 px-4 pb-5 pt-[calc(env(safe-area-inset-top)+0.85rem)]"
        style={{ color: theme.headerInk }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label={t("Back")}
          className="-ml-1 flex size-9 items-center justify-center rounded-full transition-colors hover:bg-black/10"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold tracking-tight">
          {methodName}
        </h1>
        <span className="flex size-9 items-center justify-center opacity-80" aria-hidden>
          <HelpCircle className="size-5" />
        </span>
      </header>

      {/* White sheet */}
      <div className="-mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-t-[28px] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6 text-[#1f1f1f]">
        <div className="text-center">
          <span
            className="mx-auto flex size-14 items-center justify-center rounded-full"
            style={{ background: theme.tint, color: theme.accentInk }}
          >
            <Wallet className="size-7" strokeWidth={2.2} />
          </span>
          <div
            className="mt-2 text-[30px] font-extrabold leading-tight tracking-tight tabular-nums"
            style={{ color: theme.accentInk }}
          >
            {amountLabel}
          </div>
          <p className="mt-1 text-[15px] font-semibold text-[#2f2f2f]">{t("Amount to send")}</p>
        </div>

        {/* Recipient card */}
        <div className="mt-5 rounded-2xl bg-white p-4 shadow-[0_10px_30px_rgba(16,24,40,0.12)] ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <img
              src="/avatar-african-man.svg"
              alt=""
              width={48}
              height={48}
              className="size-12 shrink-0 rounded-full object-cover ring-1 ring-black/10"
            />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-extrabold uppercase tracking-wide text-[#333333]">
                {accountName}
              </div>
              <div
                className="mt-1 flex items-center gap-1 text-[12px] font-semibold leading-tight"
                style={{ color: theme.accentInk }}
              >
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{t("Confirm this name before you send")}</span>
              </div>
            </div>
          </div>

          <div className="my-4 h-px bg-[#ececec]" />

          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#777777]">
            {t("Send to number")}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div
              className="flex h-12 min-w-0 flex-1 items-center rounded-xl border-2 bg-white px-3 text-[17px] font-bold tabular-nums text-[#222222]"
              style={{ borderColor: theme.accent }}
            >
              <span className="truncate">{number}</span>
            </div>
            <button
              type="button"
              onClick={() => onCopy(number)}
              className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[13px] font-bold transition-opacity hover:opacity-90"
              style={{ background: theme.copyBg, color: theme.copyInk }}
            >
              <Copy className="size-4" />
              {t("Copy")}
            </button>
          </div>
        </div>

        {/* Payment window */}
        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: theme.tint }}
        >
          <Clock3 className="size-5 shrink-0" style={{ color: theme.accentInk }} />
          <span
            className="font-mono text-[15px] font-extrabold tabular-nums"
            style={{ color: theme.accentInk }}
          >
            {timer}
          </span>
          <span className="text-[12px] leading-tight text-[#5f5f5f]">
            {t("Payment window expires in")}
          </span>
        </div>

        <div
          className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5"
          style={{ background: theme.infoBg, borderColor: theme.infoBorder }}
        >
          <Info className="mt-0.5 size-4 shrink-0" style={{ color: "#b58b00" }} />
          <p className="text-[12px] leading-snug" style={{ color: theme.infoInk }}>
            {t("Make sure to send exactly {amount} FCFA from your {method} account.", {
              amount: amountOnly,
              method: methodName,
            })}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-auto grid grid-cols-[auto_1fr] gap-3 pt-6">
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-[#d8d8d8] bg-white px-5 text-[15px] font-semibold text-[#444444] transition-colors hover:bg-[#f6f6f6]"
          >
            <ArrowLeft className="size-4" />
            {t("Back")}
          </button>
          <button
            type="button"
            onClick={onPaid}
            className="h-12 rounded-xl text-[15px] font-bold transition-opacity hover:opacity-90"
            style={{ background: theme.ctaBg, color: theme.ctaInk }}
          >
            {t("I have paid")}
          </button>
        </div>
      </div>
    </div>
  );
}
