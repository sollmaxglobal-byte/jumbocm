import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Lock, Mail } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { AuthShell, AuthField } from "@/components/AuthShell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — JumboCM" },
      {
        name: "description",
        content: "Sign in to your JumboCM dashboard to track deposits, plans and payouts.",
      },
      { property: "og:title", content: "Sign in — JumboCM" },
      { property: "og:description", content: "Access your JumboCM account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function LoginPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const v = loginSchema.parse({ email: fd.get("email"), password: fd.get("password") });
      const { error } = await supabase.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      });
      if (error) throw error;
      toast.success(t("auth.welcomeToast"));
    } catch (err) {
      const msg = err instanceof z.ZodError
        ? err.issues[0]?.message ?? "Enter a valid email and password."
        : (err as { message?: string }).message ?? "Unable to sign in. Please try again.";
      const normalized = msg.toLowerCase();
      const friendly = normalized.includes("invalid login credentials")
        ? "Email or password is incorrect. Check both fields and try again."
        : normalized.includes("email not confirmed")
          ? "Please confirm your email address before signing in."
          : normalized.includes("rate limit")
            ? "Too many attempts. Please wait a moment and try again."
            : normalized.includes("missing supabase")
              ? "Sign-in is temporarily unavailable. Please try again shortly."
              : msg;
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell compact>
      <div className="mb-7">
        <span className="inline-flex items-center rounded-full border border-auth-accent/30 bg-auth-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-auth-accent">
          Secure sign in
        </span>
        <h1 className="mt-4 text-3xl font-semibold leading-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-auth-muted">Sign in to manage your portfolio, deposits and payouts.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <AuthField id="email" name="email" type="email" label={t("auth.email")} icon={Mail} required autoComplete="email" placeholder="you@example.com" />
        <div>
          <AuthField id="password" name="password" type="password" label={t("auth.password")} icon={Lock} required autoComplete="current-password" placeholder="••••••••" />
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-xs font-medium text-auth-accent hover:underline">
              {t("auth.forgot")}
            </Link>
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-auth-accent font-semibold text-auth-accent-foreground shadow-lg shadow-auth-accent/20 transition hover:bg-auth-accent/90 active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.pleaseWait")}</> : <>{t("auth.signIn")} <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      <div className="mt-8 rounded-xl border border-auth-foreground/10 bg-auth-foreground/5 p-4 text-center text-sm text-auth-muted">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="font-semibold text-auth-accent">
          {t("auth.registerLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
