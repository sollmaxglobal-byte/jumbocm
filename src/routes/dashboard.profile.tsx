import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bell,
  ChevronLeft,
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
import { useI18n } from "@/hooks/useI18n";
import { PushToggle } from "@/components/PushToggle";

export const Route = createFileRoute("/dashboard/profile")({
  head: () => ({
    meta: [
      { title: "Account & profile — JumboCM" },
      { name: "description", content: "Manage your JumboCM profile, payout methods and account security." },
      { property: "og:title", content: "Account & profile — JumboCM" },
      { property: "og:description", content: "Manage your JumboCM profile and account preferences." },
      { property: "og:type", content: "website" },
      { property: "twitter:card", content: "summary" },
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

const SECTIONS = [
  { id: "details", label: "Details" },
  { id: "payouts", label: "Payouts" },
  { id: "invite", label: "Invite" },
  { id: "security", label: "Security" },
  { id: "alerts", label: "Alerts" },
];

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#00FF88]/50";

function initials(name?: string | null, email?: string) {
  return (name?.trim() || email || "J")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Card({
  id,
  icon: Icon,
  title,
  action,
  children,
}: {
  id: string;
  icon: typeof UserRound;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-40 overflow-hidden rounded-2xl border border-white/5 bg-[#0F1012]">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00FF88]/10 text-[#00FF88]">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Icon className="h-4 w-4 shrink-0 text-white/40" />
      <div className="min-w-0">
        <p className="text-[11px] text-white/40">{label}</p>
        <p className="truncate text-sm font-medium text-white">{value}</p>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
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
    toast.success(t("Payout account saved"));
  }

  async function removeAccount(id: string) {
    const { error } = await supabase.from("payout_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAccounts((current) => current.filter((account) => account.id !== id));
    toast.success(t("Payout account removed"));
  }

  async function makeDefault(id: string) {
    if (!user) return;
    const { error } = await supabase.from("payout_accounts").update({ is_default: false }).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    const { error: defaultError } = await supabase.from("payout_accounts").update({ is_default: true }).eq("id", id);
    if (defaultError) return toast.error(defaultError.message);
    setAccounts((current) => current.map((account) => ({ ...account, is_default: account.id === id })).sort((a, b) => Number(b.is_default) - Number(a.is_default)));
    toast.success(t("Default payout account updated"));
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
      toast.success(t("Password updated"));
    } catch (error) {
      toast.error(error instanceof z.ZodError ? t(error.issues[0].message) : (error as Error).message);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function sendPinReset() {
    if (!user?.email) return toast.error(t("No email address is associated with this account"));
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/reset-pin?kind=transfer` });
    if (error) return toast.error(t("We could not send the reset link. Please try again."));
    toast.success(t("A transfer PIN reset link was sent to your email"));
  }

  const referralLink = profile?.referral_code ? `${typeof window !== "undefined" ? window.location.origin : ""}/register?ref=${profile.referral_code}` : "";
  const copyReferral = () => {
    if (!referralLink) return;
    void navigator.clipboard.writeText(referralLink);
    toast.success(t("Referral link copied"));
  };
  const shareReferral = async () => {
    if (!referralLink) return;
    if (navigator.share) await navigator.share({ title: "JumboCM", text: t("Join me on JumboCM"), url: referralLink }).catch(() => undefined);
    else copyReferral();
  };

  const verification = {
    not_submitted: { label: "Not verified", className: "bg-white/5 text-white/50 ring-white/10" },
    pending: { label: "Review pending", className: "bg-[#F59E0B]/10 text-[#F59E0B] ring-[#F59E0B]/25" },
    verified: { label: "Verified", className: "bg-[#00FF88]/10 text-[#00FF88] ring-[#00FF88]/25" },
    rejected: { label: "Needs attention", className: "bg-red-500/10 text-red-400 ring-red-500/25" },
  }[profile?.kyc_status ?? "not_submitted"] ?? { label: "Not verified", className: "bg-white/5 text-white/50 ring-white/10" };

  return (
    <div className="-mx-3 -my-4 min-h-screen bg-[#0A0B0D] pb-28 text-white sm:-mx-4 md:-my-6 md:pb-10">
      <div className="mx-auto max-w-md md:max-w-2xl">
        {/* Top bar with section navigation */}
        <div className="sticky top-14 z-20 border-b border-white/5 bg-[#0A0B0D]/90 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3">
            <Link
              to="/dashboard"
              aria-label={t("Back to dashboard")}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 transition hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <p className="text-sm font-semibold text-white">{t("Profile & settings")}</p>
            <button
              type="button"
              aria-label={t("Sign out")}
              onClick={async () => {
                await signOut();
                navigate({ to: "/" });
              }}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 transition hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-[#00FF88]/40 hover:text-white"
              >
                {t(section.label)}
              </button>
            ))}
          </nav>
        </div>

        <div className="space-y-4 px-4 py-5">
          {/* Identity */}
          <section className="rounded-3xl bg-gradient-to-br from-[#00FF88]/45 via-white/5 to-[#3B82F6]/25 p-px">
            <div className="relative overflow-hidden rounded-[23px] bg-[#0E1012] p-5">
              <span className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[#00FF88]/10 blur-3xl" aria-hidden />
              <div className="relative flex items-center gap-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#00FF88] to-[#0E9F6E] text-xl font-bold text-[#04120B] shadow-[0_10px_30px_-10px_rgba(0,255,136,0.7)]">
                  {initials(profile?.full_name, user?.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-white">{profile?.full_name || t("JumboCM member")}</p>
                  <p className="truncate text-xs text-white/45">{user?.email}</p>
                  <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${verification.className}`}>
                    <BadgeCheck className="h-3 w-3" /> {t(verification.label)}
                  </span>
                </div>
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-white/40">{t("Payout methods")}</p>
                  <p className="mt-0.5 text-sm font-semibold text-white tabular-nums">{accounts.length}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-white/40">{t("Referral code")}</p>
                  <p className="mt-0.5 truncate font-mono text-sm font-semibold text-[#00FF88]">{profile?.referral_code ?? "—"}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Personal details */}
          <Card id="details" icon={UserRound} title={t("Personal details")}>
            <div className="divide-y divide-white/5 border-t border-white/5">
              <Row icon={Mail} label={t("Email address")} value={user?.email ?? "—"} />
              <Row icon={Phone} label={t("Phone number")} value={profile?.phone ?? t("Not added")} />
            </div>
          </Card>

          {/* Payout methods */}
          <Card
            id="payouts"
            icon={WalletCards}
            title={t("Payout methods")}
            action={
              !showAccountForm ? (
                <button
                  type="button"
                  onClick={() => setShowAccountForm(true)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#00FF88]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00FF88]"
                >
                  <Plus className="h-3.5 w-3.5" /> {t("Add")}
                </button>
              ) : undefined
            }
          >
            <div className="border-t border-white/5">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-3.5 last:border-b-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[#00FF88]">
                    <WalletCards className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{account.account_name}</p>
                      {account.is_default && (
                        <span className="shrink-0 rounded-full bg-[#00FF88]/10 px-2 py-0.5 text-[9px] font-bold uppercase text-[#00FF88]">{t("Default")}</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-white/40">
                      {t(METHOD_LABEL[account.method])} · {account.account_number}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {!account.is_default && (
                      <button
                        type="button"
                        aria-label={t("Make default")}
                        onClick={() => void makeDefault(account.id)}
                        className="grid h-9 w-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-[#00FF88]"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t("Remove account")}
                      onClick={() => void removeAccount(account.id)}
                      className="grid h-9 w-9 place-items-center rounded-lg text-white/40 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              {!accounts.length && !showAccountForm && (
                <p className="px-4 py-5 text-sm text-white/40">{t("No payout method saved yet.")}</p>
              )}
              {showAccountForm && (
                <form onSubmit={saveAccount} className="space-y-2.5 border-t border-white/5 p-4">
                  <select name="payout_method" required className={INPUT_CLASS}>
                    <option value="mobile_money" className="bg-[#0F1012]">{t("Mobile money")}</option>
                    <option value="bank_transfer" className="bg-[#0F1012]">{t("Bank transfer")}</option>
                    <option value="crypto" className="bg-[#0F1012]">{t("Crypto wallet")}</option>
                  </select>
                  <input name="payout_name" placeholder={t("Account name")} required maxLength={120} className={INPUT_CLASS} />
                  <input name="payout_number" placeholder={t("Account or wallet number")} required maxLength={120} className={INPUT_CLASS} />
                  <div className="grid grid-cols-[auto_1fr] gap-2 pt-0.5">
                    <button
                      type="button"
                      aria-label={t("Cancel")}
                      onClick={() => setShowAccountForm(false)}
                      className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-white/60 transition hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      type="submit"
                      disabled={accountBusy}
                      className="h-11 rounded-xl bg-[#00FF88] text-sm font-semibold text-[#04120B] transition active:scale-[0.99] disabled:opacity-60"
                    >
                      {accountBusy ? t("Saving…") : t("Save payout method")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </Card>

          {/* Invite & earn */}
          <Card id="invite" icon={Share2} title={t("Invite & earn")}>
            <div className="border-t border-white/5 p-4">
              <div className="rounded-xl border border-dashed border-[#00FF88]/25 bg-[#00FF88]/[0.04] px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-wide text-white/40">{t("Your referral code")}</p>
                <p className="mt-1 truncate font-mono text-base font-bold text-[#00FF88]">{profile?.referral_code ?? t("Not available")}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={copyReferral}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 text-xs font-semibold text-white/80 transition hover:border-white/20 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" /> {t("Copy link")}
                </button>
                <button
                  type="button"
                  onClick={() => void shareReferral()}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#00FF88] text-xs font-semibold text-[#04120B] transition active:scale-[0.99]"
                >
                  <Share2 className="h-3.5 w-3.5" /> {t("Share")}
                </button>
              </div>
            </div>
          </Card>

          {/* Security */}
          <Card id="security" icon={ShieldCheck} title={t("Security")}>
            <div className="border-t border-white/5">
              <button
                type="button"
                onClick={sendPinReset}
                className="flex w-full items-center gap-3 border-b border-white/5 px-4 py-3.5 text-left transition hover:bg-white/[0.02]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[#00FF88]">
                  <KeyRound className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{t("Transfer PIN")}</span>
                  <span className="block text-xs text-white/40">{t("Send a secure reset link")}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </button>
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.02]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-[#00FF88]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{t("Password")}</span>
                  <span className="block text-xs text-white/40">{t("Change your sign-in password")}</span>
                </span>
                <ChevronRight className={`h-4 w-4 shrink-0 text-white/30 transition ${showPassword ? "rotate-90" : ""}`} />
              </button>
              {showPassword && (
                <form onSubmit={changePassword} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-white/5 p-4">
                  <label htmlFor="new-password" className="sr-only">{t("New password")}</label>
                  <input
                    id="new-password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    placeholder={t("New password")}
                    className={INPUT_CLASS}
                  />
                  <button
                    type="submit"
                    disabled={passwordBusy}
                    className="h-11 rounded-xl bg-[#00FF88] px-4 text-sm font-semibold text-[#04120B] disabled:opacity-60"
                  >
                    {passwordBusy ? t("Saving…") : t("Update")}
                  </button>
                </form>
              )}
            </div>
          </Card>

          {/* Notifications */}
          <Card id="alerts" icon={Bell} title={t("Notifications")}>
            <div className="border-t border-white/5 p-1 [&>div]:border-0 [&>div]:bg-transparent [&>div]:p-3.5 [&_span]:text-white [&_p]:text-white/40 [&_svg]:text-[#00FF88] [&_button]:bg-[#00FF88] [&_button]:text-[#04120B]">
              <PushToggle />
            </div>
          </Card>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/[0.06] text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" /> {t("Sign out")}
          </button>
          <p className="pb-2 text-center text-[11px] text-white/30">{t("JumboCM · Secure account access")}</p>
        </div>
      </div>
    </div>
  );
}
