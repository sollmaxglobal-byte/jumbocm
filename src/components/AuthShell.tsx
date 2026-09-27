import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BrandLogo } from "@/components/BrandLogo";

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden bg-primary px-12 py-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <BrandLogo className="h-11 text-primary-foreground" />
          <div className="max-w-lg">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/65">
              Private wealth, made clear <ArrowUpRight className="h-4 w-4" />
            </span>
            <h2 className="mt-6 max-w-md font-display text-6xl leading-[0.98]">Your money. One clear view.</h2>
            <p className="mt-6 max-w-sm text-base leading-7 text-primary-foreground/70">{t("auth.heroSub")}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-primary-foreground/60">
            <ShieldCheck className="h-4 w-4" /> Secure access to your JumboCM account
          </div>
        </aside>

        <main className="flex min-h-screen flex-col px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-10 lg:justify-center lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <header className="mb-10 flex items-center justify-between lg:mb-12">
              <Link to="/" className="inline-flex items-center" aria-label="JumboCM home">
                <BrandLogo className="h-10" />
              </Link>
              <LanguageToggle />
            </header>
            <section>{children}</section>
            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" /> Encrypted and protected
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
