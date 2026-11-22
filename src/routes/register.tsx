import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { sendEmail } from "@/lib/email-client";
import { registerAccount } from "@/lib/register.functions";
import { AuthTerminalShell, TerminalField, TICKET_IMAGE } from "@/components/AuthTerminal";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — JumboCM" },
      {
        name: "description",
        content: "Register a free JumboCM account in under a minute and start investing in XAF.",
      },
      { property: "og:title", content: "Create your account — JumboCM" },
      {
        property: "og:description",
        content: "Register a free JumboCM account in under a minute.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

const signupSchema = z.object({
  full_name: z.string().min(2, "Enter your full name").max(80),
  phone: z.string().min(7, "Enter a valid phone number").max(20),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function RegisterPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [refName, setRefName] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  useEffect(() => {
    let cancelled = false;
    const code = new URLSearchParams(window.location.search).get("ref")?.trim() ?? "";
    if (!code) return;

    setRefCode(code);
    supabase.rpc("referrer_name", { _code: code }).then(({ data, error }) => {
      if (cancelled || error) return;
      setRefName(typeof data === "string" && data.trim() ? data.trim() : null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pw !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const v = signupSchema.parse({
        full_name: fd.get("full_name"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        password: fd.get("password"),
      });
      // Account is created server-side (email auto-confirmed, no strong-password policy).
      await registerAccount({
        data: {
          full_name: v.full_name,
          phone: v.phone,
          email: v.email,
          password: v.password,
          referral_code: refCode,
        },
      });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      });
      if (signInError) throw signInError;
      sendEmail({ to: v.email, template_key: "welcome", variables: { name: v.full_name } });
      toast.success(t("auth.created"));
      nav({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const mismatch = confirm.length > 0 && pw !== confirm ? "Passwords do not match" : null;

  return (
    <AuthTerminalShell>
      {refName ? (
        <span className="term-badge term-mono block max-w-full truncate">
          <UserPlus className="mr-1 inline h-3 w-3 align-[-2px]" />
          {t("auth.invitedBy")} <strong className="uppercase">{refName}</strong>
        </span>
      ) : (
        <span className="term-badge term-mono">Open your account</span>
      )}
      <h1 className="term-title">Create your account</h1>
      <p className="term-sub">It takes less than a minute.</p>

      <form onSubmit={onSubmit} className="term-ticket">
        <img src={TICKET_IMAGE} alt="" />
        <div className="term-tin">
          <TerminalField
            rowClassName="term-r1"
            id="full_name"
            name="full_name"
            label={t("auth.fullName")}
            required
            maxLength={80}
            autoComplete="name"
            placeholder="Jane Doe"
          />
          <TerminalField
            rowClassName="term-r2"
            id="phone"
            name="phone"
            type="tel"
            label={t("auth.phone")}
            required
            autoComplete="tel"
            placeholder="+237 6XX XXX XXX"
          />
          <TerminalField
            rowClassName="term-r3"
            id="email"
            name="email"
            type="email"
            label={t("auth.email")}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
          <div className="term-two">
            <TerminalField
              rowClassName="term-r4"
              id="password"
              name="password"
              type="password"
              label={t("auth.password")}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <TerminalField
              rowClassName="term-r5"
              id="confirm_password"
              name="confirm_password"
              type="password"
              label="Confirm"
              required
              autoComplete="new-password"
              placeholder="Repeat"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={mismatch}
            />
          </div>
          <p className="term-note term-mono">
            By continuing you agree to the JumboCM terms and privacy policy.
          </p>
          <button type="submit" disabled={busy || !!mismatch} className="term-sbtn">
            <span>{busy ? t("common.pleaseWait") : t("auth.signUp")}</span>
            {busy ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={3} />
            )}
          </button>
        </div>
      </form>

      <div className="term-alt">
        {t("auth.haveAccount")}{" "}
        <Link to="/login">{t("auth.loginLink")}</Link>
      </div>
    </AuthTerminalShell>
  );
}
