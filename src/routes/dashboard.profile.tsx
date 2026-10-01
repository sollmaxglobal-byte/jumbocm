import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Copy,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Plus,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  WalletCards,
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
      { title: "Account & profile — JumboCM" },
      { name: "description", content: "Manage your JumboCM profile, payout methods and account security." },
      { property: "og:title", content: "Account & profile — JumboCM" },
      { property: "og:description", content: "Manage your JumboCM profile and account preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type Profile = { full_name: string | null; phone: string | null; kyc_status: string; referral_code: string | null };
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
  crypto: "Crypto wallet",
};

function initials(name?: string | null, email?: string) {
  return (name?.trim() || email || "J")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SectionTitle({ icon: Icon, children }: { icon: typeof UserRound; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1 text-xs font-bold uppercase text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      {children}
    </div>
  );
}

function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [accountBusy, setAccountBusy] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name,phone,kyc_status,referral_code")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile));
    void supabase
      .from("payout_accounts")
      .select("id,method,account_name,account_number,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => setAccounts((data as PayoutAccount[]) ?? []));
  }, [user]);

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setAccountBusy(true);
    const form = event.currentTarget;
    const values = new FormData(form);
    const { data, error } = await supabase
      .from("payout_accounts")
      .insert({
        user_id: user.id,
        method: String(values.get("payout_method")),
        account_name: String(values.get("payout_name")),
        account_number: String(values.get("payout_number")),
        is_default: accounts.length === 0,
      })
      .select("id,method,account_name,account_number,is_default")
      .single();
    setAccountBusy(false);
    if (error) return toast.error(error.message);
    setAccounts((current) => [...current, data as PayoutAccount]);
    form.reset();
    setShowAccountForm(false);
    toast.success("Payout account saved");
  }

  async function removeAccount(id: string) {
    const { error } = await supabase.from("payout_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAccounts((current) => current.filter((account) => account.id !== id));
    toast.success("Payout account removed");
  }

  async function makeDefault(id: string) {
    if (!user) return;
    const { error } = await supabase.from("payout_accounts").update({ is_default: false }).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    const { error: defaultError } = await supabase.from("payout_accounts").update({ is_default: true }).eq("id", id);
    if (defaultError) return toast.error(defaultError.message);
    setAccounts((current) => current.map((account) => ({ ...account, is_default: account.id === id })).sort((a, b) => Number(b.is_default) - Number(a.is_default)));
    toast.success("Default payout account updated");
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordBusy(true);
    const form = event.currentTarget;
    try {
      const value = z.object({ password: z.string().min(8, "Use at least 8 characters").max(72) }).parse({ password: new FormData(form).get("password") });
      const { error } = await supabase.auth.updateUser({ password: value.password });
      if (error) throw error;
      form.reset();
      setShowPassword(false);
      toast.success("Password updated");
    } catch (error) {
      toast.error(error instanceof z.ZodError ? error.issues[0].message : (error as Error).message);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function sendPinReset() {
    if (!user?.email) return toast.error("No email address is associated with this account");
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-pin?kind=transfer` });
    if (error) return toast.error("We could not send the reset link. Please try again.");
    toast.success("A transfer PIN reset link was sent to your email");
  }

  const referralLink = profile?.referral_code ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${profile.referral_code}` : "";
  const copyReferral = () => {
    if (!referralLink) return;
    void navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  };
  const shareReferral = async () => {
    if (!referralLink) return;
    if (navigator.share) await navigator.share({ title: "JumboCM", text: "Join me on JumboCM", url: referralLink }).catch(() => undefined);
    else copyReferral();
  };

  const verification = {
    not_submitted: { label: "Not verified", className: "bg-muted text-muted-foreground" },
    pending: { label: "Review pending", className: "bg-warning/15 text-warning" },
    verified: { label: "Verified", className: "bg-success/15 text-success" },
    rejected: { label: "Needs attention", className: "bg-destructive/15 text-destructive" },
  }[profile?.kyc_status ?? "not_submitted"] ?? { label: "Not verified", className: "bg-muted text-muted-foreground" };

  return (
    <div className="profile-native -mx-3 -my-4 min-h-screen bg-background pb-32 sm:-mx-4 md:-my-6 md:pb-10">
      <div className="mx-auto max-w-2xl">
        <header className="border-b border-border bg-card px-4 pb-5 pt-6">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Account</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Profile & settings</h1>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground shadow-gold">
              {initials(profile?.full_name, user?.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-foreground">{profile?.full_name || "JumboCM member"}</p>
              <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
              <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${verification.className}`}>
                <BadgeCheck className="h-3 w-3" /> {verification.label}
              </span>
            </div>
            <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
          </motion.div>
        </header>

        <div className="space-y-6 px-4 py-5">
          <section>
            <SectionTitle icon={UserRound}>Personal details</SectionTitle>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b border-border p-3.5">
                <Mail className="h-5 w-5 text-primary" />
                <div className="min-w-0"><p className="text-xs text-muted-foreground">Email address</p><p className="truncate text-sm font-semibold text-foreground">{user?.email ?? "—"}</p></div>
              </div>
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3.5">
                <Phone className="h-5 w-5 text-primary" />
                <div className="min-w-0"><p className="text-xs text-muted-foreground">Phone number</p><p className="truncate text-sm font-semibold text-foreground">{profile?.phone ?? "Not added"}</p></div>
              </div>
            </div>
          </section>

          <section>
            <SectionTitle icon={WalletCards}>Payout methods</SectionTitle>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {accounts.map((account, index) => (
                <motion.div key={account.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3.5 ${index < accounts.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary"><WalletCards className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-semibold">{account.account_name}</p>{account.is_default && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">Default</span>}</div>
                    <p className="truncate text-xs text-muted-foreground">{METHOD_LABEL[account.method]} · {account.account_number}</p>
                  </div>
                  <div className="flex shrink-0">
                    {!account.is_default && <Button size="icon" variant="ghost" aria-label="Make default" onClick={() => void makeDefault(account.id)}><Star className="h-4 w-4" /></Button>}
                    <Button size="icon" variant="ghost" aria-label="Remove account" className="text-destructive" onClick={() => void removeAccount(account.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </motion.div>
              ))}
              {!accounts.length && !showAccountForm && <p className="px-4 pt-4 text-sm text-muted-foreground">No payout method saved yet.</p>}
              <AnimatePresence initial={false}>
                {showAccountForm && (
                  <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={saveAccount} className="space-y-3 overflow-hidden border-t border-border p-4">
                    <select name="payout_method" required className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground">
                      <option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="crypto">Crypto wallet</option>
                    </select>
                    <Input name="payout_name" placeholder="Account name" required maxLength={120} className="h-11" />
                    <Input name="payout_number" placeholder="Account or wallet number" required maxLength={120} className="h-11" />
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <Button type="button" size="icon" variant="outline" aria-label="Cancel" onClick={() => setShowAccountForm(false)}><X /></Button>
                      <Button type="submit" disabled={accountBusy}>{accountBusy ? "Saving…" : "Save payout method"}</Button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
              {!showAccountForm && <Button variant="ghost" className="h-12 w-full justify-between rounded-none border-t border-border px-4 text-primary" onClick={() => setShowAccountForm(true)}><span className="flex items-center gap-2"><Plus />{accounts.length ? "Add another account" : "Add payout account"}</span><ChevronRight /></Button>}
            </div>
          </section>

          <section>
            <SectionTitle icon={Share2}>Invite & earn</SectionTitle>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-4">
              <div className="min-w-0"><p className="text-xs text-muted-foreground">Your referral code</p><p className="truncate font-mono text-base font-bold text-primary">{profile?.referral_code ?? "Not available"}</p></div>
              <div className="flex gap-1"><Button size="icon" variant="outline" aria-label="Copy referral link" onClick={copyReferral}><Copy /></Button><Button size="icon" aria-label="Share referral link" onClick={() => void shareReferral()}><Share2 /></Button></div>
            </div>
          </section>

          <section>
            <SectionTitle icon={ShieldCheck}>Security</SectionTitle>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Button variant="ghost" className="h-auto w-full justify-between rounded-none border-b border-border p-4" onClick={sendPinReset}><span className="flex items-center gap-3"><KeyRound className="text-primary" /><span className="text-left"><span className="block text-sm font-semibold">Transfer PIN</span><span className="block text-xs font-normal text-muted-foreground">Send a secure reset link</span></span></span><ChevronRight /></Button>
              <Button variant="ghost" className="h-auto w-full justify-between rounded-none p-4" onClick={() => setShowPassword((value) => !value)}><span className="flex items-center gap-3"><ShieldCheck className="text-primary" /><span className="text-left"><span className="block text-sm font-semibold">Password</span><span className="block text-xs font-normal text-muted-foreground">Change your sign-in password</span></span></span><ChevronRight /></Button>
              <AnimatePresence initial={false}>{showPassword && <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={changePassword} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 overflow-hidden border-t border-border p-4"><Label htmlFor="new-password" className="sr-only">New password</Label><Input id="new-password" name="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" placeholder="New password" /><Button type="submit" disabled={passwordBusy}>{passwordBusy ? "Saving…" : "Update"}</Button></motion.form>}</AnimatePresence>
            </div>
          </section>

          <section>
            <SectionTitle icon={Bell}>Notifications</SectionTitle>
            <div className="overflow-hidden rounded-xl border border-border bg-card [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none"><PushToggle /></div>
          </section>

          <Button variant="outline" className="h-12 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={async () => { await signOut(); navigate({ to: "/" }); }}><LogOut /> Sign out</Button>
          <p className="text-center text-[11px] text-muted-foreground">JumboCM · Secure account access</p>
        </div>
      </div>
    </div>
  );
}