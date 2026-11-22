import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";

const TICKER_IMAGE =
  "https://media.base44.com/images/public/6ae08bf7746b2c0f5210b4fc/cfbda0ad9_generated_42a697f4.jpg";
export const TICKET_IMAGE =
  "https://media.base44.com/images/public/6ae08bf7746b2c0f5210b4fc/14f51b182_generated_4dd0861a.jpg";

/** Dark exchange-terminal auth layout: ticker strip, wordmark header, ticket panel. */
export function AuthTerminalShell({ children }: { children: ReactNode }) {
  return (
    <div className="term-root flex min-h-dvh w-full justify-center">
      <div className="flex w-full max-w-[420px] flex-col border-x border-[#1d2618]">
        <div className="term-tick">
          <img src={TICKER_IMAGE} alt="" />
          <div className="term-tick-run term-mono">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i}>JumboCM Invest ▲</span>
            ))}
          </div>
        </div>

        <header className="term-hdr">
          <Link to="/" aria-label="JumboCM home" className="term-logo">
            <span className="term-mark">↗</span>
            <span>
              JumboCM <strong>Invest</strong>
            </span>
          </Link>
          <div className="term-hr">
            <span className="term-dot" />
            <LanguageToggle variant="terminal" />
          </div>
        </header>

        <main className="term-sec flex-1">{children}</main>

        <footer className="term-ft term-mono">
          <ShieldCheck className="h-[13px] w-[13px] text-[#C6FF3D]" strokeWidth={2} />
          256-bit encrypted · JumboCM
        </footer>
      </div>
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | null;
  rowClassName?: string;
};

/** Ticket row: monospace lime label over a borderless input; passwords get a show/hide toggle. */
export function TerminalField({
  label,
  error,
  rowClassName = "",
  type = "text",
  id,
  ...rest
}: FieldProps) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div className={`term-row ${rowClassName}`}>
      <label className="term-mono" htmlFor={id}>
        {label}
      </label>
      <div className={isPw ? "term-pwrow" : undefined}>
        <input id={id} type={isPw && show ? "text" : type} {...rest} />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="term-eye"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="term-err">{error}</p>}
    </div>
  );
}
