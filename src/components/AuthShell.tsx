import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BrandLogo } from "@/components/BrandLogo";

export function AuthShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={`${compact ? "h-dvh overflow-hidden" : "min-h-screen"} bg-auth-surface`}>
      <div className={`mx-auto grid ${compact ? "h-dvh" : "min-h-screen"} max-w-7xl lg:grid-cols-[1fr_1fr]`}>
        {/* Left — charcoal branding panel, minimal */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-auth-panel px-12 py-10 lg:flex">
          <BrandLogo className="relative h-11 text-auth-foreground" />
          <p className="relative max-w-sm text-2xl font-semibold leading-snug text-auth-foreground">
            {t("auth.heroSub")}
          </p>
        </aside>

        {/* Right — clean form panel */}
        <main className={`flex ${compact ? "h-dvh overflow-hidden" : "min-h-screen"} flex-col bg-auth-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-10 lg:justify-center lg:px-16`}>
          <div className={`mx-auto flex w-full max-w-md flex-col ${compact ? "h-full" : ""}`}>
            <header className={`${compact ? "mb-4" : "mb-8 lg:mb-10"} flex items-center justify-between`}>
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
