import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/hooks/useI18n";
import { AuthTerminalShell, TerminalField, TICKET_IMAGE } from "@/components/AuthTerminal";

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
      <span className="term-badge term-mono">Account recovery</span>
      <h1 className="term-title">{t("auth.forgotTitle")}</h1>
      <p className="term-sub">{t("auth.forgotSub")}</p>

      {sent ? (
        <div className="term-ticket">
          <p className="term-note term-mono">{t("auth.resetSentBody")}</p>
        </div>
      ) : (
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
            <button type="submit" disabled={busy} className="term-sbtn">
              <span>{busy ? t("auth.sending") : t("auth.sendReset")}</span>
              {busy ? (
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
              ) : (
                <ArrowRight className="h-[18px] w-[18px]" strokeWidth={3} />
              )}
            </button>
          </div>
        </form>
      )}

      <div className="term-alt">
        <Link to="/login">
          <ArrowLeft className="mr-1 inline h-3 w-3 align-[-2px]" />
          {t("auth.backToSignIn")}
        </Link>
      </div>
    </AuthTerminalShell>
  );
}
