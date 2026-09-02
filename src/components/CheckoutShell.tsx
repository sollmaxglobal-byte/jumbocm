import type { ReactNode } from "react";

/** Full-page shell used by the standalone deposit checkout steps (outside the dashboard). */
export function CheckoutShell({
  step,
  total,
  title,
  subtitle,
  children,
}: {
  step: number;
  total: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          <img src="/jumbocm-logo.png" alt="JumboCM" className="h-9 w-auto object-contain" />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Secure checkout · {step}/{total}
            </div>
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-1 bg-primary transition-all"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full min-h-0 max-w-xl flex-1 flex-col justify-center gap-4 overflow-hidden px-4 pb-24 pt-4">
        <div>
          <h1 className="font-display text-2xl text-primary md:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
