import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  Wallet,
  Plus,
  Trash2,
  BadgeCheck,
  Star,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PushToggle } from "@/components/PushToggle";

export const Route = createFileRoute("/dashboard/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — JumboCM" },
      { name: "description", content: "Manage your JumboCM identity, payout accounts and security." },
      { property: "og:title", content: "Your profile — JumboCM" },
      { property: "og:description", content: "Manage your JumboCM account settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const GOLD = "#f6c85a";

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

const METHOD_LABEL: Record<PayoutAccount["method"], string> = {
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
  crypto: "Crypto",
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

function Panel({
  icon: Icon,
  title,
  subtitle,
  children,
  action,
}: {
  icon: typeof Wallet;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#26262d] bg-[#141418] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{ background: "rgba(246,200,90,0.12)", color: GOLD }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-[#f8f7f2]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[#8f8f98]">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

function ProfilePage() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [accountBusy, setAccountBusy] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
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
      .order("is_default", { ascending: false })
      .then(({ data }) => setAccounts((data as PayoutAccount[]) ?? []));
  }, [user]);

  async function saveAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    setAccountBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
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
    setAccounts((prev) => [...prev, data as PayoutAccount]);
    form.reset();
    setShowAccountForm(false);
    toast.success("Payout account saved");
  }

  async function removeAccount(id: string) {
    const { error } = await supabase.from("payout_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Payout account removed");
  }

  async function makeDefault(id: string) {
    if (!user) return;
    const { error } = await supabase
      .from("payout_accounts")
      .update({ is_default: false })
      .eq("user_id", user.id);
    if (error) return toast.error(error.message);
    const { error: setError } = await supabase
      .from("payout_accounts")
      .update({ is_default: true })
      .eq("id", id);
    if (setError) return toast.error(setError.message);
    setAccounts((prev) =>
      prev
        .map((a) => ({ ...a, is_default: a.id === id }))
        .sort((a, b) => Number(b.is_default) - Number(a.is_default)),
    );
    toast.success("Default payout account updated");
  }

  const referralLink = profile?.referral_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${profile.referral_code}`
    : "";

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const v = z
        .object({ password: z.string().min(8, "Min 8 characters").max(72) })
        .parse({ password: fd.get("password") });
      const { error } = await supabase.auth.updateUser({ password: v.password });
      if (error) throw error;
      toast.success("Password updated");
      form.reset();
    } catch (err) {
      toast.error(err instanceof z.ZodError ? err.issues[0].message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendPinReset() {
    if (!user?.email) return toast.error("No email address is associated with this account");
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-pin?kind=transfer`,
    });
    if (error) return toast.error("We could not send the reset link. Please try again.");
    toast.success("A transfer PIN reset link was sent to your email");
  }

  function copyReferral() {
    navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  }

  async function shareReferral() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "JumboCM", text: "Join me on JumboCM", url: referralLink });
      } catch {
        /* ignore */
      }
    } else {
      copyReferral();
    }
  }

  const kycMap: Record<string, { label: string; cls: string }> = {
    not_submitted: { label: "Unverified", cls: "bg-white/10 text-[#c8c8d0]" },
    pending: { label: "Pending review", cls: "bg-[#f6c85a]/15 text-[#f6c85a]" },
    verified: { label: "Verified", cls: "bg-green-500/15 text-green-400" },
    rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-400" },
  };
  const kyc = kycMap[profile?.kyc_status ?? "not_submitted"] ?? kycMap.not_submitted;

  return (
    <div className="-mx-3 -my-4 min-h-screen bg-[#0c0d12] px-4 pb-32 pt-5 text-[#f8f7f2] sm:-mx-4 md:-my-6 md:px-6 md:pb-10">
      <div className="mx-auto max-w-2xl space-y-3">
        {/* Identity hero */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-[#2a2a30] bg-[#141418] p-5"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl"
            style={{ background: "rgba(246,200,90,0.16)" }}
          />
          <div className="relative flex items-center gap-4">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-black text-[#101014] ring-2 ring-[#f6c85a]/30"
              style={{ background: GOLD }}
            >
              {initials(profile?.full_name, user?.email)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight">
                {profile?.full_name ?? "Member"}
              </h1>
              <p className="truncate text-xs text-[#8f8f98]">{user?.email}</p>
              <span
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${kyc.cls}`}
              >
                <BadgeCheck className="h-3 w-3" />
                {kyc.label}
              </span>
            </div>
          </div>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#26262d] bg-[#0f1014] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8f8f98]">
                <Mail className="h-3 w-3" style={{ color: GOLD }} /> Email
              </div>
              <div className="mt-1 truncate text-xs font-semibold">{user?.email ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-[#26262d] bg-[#0f1014] p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8f8f98]">
                <Phone className="h-3 w-3" style={{ color: GOLD }} /> Phone
              </div>
              <div className="mt-1 truncate text-xs font-semibold">{profile?.phone ?? "—"}</div>
            </div>
          </div>
        </motion.section>

        <Panel
          icon={ShieldCheck}
          title="Identity verification"
          subtitle="Verify your identity to unlock higher withdrawal limits. Contact support to submit your documents."
        />

        {/* Referral */}
        <Panel icon={Share2} title="Refer and earn" subtitle="Earn rewards on each verified signup.">
          <div className="flex items-center gap-2 rounded-xl border border-[#26262d] bg-[#0f1014] p-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-[#8f8f98]">Your code</div>
              <div className="truncate font-mono text-sm font-bold" style={{ color: GOLD }}>
                {profile?.referral_code ?? "—"}
              </div>
            </div>
            <button
              type="button"
              onClick={copyReferral}
              aria-label="Copy referral link"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#3c3c47] text-[#c8c8d0] transition-colors hover:text-[#f6c85a]"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={shareReferral}
              aria-label="Share referral link"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#101014]"
              style={{ background: GOLD }}
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </Panel>

        {/* Payout accounts */}
        <Panel
          icon={Wallet}
          title="Payout accounts"
          subtitle="Where your approved withdrawals are sent."
        >
          {accounts.length > 0 && (
            <div className="space-y-2">
              {accounts.map((account) => (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#26262d] bg-[#0f1014] p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold">{account.account_name}</span>
                      {account.is_default && (
                        <span
                          className="shrink-0 rounded-full px-2 py-px text-[9px] font-bold uppercase tracking-wide text-[#101014]"
                          style={{ background: GOLD }}
                        >
                          Default
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[#8f8f98]">
                      {METHOD_LABEL[account.method]} · {account.account_number}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!account.is_default && (
                      <button
                        type="button"
                        onClick={() => makeDefault(account.id)}
                        aria-label="Make default payout account"
                        className="grid h-8 w-8 place-items-center rounded-lg text-[#8f8f98] transition-colors hover:text-[#f6c85a]"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAccount(account.id)}
                      aria-label="Remove payout account"
                      className="grid h-8 w-8 place-items-center rounded-lg text-[#8f8f98] transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <AnimatePresence initial={false} mode="wait">
            {showAccountForm ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={saveAccount}
                className="mt-3 space-y-2.5 overflow-hidden"
              >
                <select
                  name="payout_method"
                  required
                  className="h-11 w-full rounded-xl border border-[#3c3c47] bg-[#0f1014] px-3 text-sm text-[#f8f7f2]"
                >
                  <option value="mobile_money">Mobile money</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="crypto">Crypto</option>
                </select>
                <Input
                  name="payout_name"
                  placeholder="Account name"
                  required
                  maxLength={120}
                  className="h-11 rounded-xl border-[#3c3c47] bg-[#0f1014] text-sm text-[#f8f7f2] placeholder:text-[#6b6b74]"
                />
                <Input
                  name="payout_number"
                  placeholder="Account number"
                  required
                  maxLength={120}
                  className="h-11 rounded-xl border-[#3c3c47] bg-[#0f1014] text-sm text-[#f8f7f2] placeholder:text-[#6b6b74]"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAccountForm(false)}
                    className="h-11 shrink-0 rounded-xl border-[#3c3c47] bg-transparent px-4 text-[#c8c8d0] hover:bg-white/5 hover:text-white"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    type="submit"
                    disabled={accountBusy}
                    className="h-11 flex-1 rounded-xl font-bold text-[#101014] hover:opacity-90"
                    style={{ background: GOLD }}
                  >
                    {accountBusy ? "Saving…" : "Save account"}
                  </Button>
                </div>
              </motion.form>
            ) : (
              <motion.button
                key="add"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                type="button"
                onClick={() => setShowAccountForm(true)}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-bold"
                style={{ borderColor: "rgba(246,200,90,0.5)", color: GOLD }}
              >
                <Plus className="h-4 w-4" />
                {accounts.length === 0 ? "Add payout account" : "Add another account"}
              </motion.button>
            )}
          </AnimatePresence>
        </Panel>

        <div className="[&_*]:!border-[#26262d]">
          <PushToggle />
        </div>

        {/* Transfer PIN */}
        <Panel
          icon={KeyRound}
          title="Transfer PIN"
          subtitle="We email you a secure link before your transfer PIN can be changed."
        >
          <Button
            type="button"
            variant="outline"
            onClick={sendPinReset}
            className="h-11 w-full rounded-xl border-[#3c3c47] bg-transparent text-sm font-semibold text-[#f6c85a] hover:bg-[#f6c85a]/10 hover:text-[#f6c85a]"
          >
            Reset transfer PIN
          </Button>
        </Panel>

        {/* Password */}
        <Panel icon={KeyRound} title="Change password" subtitle="Use at least 8 characters.">
          <form onSubmit={changePassword} className="space-y-2.5">
            <Label className="sr-only" htmlFor="password">
              New password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="New password"
              className="h-11 rounded-xl border-[#3c3c47] bg-[#0f1014] text-sm text-[#f8f7f2] placeholder:text-[#6b6b74]"
            />
            <Button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-xl font-bold text-[#101014] hover:opacity-90"
              style={{ background: GOLD }}
            >
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Panel>

        <Button
          variant="outline"
          onClick={async () => {
            await signOut();
            nav({ to: "/" });
          }}
          className="h-11 w-full rounded-xl border-red-500/40 bg-transparent text-sm font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}
