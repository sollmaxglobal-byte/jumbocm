import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Check, Clock3, Copy, FileImage, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { checkKorapayDeposit, startKorapayDeposit } from "@/lib/korapay.functions";
import { startNowpaymentsDeposit } from "@/lib/nowpayments.functions";
import { useAuth } from "@/hooks/useAuth";
import { setPendingInvestment } from "@/lib/pending-investment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard/deposit")({
  component: DepositPage,
  validateSearch: z.object({
    // Prefilled from the investment flow: the plan's full amount and the plan to activate.
    amount: z.coerce.number().optional(),
    plan: z.string().optional(),
  }),
});

type MethodId = string;
type Method = {
  id: MethodId;
  name: string;
  number: string;
  enabled: boolean;
  instructions?: string;
  accountName?: string;
};
type Settings = {
  deposit_min_amount?: number;
  deposit_max_amount?: number;
  korapay_enabled?: boolean;
  nowpayments_enabled?: boolean;
};

const KORAPAY = "korapay";
const NOWPAYMENTS = "nowpayments";

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];
const fallbackSettings = { deposit_min_amount: 1000, deposit_max_amount: 1000000 };

const GOLD = "#f6c85a";
const INK = "#0f0f12";
const CARD = "#17171c";

function money(value: string | number) {
  return Number(value || 0).toLocaleString("en-US");
}
function shortMoney(value: number) {
  return value >= 1000 ? `${value / 1000}k` : String(value);
}
function makeReference() {
  return `JCM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
function methodName(method: Method | undefined) {
  return method?.name ?? "Mobile Money";
}

function MethodLogo({ name }: { name: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("mtn"))
    return (
      <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-[#ffcb05] text-[13px] font-black italic tracking-tight text-[#0b3f8f]">
        MTN
      </span>
    );
  if (lower.includes("orange"))
    return (
      <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-[#ff7900] text-[11px] font-bold lowercase text-white">
        orange
      </span>
    );
  return (
    <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-white">
      {name.slice(0, 3).toUpperCase()}
    </span>
  );
}

function DepositPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { amount: amountParam, plan: planId } = Route.useSearch();
  const [amount, setAmount] = useState(() =>
    amountParam ? String(Math.round(amountParam)) : "",
  );
  const [planName, setPlanName] = useState("");
  const [method, setMethod] = useState<MethodId | null>(null);
  const [reference] = useState(makeReference);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<Settings>(fallbackSettings);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(900);
  const [depositStatus, setDepositStatus] = useState("pending");
  const [payPhone, setPayPhone] = useState("");
  const [charging, setCharging] = useState(false);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const startCharge = useServerFn(startKorapayDeposit);
  const checkCharge = useServerFn(checkKorapayDeposit);
  const startCrypto = useServerFn(startNowpaymentsDeposit);
  const [cryptoBusy, setCryptoBusy] = useState(false);

  const [activeMethods, setActiveMethods] = useState<Method[]>([]);
  const selectedMethod = activeMethods.find((m) => m.id === method);
  const instant = method === KORAPAY;
  const instantEnabled = Boolean(settings.korapay_enabled);
  const crypto = method === NOWPAYMENTS;
  const cryptoEnabled = Boolean(settings.nowpayments_enabled);
  const amountNumber = Number(amount);
  const minAmount = Number(settings.deposit_min_amount ?? fallbackSettings.deposit_min_amount);
  const maxAmount = Number(settings.deposit_max_amount ?? fallbackSettings.deposit_max_amount);
  const amountError =
    amount && (amountNumber < minAmount || amountNumber > maxAmount)
      ? `Enter an amount between ${money(minAmount)} and ${money(maxAmount)} FCFA.`
      : "";

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [{ data: settingsData }, { data: methodsData }, { data: cryptoData }] =
        await Promise.all([
          supabase
            .from("public_settings")
            .select("deposit_min_amount, deposit_max_amount, korapay_enabled")
            .eq("id", 1)
            .maybeSingle(),
          supabase
            .from("payment_methods")
            .select("id, label, account_name, account_number, instructions, active, scope")
            .eq("active", true)
            .in("scope", ["deposit", "both"])
            .order("type"),
          // Queried separately: the column only exists after the NOWPayments migration,
          // so a failure here must not disable the other deposit methods.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any)
            .from("public_settings")
            .select("nowpayments_enabled")
            .eq("id", 1)
            .maybeSingle(),
        ]);
      if (mounted && settingsData)
        setSettings({
          ...(settingsData as Settings),
          nowpayments_enabled: Boolean(cryptoData?.nowpayments_enabled),
        });
      if (mounted && methodsData)
        setActiveMethods(
          methodsData
            .map((item) => ({
              id: item.id,
              name: item.label,
              number: item.account_number ?? "",
              enabled: item.active,
              instructions: item.instructions ?? undefined,
              accountName: item.account_name ?? undefined,
            }))
            .filter((item) => item.number),
        );
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!planId) return;
    void (async () => {
      const { data } = await supabase.from("plans").select("name").eq("id", planId).maybeSingle();
      if (data?.name) setPlanName(data.name);
    })();
  }, [planId]);

  useEffect(() => {
    if (step === 2 && activeMethods.length === 1 && !settings.korapay_enabled)
      setMethod(activeMethods[0].id);
  }, [step, activeMethods, settings.korapay_enabled]);

  useEffect(() => {
    if (step !== 3 || remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [step, remaining]);

  useEffect(() => {
    if (!submitted) return;
    const poll = window.setInterval(async () => {
      const { data } = await supabase
        .from("deposits")
        .select("status")
        .eq("reference", reference)
        .maybeSingle();
      if (data?.status) setDepositStatus(data.status);
    }, 10000);
    return () => window.clearInterval(poll);
  }, [submitted, reference]);

  useEffect(() => {
    if (!chargeId) return;
    const poll = window.setInterval(async () => {
      try {
        const res = await checkCharge({ data: { depositId: chargeId } });
        if (res.status === "approved") {
          window.clearInterval(poll);
          navigate({ to: "/deposit-pending/$id", params: { id: chargeId } });
        } else if (res.status === "rejected") {
          window.clearInterval(poll);
          setCharging(false);
          setChargeId(null);
          toast.error("The payment was not completed. Please try again.");
        }
      } catch {
        /* keep polling */
      }
    }, 5000);
    return () => window.clearInterval(poll);
  }, [chargeId, checkCharge, navigate]);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  }

  function next() {
    if (step === 1) {
      if (!amount || amountNumber < minAmount || amountNumber > maxAmount) {
        toast.error(amountError || "Enter a valid amount.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!method) {
        toast.error("Choose an active payment method.");
        return;
      }
      setStep(3);
    } else if (step === 3) setStep(4);
  }

  async function payInstantly() {
    if (charging) return;
    const phone = payPhone.replace(/\D/g, "");
    if (phone.replace(/^237/, "").length !== 9) {
      toast.error("Enter your 9-digit mobile money number.");
      return;
    }
    setCharging(true);
    setDepositStatus("pending");
    try {
      const res = await startCharge({ data: { amount: amountNumber, phone } });
      setChargeId(res.depositId);
      if (planId)
        setPendingInvestment({ planId, amount: amountNumber, depositId: res.depositId });
      if (res.status === "success") {
        navigate({ to: "/deposit-pending/$id", params: { id: res.depositId } });
      } else {
        toast.success("Approve the payment prompt on your phone.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the payment.");
      setCharging(false);
    }
  }

  async function payWithCrypto() {
    if (cryptoBusy) return;
    setCryptoBusy(true);
    try {
      const res = await startCrypto({ data: { amount: amountNumber } });
      window.location.href = res.invoiceUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the crypto payment.");
      setCryptoBusy(false);
    }
  }

  async function submitProof() {
    if (!user || !uploadedFile || !selectedMethod) {
      toast.error("Upload your payment proof to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const path = `${user.id}/${reference}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(path, uploadedFile, { upsert: true, contentType: uploadedFile.type });
      if (uploadError) throw uploadError;
      const { data: createdDeposit, error } = await supabase
        .from("deposits")
        .insert({
          user_id: user.id,
          amount: amountNumber,
          payment_method_id: method,
          reference,
          proof_url: path,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      if (!createdDeposit) throw new Error("Deposit was created without an ID.");
      if (planId)
        setPendingInvestment({ planId, amount: amountNumber, depositId: createdDeposit.id });
      toast.success("Proof uploaded successfully");
      navigate({ to: "/deposit-pending/$id", params: { id: createdDeposit.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit your deposit.");
    } finally {
      setSubmitting(false);
    }
  }

  const timer = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  if (loading)
    return (
      <div className="grid h-dvh place-items-center text-sm text-[#a9a9b0]" style={{ background: INK }}>
        Loading deposit options…
      </div>
    );

  return (
    <main
      className="fixed inset-0 z-30 mx-auto flex w-full max-w-md flex-col overflow-hidden px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-4 text-white"
      style={{ background: INK }}
    >
      {/* progress */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="h-1.5 w-24 rounded-full" style={{ background: GOLD }} />
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className="h-2 w-2 rounded-full transition-colors"
            style={{ background: step >= n ? GOLD : "#3a3a42" }}
          />
        ))}
        <span className="h-1.5 flex-1 rounded-full bg-[#2c2c33]" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden py-3">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="flex flex-col gap-5"
          >
            <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight">
              How much do you want to deposit?
            </h1>
            {planId && (
              <div className="rounded-xl border border-[#7f6731] bg-[#1d1a12] px-3 py-2 text-left text-xs text-[#c8c8d0]">
                Funding <span className="font-bold text-[#f6c85a]">{planName || "your plan"}</span>{" "}
                — it activates automatically once your deposit is confirmed.
              </div>
            )}


            <div className="flex flex-col items-center gap-3">
              <div
                className="flex w-full items-center justify-center rounded-2xl border-2 px-4 py-4"
                style={{ borderColor: GOLD, background: "#141418" }}
              >
                <Input
                  id="deposit-amount"
                  value={amount ? money(amount) : ""}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  inputMode="numeric"
                  aria-label="Amount in FCFA"
                  className="h-auto w-full border-0 bg-transparent p-0 text-center text-[30px] font-extrabold tracking-tight shadow-none focus-visible:ring-0"
                  style={{ color: GOLD }}
                />
                <span className="pl-2 text-[26px] font-extrabold" style={{ color: GOLD }}>
                  FCFA
                </span>
              </div>
              <p className="text-sm text-[#9a9aa2]">
                Min {money(minAmount)} • Max {money(maxAmount)}
              </p>
              {amountError && <p className="text-sm text-destructive">{amountError}</p>}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {QUICK_AMOUNTS.map((value) => {
                const active = amountNumber === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(String(value))}
                    className="rounded-xl border-2 py-3 text-base font-bold transition"
                    style={{
                      borderColor: GOLD,
                      background: active ? GOLD : "transparent",
                      color: active ? "#141418" : GOLD,
                    }}
                  >
                    {shortMoney(value)}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="method"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="flex flex-col gap-4"
          >
            <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight">
              Select payment method
            </h1>

            {instantEnabled && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setMethod(KORAPAY)}
                className="relative flex items-center gap-4 rounded-2xl border-2 p-4 text-left"
                style={{
                  borderColor: GOLD,
                  background: instant ? GOLD : "#141418",
                }}
              >
                <span
                  className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md text-[11px] font-black"
                  style={{ background: instant ? "#141418" : GOLD, color: instant ? GOLD : "#141418" }}
                >
                  PAY
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="truncate text-lg font-bold"
                    style={{ color: instant ? "#141418" : "#ffffff" }}
                  >
                    Pay instantly
                  </span>
                  <span
                    className="truncate text-sm"
                    style={{ color: instant ? "rgba(20,20,24,0.7)" : "#9a9aa2" }}
                  >
                    MTN / Orange prompt • credited automatically
                  </span>
                </span>
                {instant && (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#141418]/15">
                    <Check className="size-4 text-[#141418]" />
                  </span>
                )}
              </motion.button>
            )}

            {cryptoEnabled && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setMethod(NOWPAYMENTS)}
                className="relative flex items-center gap-4 rounded-2xl border-2 p-4 text-left"
                style={{ borderColor: GOLD, background: crypto ? GOLD : "#141418" }}
              >
                <span
                  className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md text-[10px] font-black"
                  style={{ background: crypto ? "#141418" : GOLD, color: crypto ? GOLD : "#141418" }}
                >
                  CRYPTO
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="truncate text-lg font-bold"
                    style={{ color: crypto ? "#141418" : "#ffffff" }}
                  >
                    Pay with crypto
                  </span>
                  <span
                    className="truncate text-sm"
                    style={{ color: crypto ? "rgba(20,20,24,0.7)" : "#9a9aa2" }}
                  >
                    BTC, ETH, USDT & more • credited automatically
                  </span>
                </span>
                {crypto && (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#141418]/15">
                    <Check className="size-4 text-[#141418]" />
                  </span>
                )}
              </motion.button>
            )}

            {activeMethods.length === 0 && !instantEnabled && !cryptoEnabled ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#3c3c47] p-8 text-center">
                <Clock3 className="size-8 text-[#9a9aa2]" />
                <p className="text-sm text-[#9a9aa2]">
                  There are no active deposit methods right now.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeMethods.map((item) => {
                  const active = method === item.id;
                  return (
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      key={item.id}
                      type="button"
                      onClick={() => setMethod(item.id)}
                      className="relative flex items-center gap-4 rounded-2xl p-4 text-left"
                      style={{ background: active ? GOLD : "#6d6d75" }}
                    >
                      <MethodLogo name={item.name} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-lg font-bold text-[#141418]">
                          {item.name}
                        </span>
                        <span className="truncate text-sm text-[#141418]/70">
                          Mobile Money • Instant
                        </span>
                      </span>
                      {active && (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#141418]/15">
                          <Check className="size-4 text-[#141418]" />
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {step === 3 && instant && (
          <motion.div
            key="instant"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="flex flex-col gap-4 text-center"
          >
            <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight">
              {chargeId ? "Check your phone" : "Pay instantly"}
            </h1>
            <p className="text-base font-semibold" style={{ color: GOLD }}>
              {money(amount)} FCFA
            </p>

            {chargeId ? (
              <div className="flex flex-col items-center gap-3">
                <Clock3 className="size-10 animate-pulse" style={{ color: GOLD }} />
                <p className="text-sm text-[#c8c8d0]">
                  Enter your mobile money PIN on the prompt sent to {payPhone}. Your wallet is
                  credited automatically once the payment goes through.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 text-left">
                <label htmlFor="pay-phone" className="text-sm font-semibold" style={{ color: GOLD }}>
                  Mobile money number
                </label>
                <Input
                  id="pay-phone"
                  value={payPhone}
                  inputMode="numeric"
                  placeholder="6XX XXX XXX"
                  onChange={(e) => setPayPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  className="h-14 rounded-2xl border-2 bg-[#141418] text-center text-2xl font-extrabold text-white"
                  style={{ borderColor: GOLD }}
                />
                <p className="text-xs text-[#9a9aa2]">
                  You will receive a payment prompt on this number. No screenshot needed.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {step === 3 && crypto && (
          <motion.div
            key="crypto"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight">Pay with crypto</h1>
            <p className="text-base font-semibold" style={{ color: GOLD }}>
              {money(amount)} FCFA
            </p>
            <p className="text-sm text-[#c8c8d0]">
              You will be redirected to the secure NOWPayments checkout to pay in BTC, ETH, USDT or
              any supported coin. Your wallet is credited automatically once the network confirms
              the payment.
            </p>
          </motion.div>
        )}

        {step === 3 && !instant && selectedMethod && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="flex flex-col gap-3 text-center"
          >
            <div>
              <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight">
                Complete your payment
              </h1>
              <p className="mt-2 text-base font-semibold text-white/90">Send exact amount</p>
            </div>

            <GoldRow
              label="Amount to send"
              value={`${money(amount)} FCFA`}
              onCopy={() => copy(String(amountNumber))}
            />
            <GoldRow
              label="Send to number"
              value={selectedMethod.number}
              light
              onCopy={() => copy(selectedMethod.number)}
            />
            <GoldRow
              label="Account name"
              value={selectedMethod.accountName ?? methodName(selectedMethod)}
              hint="Confirm this name before you send"
              onCopy={() => copy(selectedMethod.accountName ?? "")}
            />

            <div className="mt-1 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <Clock3 className="size-6" style={{ color: GOLD }} />
                <span className="font-mono text-3xl font-bold" style={{ color: GOLD }}>
                  {timer}
                </span>
              </div>
              <p className="text-sm text-[#9a9aa2]">Payment window expires in</p>
            </div>
          </motion.div>
        )}

        {step === 4 && !submitted && (
          <motion.div
            key="proof"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="flex flex-col gap-3 text-center"
          >
            <label
              htmlFor="proof"
              className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4"
              style={{ borderColor: GOLD }}
            >
              <Upload className="size-9" style={{ color: GOLD }} />
              <span className="text-2xl font-bold" style={{ color: GOLD }}>
                Tap to upload
              </span>
              <Input
                id="proof"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size > 5 * 1024 * 1024)
                    toast.error("File must be smaller than 5MB.");
                  else setUploadedFile(file ?? null);
                }}
              />
            </label>
            <p className="text-base font-semibold">Upload payment screenshot or receipt</p>
            {uploadedFile && (
              <div className="flex items-center gap-3 rounded-xl border border-[#3c3c47] p-3 text-left">
                <FileImage className="size-5" style={{ color: GOLD }} />
                <span className="min-w-0 flex-1 truncate text-sm">{uploadedFile.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setUploadedFile(null)}
                  aria-label="Remove proof"
                >
                  <X />
                </Button>
              </div>
            )}
            <p className="text-sm text-[#9a9aa2]">
              Depositing {money(amount)} FCFA via {methodName(selectedMethod)}
            </p>
          </motion.div>
        )}

        {submitted && (
          <motion.div
            key="submitted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-7 text-center"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex size-11 items-center justify-center rounded-full"
                style={{ background: GOLD }}
              >
                <Check className="size-6 text-[#141418]" />
              </span>
              <span className="text-2xl font-extrabold" style={{ color: GOLD }}>
                Payment submitted!
              </span>
            </div>

            <div className="flex w-full items-center justify-between gap-1">
              {(
                [
                  ["Uploaded", true],
                  ["Verifying", true],
                  ["Credited", depositStatus === "approved"],
                ] as const
              ).map(([label, done], i) => (
                <div key={label} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-sm font-semibold text-white/90">{label}</span>
                  <div className="flex w-full items-center">
                    {i > 0 && <span className="h-px flex-1" style={{ background: GOLD }} />}
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full border-2"
                      style={{
                        borderColor: GOLD,
                        background: done ? GOLD : "transparent",
                      }}
                    >
                      {done ? (
                        <Check className="size-3.5 text-[#141418]" />
                      ) : (
                        <Clock3 className="size-3.5" style={{ color: GOLD }} />
                      )}
                    </span>
                    {i < 2 && <span className="h-px flex-1" style={{ background: GOLD }} />}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-base font-semibold">Estimated time: 5–15 minutes</p>
              <p className="mt-2 text-sm text-[#9a9aa2]">We’ll notify you once credited</p>
            </div>

            <div className="flex w-full flex-col gap-3">
              <Button
                onClick={() => navigate({ to: "/dashboard" })}
                className="h-12 w-full rounded-xl text-base font-bold"
                style={{ background: GOLD, color: "#141418" }}
              >
                Back to dashboard
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {!submitted && (
        <div
          className="shrink-0 rounded-2xl border-t border-[#26262d] pt-3"
          style={{ background: `${CARD}00` }}
        >
          <div className="mx-auto flex max-w-md gap-3">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                className="h-12 shrink-0 rounded-xl border-[#3c3c47] bg-transparent px-4 text-white hover:bg-white/5"
                aria-label="Back"
              >
                <ArrowLeft />
              </Button>
            )}
            <Button
              onClick={
                step === 3 && instant
                  ? payInstantly
                  : step === 3 && crypto
                    ? payWithCrypto
                    : step < 4
                      ? next
                      : submitProof
              }
              disabled={
                (step === 2 && activeMethods.length === 0 && !instantEnabled && !cryptoEnabled) ||
                (step === 3 && instant && charging) ||
                (step === 3 && crypto && cryptoBusy) ||
                (step === 4 && (!uploadedFile || submitting))
              }
              className="h-12 flex-1 rounded-xl text-base font-bold hover:opacity-90"
              style={{ background: GOLD, color: "#141418" }}
            >
              {step === 3 && instant
                ? chargeId
                  ? "Waiting for your approval…"
                  : charging
                    ? "Starting…"
                    : "Pay now"
                : step === 3 && crypto
                  ? cryptoBusy
                    ? "Redirecting…"
                    : "Pay with crypto"
                  : step === 3
                    ? "I have paid"
                    : step === 4
                      ? submitting
                        ? "Submitting…"
                        : "Submit proof"
                      : "Continue"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}

function GoldRow({
  label,
  value,
  hint,
  light,
  onCopy,
}: {
  label: string;
  value: string;
  hint?: string;
  light?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left"
      style={{ borderColor: GOLD, background: "#141418" }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: GOLD }}>
          {label}
        </p>
        <p
          className="mt-0.5 break-words text-[22px] font-extrabold leading-tight"
          style={{ color: light ? "#ffffff" : GOLD }}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-[#9a9aa2]">{hint}</p>}
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
          className="mt-1 shrink-0 rounded-md p-1.5 hover:bg-white/10"
        >
          <Copy className="size-5" style={{ color: GOLD }} />
        </button>
      )}
    </div>
  );
}

