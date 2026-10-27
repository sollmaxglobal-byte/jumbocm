import { motion } from "framer-motion";
import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"];

type NumericKeypadProps = {
  /** Called with the digit or "." the customer tapped. */
  onKey: (key: string) => void;
  /** Called when the backspace key is tapped. */
  onDelete: () => void;
  accent?: string;
  ink?: string;
};

/**
 * On-screen numeric keypad used instead of the device keyboard.
 * It renders buttons only — the amount is held by the parent — so no
 * software keyboard is ever opened for the amount field.
 */
export function NumericKeypad({
  onKey,
  onDelete,
  accent = "#f6c85a",
  ink = "#141418",
}: NumericKeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <motion.button
          key={key}
          whileTap={{ scale: 0.94 }}
          type="button"
          onClick={() => onKey(key)}
          aria-label={key === "." ? "Decimal point" : `Digit ${key}`}
          className="h-12 rounded-xl text-2xl font-extrabold leading-none"
          style={{ background: accent, color: ink }}
        >
          {key === "." ? "•" : key}
        </motion.button>
      ))}
      <motion.button
        whileTap={{ scale: 0.94 }}
        type="button"
        onClick={onDelete}
        aria-label="Delete last digit"
        className="flex h-12 items-center justify-center rounded-xl"
        style={{ background: accent, color: ink }}
      >
        <Delete className="size-6" />
      </motion.button>
    </div>
  );
}
