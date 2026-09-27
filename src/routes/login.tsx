import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/AuthShell";

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
    <AuthShell>
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Account access
        </p>
        <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
          {t("auth.welcomeBack")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter your details to continue securely.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input className="h-12 rounded-xl bg-card px-4" id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              {t("auth.forgot")}
            </Link>
          </div>
          <Input
            className="h-12 rounded-xl bg-card px-4"
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="mt-2 h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {busy ? t("common.pleaseWait") : t("auth.signIn")}
        </Button>
      </form>

      <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="font-medium text-primary underline underline-offset-4">
          {t("auth.registerLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
