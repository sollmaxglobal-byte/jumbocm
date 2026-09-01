import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock3, Copy, FileImage, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/dashboard/deposit")({ component: DepositPage });

type MethodId = string;
type Method = {
  id: MethodId;
  name: string;
  number: string;
  enabled: boolean;
  instructions?: string;
  accountName?: string;
};
type Settings = { deposit_min_amount?: number; deposit_max_amount?: number };

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
  return `FID-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
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
  const [amount, setAmount] = useState("");
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

  const [activeMethods, setActiveMethods] = useState<Method[]>([]);
  const selectedMethod = activeMethods.find((m) => m.id === method);
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
      const [{ data: settingsData }, { data: methodsData }] = await Promise.all([
        supabase
          .from("app_settings")
          .select("deposit_min_amount, deposit_max_amount")
          .eq("id", 1)
          .maybeSingle(),
        supabase
          .from("payment_methods")
          .select("id, label, account_name, account_number, instructions, active, scope")
          .eq("active", true)
          .in("scope", ["deposit", "both"])
          .order("type"),
      ]);
      if (mounted && settingsData) setSettings(settingsData as Settings);
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
    if (step === 2 && activeMethods.length === 1) setMethod(activeMethods[0].id);
  }, [step, activeMethods]);

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
      <div className="mx-auto max-w-md py-16 text-center text-sm text-[#a9a9b0]">
        Loading deposit options…
      </div>
    );

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-col gap-7 px-5 pb-36 pt-6 text-white"
      style={{ background: INK }}
    >
      {/* progress */}
      <div className="flex items-center gap-2">
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

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="flex flex-col gap-7"
          >
            <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-tight">
              How much do you want to deposit?
            </h1>

            <div className="flex flex-col items-center gap-3">
              <div
                className="flex w-full items-center justify-center rounded-2xl border-2 px-4 py-6"
                style={{ borderColor: GOLD, background: "#141418" }}
              >
                <Input
                  id="deposit-amount"
                  value={amount ? money(amount) : ""}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  inputMode="numeric"
                  aria-label="Amount in FCFA"
                  className="h-auto w-full border-0 bg-transparent p-0 text-center text-[34px] font-extrabold tracking-tight shadow-none focus-visible:ring-0"
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

            <div className="grid grid-cols-2 gap-4">
              {QUICK_AMOUNTS.map((value) => {
                const active = amountNumber === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmount(String(value))}
                    className="rounded-2xl border-2 py-4 text-xl font-bold transition"
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
            className="flex flex-col gap-6"
          >
            <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-tight">
              Select payment method
            </h1>

            {activeMethods.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#3c3c47] p-8 text-center">
                <Clock3 className="size-8 text-[#9a9aa2]" />
                <p className="text-sm text-[#9a9aa2]">
                  There are no active deposit methods right now.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
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

        {step === 3 && selectedMethod && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="flex flex-col gap-5 text-center"
          >
            <div>
              <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-tight">
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
            className="flex flex-col gap-5 text-center"
          >
            <label
              htmlFor="proof"
              className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6"
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

      {!submitted && (
        <div
          className="fixed inset-x-0 bottom-16 z-10 border-t border-[#26262d] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur"
          style={{ background: `${CARD}f2` }}
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
              onClick={step < 4 ? next : submitProof}
              disabled={
                (step === 2 && activeMethods.length === 0) ||
                (step === 4 && (!uploadedFile || submitting))
              }
              className="h-12 flex-1 rounded-xl text-base font-bold hover:opacity-90"
              style={{ background: GOLD, color: "#141418" }}
            >
              {step === 3
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
          className="mt-0.5 break-words text-[26px] font-extrabold leading-tight"
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

export function StatusBadge({ status }: { status: string }) {
  return <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{status}</span>;
}
