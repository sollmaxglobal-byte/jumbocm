import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";
import { AuthTerminalShell, TerminalField } from "@/components/AuthTerminal";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — JumboCM" },
      {
        name: "description",
        content: "Request a secure reset link to regain access to your JumboCM account.",
      },
      { property: "og:title", content: "Forgot password — JumboCM" },
      { property: "og:description", content: "Request a secure password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({ email: z.string().email() });

function ForgotPasswordPage() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const v = schema.parse({ email: fd.get("email") });
      const { error } = await supabase.auth.resetPasswordForEmail(v.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success(t("auth.resetSent"));
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthTerminalShell>
      <span className="auth-eyebrow">Account recovery</span>
      <h1 className="auth-title">{t("auth.forgotTitle")}</h1>
      <p className="auth-sub">{t("auth.forgotSub")}</p>

      {sent ? (
        <p className="auth-sent">{t("auth.resetSentBody")}</p>
      ) : (
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
          <button type="submit" disabled={busy} className="auth-submit">
            <span>{busy ? t("auth.sending") : t("auth.sendReset")}</span>
            {busy ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={3} />
            )}
          </button>
        </form>
      )}

      <div className="auth-alt">
        <Link to="/login">
          <ArrowLeft className="mr-1 inline h-3 w-3 align-[-2px]" />
          {t("auth.backToSignIn")}
        </Link>
      </div>
    </AuthTerminalShell>
  );
}
