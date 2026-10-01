import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { sendEmail } from "@/lib/email-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/AuthShell";

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
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  password: z.string().min(1, "Enter a password").max(72),
});

function RegisterPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [refName, setRefName] = useState<string | null>(null);

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
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const v = signupSchema.parse({
        full_name: fd.get("full_name"),
        phone: fd.get("phone"),
        email: fd.get("email"),
        password: fd.get("password"),
      });
      const { error } = await supabase.auth.signUp({
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
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell compact>
      {refName && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2">
          <UserPlus className="mt-0.5 h-4 w-4 text-success" />
          <p className="truncate text-xs">{t("auth.invitedBy")} <strong className="font-semibold uppercase">{refName}</strong></p>
        </div>
      )}

      <div className="mb-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-auth-accent">Get started</p>
        <h1 className="font-sans text-2xl font-semibold leading-tight text-foreground">Create your account.</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <div>
          <Label className="sr-only" htmlFor="full_name">{t("auth.fullName")}</Label>
          <Input className="h-10 rounded-xl bg-card px-3 text-sm" id="full_name" name="full_name" required maxLength={80} placeholder="Full name" />
        </div>
        <div>
          <Label className="sr-only" htmlFor="phone">{t("auth.phone")}</Label>
          <Input className="h-10 rounded-xl bg-card px-3 text-sm" id="phone" name="phone" type="tel" required placeholder="Phone · +237 6XX XXX XXX" />
        </div>
        <div>
          <Label className="sr-only" htmlFor="email">{t("auth.email")}</Label>
          <Input className="h-10 rounded-xl bg-card px-3 text-sm" id="email" name="email" type="email" required autoComplete="email" placeholder="Email address" />
        </div>
        <div>
          <Label className="sr-only" htmlFor="password">{t("auth.password")}</Label>
          <Input
            className="h-10 rounded-xl bg-card px-3 text-sm"
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Password"
          />
        </div>
        {refCode && (
          <div>
            <Label htmlFor="ref">{t("auth.referralCode")}</Label>
            <Input id="ref" value={refCode} readOnly className="h-9 uppercase" />
          </div>
        )}
        <Button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-xl bg-auth-accent font-semibold text-auth-accent-foreground hover:bg-auth-accent/90"
        >
          {busy ? t("common.pleaseWait") : <>{t("auth.signUp")} <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </form>

      <div className="mt-2 text-center text-xs text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-medium text-auth-accent underline underline-offset-4">
          {t("auth.loginLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
