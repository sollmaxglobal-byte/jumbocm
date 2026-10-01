import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Set new password — JumboCM" }],
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

type LinkState = "checking" | "ready" | "invalid";

/**
 * Accepts every recovery link format Supabase can send:
 * - ?token_hash=...&type=recovery (custom email template pointing straight at this site)
 * - ?code=... (PKCE flow)
 * - #access_token=...&type=recovery (implicit flow, picked up automatically by supabase-js)
 */
async function establishRecoverySession(): Promise<boolean> {
  const url = new URL(window.location.href);
  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    window.history.replaceState(null, "", url.pathname);
    return !error;
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    window.history.replaceState(null, "", url.pathname);
    return !error;
  }
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

function ResetPasswordPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [linkState, setLinkState] = useState<LinkState>("checking");

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setLinkState("ready");
      }
    });
    establishRecoverySession().then((ok) => {
      if (active) setLinkState((s) => (s === "ready" || ok ? "ready" : "invalid"));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const v = schema.parse({
        password: fd.get("password"),
        confirm: fd.get("confirm"),
      });
      const { error } = await supabase.auth.updateUser({ password: v.password });
      if (error) throw error;
      toast.success("Password updated");
      nav({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center">
          <img src="/jumbocm-logo.png" alt="JumboCM" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="font-display text-3xl text-primary">Set a new password</h1>

        {linkState === "checking" && (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            Verifying your reset link…
          </p>
        )}

        {linkState === "invalid" && (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <p>This reset link is invalid or has expired.</p>
            <Link to="/forgot-password" className="mt-2 inline-block font-semibold text-primary">
              Request a new link
            </Link>
          </div>
        )}

        {linkState === "ready" && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a strong password you haven&apos;t used before.
            </p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-primary text-primary-foreground hover:opacity-90"
              >
                {busy ? "Saving…" : "Update password"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
