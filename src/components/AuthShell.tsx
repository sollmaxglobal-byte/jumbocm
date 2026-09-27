import { Link } from "@tanstack/react-router";
import { ShieldCheck, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BrandLogo } from "@/components/BrandLogo";

export function AuthShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`${compact ? "h-dvh overflow-hidden" : "min-h-screen"} bg-auth-surface`}>
      <div className={`mx-auto grid ${compact ? "h-dvh" : "min-h-screen"} max-w-7xl lg:grid-cols-[1.05fr_0.95fr]`}>
        <aside className="relative hidden overflow-hidden bg-auth-panel px-12 py-10 text-auth-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="auth-grid absolute inset-0 opacity-30" />
          <BrandLogo className="relative h-11 text-auth-foreground" />
          <div className="max-w-lg">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-auth-muted">
              Intelligent portfolio access <Sparkles className="h-4 w-4 text-bot-accent" />
            </span>
            <h2 className="mt-6 max-w-md font-sans text-6xl font-semibold leading-[1.02]">Move with the market.</h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-auth-muted">{t("auth.heroSub")}</p>
          </div>
          <div className="relative flex items-center gap-2 text-xs text-auth-muted">
            <ShieldCheck className="h-4 w-4" /> Secure access to your JumboCM account
          </div>
        </aside>

        <main className={`flex ${compact ? "h-dvh overflow-hidden" : "min-h-screen"} flex-col bg-auth-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-10 lg:justify-center lg:px-16`}>
          <div className={`mx-auto flex w-full max-w-md flex-col ${compact ? "h-full" : ""}`}>
            <header className={`${compact ? "mb-3" : "mb-8 lg:mb-10"} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3`}>
              <Link to="/" className="inline-flex items-center" aria-label="JumboCM home">
                <BrandLogo className="h-9" />
              </Link>
              <LanguageToggle />
            </header>
            <section className={compact ? "min-h-0 flex-1" : ""}>{children}</section>
            <div className={`${compact ? "mt-2" : "mt-7"} flex items-center justify-center gap-2 text-[11px] text-muted-foreground`}>
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Encrypted and protected
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
