import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Loader2, Lock, Mail, Phone, User, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { sendEmail } from "@/lib/email-client";
import { AuthShell, AuthField } from "@/components/AuthShell";

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
      const { data, error } = await supabase.auth.signUp({
        email: v.email,
        password: v.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: v.full_name, phone: v.phone, referral_code: refCode },
        },
      });
      if (error) throw error;
      sendEmail({ to: v.email, template_key: "welcome", variables: { name: v.full_name } });
      toast.success(t("auth.created"));
      // If session is returned (email confirmation disabled), redirect immediately
      if (data.session) {
        nav({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const mismatch = confirm.length > 0 && pw !== confirm ? "Passwords do not match" : null;

  return (
    <AuthShell compact>
      <div className="mb-4">
        {refName ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] text-success">
            <UserPlus className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t("auth.invitedBy")} <strong className="uppercase">{refName}</strong></span>
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-auth-accent/30 bg-auth-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-auth-accent">
            Open your account
          </span>
        )}
        <h1 className="mt-3 text-2xl font-semibold leading-tight">Create your account</h1>
        <p className="mt-1 text-xs text-auth-muted">It takes less than a minute.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-2.5">
        <AuthField dense id="full_name" name="full_name" label={t("auth.fullName")} icon={User} required maxLength={80} autoComplete="name" placeholder="Jane Doe" />
        <AuthField dense id="phone" name="phone" type="tel" label={t("auth.phone")} icon={Phone} required autoComplete="tel" placeholder="+237 6XX XXX XXX" />
        <AuthField dense id="email" name="email" type="email" label={t("auth.email")} icon={Mail} required autoComplete="email" placeholder="you@example.com" />
        <div className="grid grid-cols-2 gap-2.5">
          <AuthField dense id="password" name="password" type="password" label={t("auth.password")} icon={Lock} required minLength={6} autoComplete="new-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <AuthField dense id="confirm_password" name="confirm_password" type="password" label="Confirm" icon={Lock} required autoComplete="new-password" placeholder="Repeat" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch} />
        </div>
        <button
          type="submit"
          disabled={busy || !!mismatch}
          className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-auth-accent font-semibold text-auth-accent-foreground shadow-lg shadow-auth-accent/20 transition hover:bg-auth-accent/90 active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.pleaseWait")}</> : <>{t("auth.signUp")} <ArrowRight className="h-4 w-4" /></>}
        </button>
        <p className="text-center text-[10px] leading-snug text-auth-muted">
          By continuing you agree to the JumboCM terms and privacy policy.
        </p>
      </form>

      <div className="mt-3 text-center text-sm text-auth-muted">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-semibold text-auth-accent">
          {t("auth.loginLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
