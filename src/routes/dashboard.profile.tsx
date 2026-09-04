import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  ShieldCheck,
  Copy,
  LogOut,
  KeyRound,
  Share2,
  CreditCard,
  Plus,
  Trash2,
  BadgeCheck,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PushToggle } from "@/components/PushToggle";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

type Profile = {
  full_name: string | null;
  phone: string | null;
  kyc_status: string;
  referral_code: string | null;
};

type PayoutAccount = {
  id: string;
  method: "mobile_money" | "bank_transfer" | "crypto";
  account_name: string;
  account_number: string;
  is_default: boolean;
};

function initials(name: string | null | undefined, email: string | undefined) {
  const source = name?.trim() || email || "J";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ProfilePage() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [accountBusy, setAccountBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name,phone,kyc_status,referral_code")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile));
    supabase
      .from("payout_accounts")
      .select("id,method,account_name,account_number,is_default")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setAccounts((data as PayoutAccount[]) ?? []));
  }, [user]);

  async function saveAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setAccountBusy(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      user_id: user.id,
      method: String(fd.get("payout_method")),
      account_name: String(fd.get("payout_name")),
      account_number: String(fd.get("payout_number")),
      is_default: accounts.length === 0,
    };
    const { data, error } = await supabase
      .from("payout_accounts")
      .insert(payload)
      .select("id,method,account_name,account_number,is_default")
      .single();
    setAccountBusy(false);
    if (error) return toast.error(error.message);
    setAccounts((prev) => [data as PayoutAccount, ...prev]);
    e.currentTarget.reset();
    toast.success("Payout account added");
  }

  async function removeAccount(id: string) {
    const { error } = await supabase.from("payout_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Payout account removed");
  }

  const referralLink = profile?.referral_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${profile.referral_code}`
    : "";

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const v = z
        .object({
          password: z.string().min(8, "Min 8 characters").max(72),
        })
        .parse({ password: fd.get("password") });
      const { error } = await supabase.auth.updateUser({ password: v.password });
      if (error) throw error;
      toast.success("Password updated");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error(err instanceof z.ZodError ? err.issues[0].message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendPinReset(kind: "withdrawal" | "transfer") {
    if (!user?.email) return toast.error("No email address is associated with this account");
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-pin?kind=${kind}`,
    });
    if (error) return toast.error("We could not send the reset link. Please try again.");
    toast.success(`A ${kind} PIN reset link was sent to your email`);
  }

  function copyReferral() {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  }
  async function shareReferral() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "JumboCM",
          text: "Join me on JumboCM",
          url: referralLink,
        });
      } catch {
        /* ignore */
      }
    } else {
      copyReferral();
    }
  }

  const kycMap: Record<string, { label: string; cls: string }> = {
    not_submitted: { label: "Not submitted", cls: "bg-muted text-foreground/70" },
    pending: { label: "Pending review", cls: "bg-warning/15 text-warning" },
    verified: { label: "Verified", cls: "bg-success/15 text-success" },
    rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
  };
  const kyc = kycMap[profile?.kyc_status ?? "not_submitted"];

  return (
    <div className="space-y-4">
      {/* Identity header */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="bg-[#14112B] p-5 pb-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#C9F158] font-display text-xl font-bold text-[#14112B]">
              {initials(profile?.full_name, user?.email)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl font-bold text-white">
                {profile?.full_name ?? "Member"}
              </h1>
              <p className="truncate text-xs text-white/60">{user?.email}</p>
              <span
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${kyc.cls}`}
              >
                <BadgeCheck className="h-3 w-3" />
                KYC · {kyc.label}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-border border-t border-border/40">
          <div className="flex items-center gap-2.5 p-3.5">
            <Mail className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Email
              </div>
              <div className="truncate text-sm font-medium">{user?.email ?? "—"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3.5">
            <Phone className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Phone
              </div>
              <div className="truncate text-sm font-medium">{profile?.phone ?? "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KYC */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="font-display text-base text-primary">Identity verification</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Verify your identity to unlock higher withdrawal limits. Contact support to submit
          your documents.
        </p>
      </section>

      {/* Referral */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-primary" />
          <span className="font-display text-base text-primary">Refer & earn</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Share your link — earn rewards on each verified signup.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary p-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase text-muted-foreground">Your code</div>
            <div className="truncate font-mono text-sm font-medium">
              {profile?.referral_code ?? "—"}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={copyReferral} aria-label="Copy referral link">
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={shareReferral}
            className="bg-primary text-primary-foreground hover:opacity-90"
            aria-label="Share referral link"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Payout accounts */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <span className="font-display text-base text-primary">Payout accounts</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Add an account where approved withdrawals should be sent.
        </p>
        <div className="mt-3 space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-secondary p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{account.account_name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {account.method.replace("_", " ")} · {account.account_number}
                  {account.is_default ? " · Default" : ""}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove payout account"
                onClick={() => removeAccount(account.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <form onSubmit={saveAccount} className="mt-4 grid gap-3 md:grid-cols-3">
          <select
            name="payout_method"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="mobile_money">Mobile money</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="crypto">Crypto</option>
          </select>
          <Input name="payout_name" placeholder="Account name" required maxLength={120} />
          <Input name="payout_number" placeholder="Account number" required maxLength={120} />
          <Button type="submit" disabled={accountBusy} className="md:col-span-3">
            <Plus className="mr-2 h-4 w-4" />
            {accountBusy ? "Adding…" : "Add payout account"}
          </Button>
        </form>
      </section>

      <PushToggle />

      {/* Security */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <span className="font-display text-base text-primary">Security PINs</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          We&apos;ll email you a secure link before either PIN can be changed.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button type="button" variant="outline" onClick={() => sendPinReset("withdrawal")}>
            Reset withdrawal PIN
          </Button>
          <Button type="button" variant="outline" onClick={() => sendPinReset("transfer")}>
            Reset transfer PIN
          </Button>
        </div>
      </section>

      {/* Change password */}
      <form onSubmit={changePassword} className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <span className="font-display text-base text-primary">Change password</span>
        </div>
        <div className="mt-3">
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
        <Button
          type="submit"
          disabled={busy}
          className="mt-3 w-full bg-primary text-primary-foreground hover:opacity-90"
        >
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>

      <Button
        variant="outline"
        onClick={async () => {
          await signOut();
          nav({ to: "/" });
        }}
        className="w-full border-destructive text-destructive hover:bg-destructive/10"
      >
        <LogOut className="mr-2 h-4 w-4" /> Sign out
      </Button>
    </div>
  );
}
