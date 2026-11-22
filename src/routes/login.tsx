import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { AuthTerminalShell, TerminalField, TICKET_IMAGE } from "@/components/AuthTerminal";

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
    <AuthTerminalShell>
      <span className="term-badge term-mono">Secure sign in</span>
      <h1 className="term-title">Welcome back</h1>
      <p className="term-sub">Sign in to manage your portfolio, deposits and payouts.</p>

      <form onSubmit={onSubmit} className="term-ticket">
        <img src={TICKET_IMAGE} alt="" />
        <div className="term-tin">
          <TerminalField
            rowClassName="term-r1"
            id="email"
            name="email"
            type="email"
            label={t("auth.email")}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
          <TerminalField
            rowClassName="term-r2"
            id="password"
            name="password"
            type="password"
            label={t("auth.password")}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <Link to="/forgot-password" className="term-fgt term-mono">
            {t("auth.forgot")}
          </Link>
          <button type="submit" disabled={busy} className="term-sbtn">
            <span>{busy ? t("common.pleaseWait") : t("auth.signIn")}</span>
            {busy ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={3} />
            )}
          </button>
        </div>
      </form>

      <div className="term-alt">
        {t("auth.noAccount")}{" "}
        <Link to="/register">{t("auth.registerLink")}</Link>
      </div>
    </AuthTerminalShell>
  );
}
