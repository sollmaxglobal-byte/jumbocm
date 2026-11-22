import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { AuthTerminalShell, TerminalField } from "@/components/AuthTerminal";

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
      const msg =
        err instanceof z.ZodError
          ? (err.issues[0]?.message ?? t("Enter a valid email and password."))
          : ((err as { message?: string }).message ?? t("Unable to sign in. Please try again."));
      const normalized = msg.toLowerCase();
      const friendly = normalized.includes("invalid login credentials")
        ? t("Email or password is incorrect. Check both fields and try again.")
        : normalized.includes("email not confirmed")
          ? t("Please confirm your email address before signing in.")
          : normalized.includes("rate limit")
            ? t("Too many attempts. Please wait a moment and try again.")
            : normalized.includes("missing supabase")
              ? t("Sign-in is temporarily unavailable. Please try again shortly.")
              : msg;
      toast.error(friendly);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthTerminalShell>
      <span className="auth-eyebrow">{t("Secure sign in")}</span>
      <h1 className="auth-title">{t("auth.welcomeBack")}</h1>
      <p className="auth-sub">{t("auth.signInSub")}</p>

      <form onSubmit={onSubmit} className="auth-form">
        <TerminalField
          id="email"
          name="email"
          type="email"
          label={t("auth.email")}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TerminalField
          id="password"
          name="password"
          type="password"
          label={t("auth.password")}
          required
          autoComplete="current-password"
          placeholder="••••••••"
        />
        <div className="auth-row">
          <Link to="/forgot-password" className="auth-link">
            {t("auth.forgot")}
          </Link>
        </div>
        <button type="submit" disabled={busy} className="auth-submit">
          <span>{busy ? t("common.pleaseWait") : t("auth.signIn")}</span>
          {busy ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={3} />
          )}
        </button>
      </form>

      <div className="auth-alt">
        {t("auth.noAccount")} <Link to="/register">{t("auth.registerLink")}</Link>
      </div>
    </AuthTerminalShell>
  );
}
