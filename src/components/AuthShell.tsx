import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, ShieldCheck, type LucideIcon } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BrandLogo } from "@/components/BrandLogo";

/** Full-screen dark/gold auth layout. `compact` locks it to one screen with no scrolling. */
export function AuthShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden ${compact ? "h-dvh" : "min-h-dvh"} bg-auth-panel text-auth-foreground`}
    >
      <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-auth-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-72 w-72 rounded-full bg-auth-accent/10 blur-3xl" />
      <div
        className={`relative mx-auto flex w-full max-w-md flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] ${compact ? "h-dvh" : "min-h-dvh"}`}
      >
        <header className="flex shrink-0 items-center justify-between">
          <Link to="/" aria-label="JumboCM home" className="inline-flex items-center">
            <BrandLogo className="h-8 text-auth-foreground" />
          </Link>
          <LanguageToggle />
        </header>
        <main className={`flex min-h-0 flex-1 flex-col ${compact ? "justify-center" : "justify-center py-8"}`}>
          {children}
        </main>
        <footer className="flex shrink-0 items-center justify-center gap-1.5 text-[11px] text-auth-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-auth-accent" /> 256-bit encrypted · JumboCM
        </footer>
      </div>
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: LucideIcon;
  error?: string | null;
  dense?: boolean;
};

/** Labelled input with icon; password fields get a show/hide toggle. */
export function AuthField({ label, icon: Icon, error, dense, type = "text", id, ...rest }: FieldProps) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-auth-muted">
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 rounded-xl border bg-auth-foreground/5 px-3.5 transition focus-within:border-auth-accent focus-within:bg-auth-foreground/10 ${error ? "border-destructive" : "border-auth-foreground/10"} ${dense ? "h-11" : "h-12"}`}
      >
        <Icon className="h-4 w-4 shrink-0 text-auth-muted" />
        <input
          id={id}
          type={isPw && show ? "text" : type}
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-auth-foreground outline-none placeholder:text-auth-muted/60"
          {...rest}
        />
        {isPw && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            className="shrink-0 text-auth-muted hover:text-auth-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
