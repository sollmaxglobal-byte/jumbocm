import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MessageCircle,
  Smartphone,
  Building2,
  Bitcoin,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatXAF, txRef } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/deposit-pending/$id")({
  component: PendingDepositPage,
  head: () => ({
    meta: [
      { title: "Payment submitted — JumboCM" },
      { name: "description", content: "Your payment was submitted and is being verified." },
      { property: "og:title", content: "Payment submitted — JumboCM" },
      { property: "og:description", content: "Your payment was submitted and is being verified." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const WAIT_MS = 15 * 60 * 1000;
const POLL_MS = 6 * 1000;
const REDIRECT_AFTER_APPROVAL_MS = 4000;

type Deposit = {
  id: string;
  user_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected" | string;
  created_at: string;
  payment_method_id: string | null;
};

type PaymentMethod = {
  id: string;
  type: "mobile_money" | "bank_transfer" | "crypto";
  label: string;
};

/** Branded provider pill, matching the method the customer actually used. */
function MethodBadge({ method }: { method: PaymentMethod | null }) {
  const label = (method?.label ?? "").toLowerCase();
  if (label.includes("mtn"))
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffcc00] px-3 py-1 shadow-[0_0_18px_rgba(255,204,0,0.35)]">
        <span className="flex items-center rounded-full bg-white px-1 py-px text-[9px] font-black italic text-[#00467f]">
          MTN
        </span>
        <span className="text-xs font-bold text-black">Mobile Money</span>
      </span>
    );
  if (label.includes("orange"))
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff7900] px-3 py-1 shadow-[0_0_18px_rgba(255,121,0,0.35)]">
        <span className="flex items-center rounded-full bg-white px-1 py-px text-[9px] font-black text-[#ff7900]">
          OM
        </span>
        <span className="text-xs font-bold text-white">Orange Money</span>
      </span>
    );
  if (method?.type === "crypto")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f7931a]/15 px-3 py-1 text-[#f7931a]">
        <Bitcoin className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">{method?.label ?? "Crypto"}</span>
      </span>
    );
  if (method?.type === "bank_transfer")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f6c85a]/15 px-3 py-1 text-[#f6c85a]">
        <Building2 className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">{method?.label ?? "Bank Transfer"}</span>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f6c85a]/15 px-3 py-1 text-[#f6c85a]">
      <Smartphone className="h-3.5 w-3.5" />
      <span className="text-xs font-bold">{method?.label ?? "Mobile Money"}</span>
    </span>
  );
}

/** Golden confetti shower across the top of the screen. */
function ConfettiField() {
  const pieces = Array.from({ length: 40 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-44 overflow-hidden">
      {pieces.map((_, i) => {
        const left = (i * 37) % 100;
        const size = 3 + (i % 4) * 2;
        const delay = (i % 12) * 0.12;
        const duration = 2.4 + (i % 5) * 0.4;
        const gold = i % 3 !== 2;
        return (
          <motion.span
            key={i}
            className="absolute top-0"
            style={{
              left: `${left}%`,
              width: size,
              height: size * (i % 2 === 0 ? 2.2 : 1),
              background: gold ? "#f6c85a" : "#f8f7f2",
              borderRadius: i % 2 === 0 ? 1 : "50%",
              rotate: (i * 53) % 360,
            }}
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: [null, 140 + (i % 5) * 16], opacity: [0, 1, 1, 0] }}
            transition={{ duration, delay, repeat: Infinity, repeatDelay: 1.6, ease: "easeIn" }}
          />
        );
      })}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.span
          key={`s-${i}`}
          className="absolute h-1 w-1 rounded-full bg-[#f8f7f2]"
          style={{ left: `${8 + i * 15}%`, top: `${18 + (i % 4) * 14}%` }}
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.4, 0.5] }}
          transition={{ duration: 1.8, delay: i * 0.3, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

function SuccessBurst() {
  const pieces = Array.from({ length: 12 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const dist = 40 + (i % 4) * 10;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{ background: i % 3 === 0 ? "#f6c85a" : i % 3 === 1 ? "#22c55e" : "#f8f7f2" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 0.4 }}
            transition={{ duration: 1.1, delay: 0.15 + i * 0.03, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

function TimelineStep({
  step,
  done,
  active,
  last,
  label,
  sub,
}: {
  step: number;
  done?: boolean;
  active?: boolean;
  last?: boolean;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex gap-2.5">
      <div
        className={`w-9 shrink-0 pt-0.5 text-[10px] font-semibold ${done || active ? "text-[#8f8f98]" : "text-[#5b5b63]"}`}
      >
        Step {step}
      </div>
      <div className="flex flex-col items-center">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            done
              ? "bg-green-500 text-[#101014] shadow-[0_0_12px_rgba(34,197,94,0.4)]"
              : active
                ? "bg-[#f6c85a]/15 text-[#f6c85a]"
                : "bg-[#26262c] text-[#5b5b63]"
          }`}
        >
          {done ? (
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          ) : active ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
        </span>
        {!last && <span className={`mt-0.5 w-px flex-1 ${done ? "bg-green-500/40" : "bg-[#2a2a30]"}`} />}
      </div>
      <div className={`min-w-0 ${last ? "pb-0" : "pb-3"}`}>
        <div
          className={`text-sm font-bold leading-tight ${
            done ? "text-[#f8f7f2]" : active ? "text-[#f6c85a]" : "text-[#5b5b63]"
          }`}
        >
          {label}
        </div>
        <div className={`mt-px text-xs leading-tight ${done || active ? "text-[#8f8f98]" : "text-[#5b5b63]"}`}>
          {sub}
        </div>
      </div>
    </div>
  );
}

function PendingDepositPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [deposit, setDeposit] = useState<Deposit | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [whatsappLink, setWhatsappLink] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = async () => {
      const [{ data }, { data: settings }] = await Promise.all([
        supabase
          .from("deposits")
          .select("id,user_id,amount,status,created_at,payment_method_id")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("public_settings").select("announcement_link").eq("id", 1).maybeSingle(),
      ]);
      if (settings?.announcement_link) setWhatsappLink(settings.announcement_link);
      if (cancelled) return;
      const d = data as Deposit | null;
      if (d) {
        setDeposit(d);
        startRef.current = Math.min(startRef.current, new Date(d.created_at).getTime());
        if (d.payment_method_id && !method) {
          supabase
            .from("payment_methods")
            .select("id,type,label")
            .eq("id", d.payment_method_id)
            .maybeSingle()
            .then(({ data: pm }) => {
              if (!cancelled) setMethod(pm as PaymentMethod | null);
            });
        }
        if (d.status === "approved" || d.status === "rejected") return;
      }
      timer = setTimeout(fetchOnce, POLL_MS);
    };
    fetchOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - startRef.current);
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!deposit || deposit.status !== "pending") return;
    if (elapsed >= WAIT_MS) {
      navigate({ to: "/dashboard/wallet", search: { filter: "Deposits" } as never });
    }
  }, [elapsed, deposit, navigate]);

  useEffect(() => {
    if (deposit?.status !== "approved") return;
    const t = setTimeout(() => {
      navigate({ to: "/dashboard/wallet", search: { filter: "Deposits" } as never });
    }, REDIRECT_AFTER_APPROVAL_MS);
    return () => clearTimeout(t);
  }, [deposit?.status, navigate]);

  if (loading || !deposit) {
    return (
      <div className="grid min-h-dvh place-items-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-[#f6c85a]" />
      </div>
    );
  }

  const pct = Math.min(100, Math.max(60, (elapsed / WAIT_MS) * 100));
  const displayPct = Math.round(pct);
  const reference = txRef(deposit.id);
  const approved = deposit.status === "approved";
  const rejected = deposit.status === "rejected";

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      toast.success("Reference copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-black text-[#f8f7f2]">
      <ConfettiField />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-evenly gap-2 px-4 py-3"
      >
        {/* Success icon + heading */}
        <div className="text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <SuccessBurst />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                rejected
                  ? "bg-red-500/15"
                  : "bg-green-500/10 shadow-[0_0_40px_rgba(34,197,94,0.45)] ring-1 ring-green-500/40"
              }`}
            >
              {rejected ? (
                <XCircle className="h-8 w-8 text-red-500" />
              ) : (
                <CheckCircle2 className="h-8 w-8 text-green-500" strokeWidth={2.5} />
              )}
            </motion.div>
          </div>
          <h1 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-[#f8f7f2]">
            {approved
              ? "Deposit approved successfully!"
              : rejected
                ? "Deposit rejected"
                : "Payment submitted successfully!"}
          </h1>
          <p className="mt-1 text-xs text-[#8f8f98]">
            {approved
              ? "Your deposit has been confirmed and credited to your wallet."
              : rejected
                ? "We couldn't verify this payment. Contact support if you believe this is a mistake."
                : "Your deposit is being verified"}
          </p>
        </div>

        {/* Amount + reference card with dynamic method badge */}
        <div className="rounded-xl border border-[#2a2a30] bg-[#17171c] px-4 py-3 text-center">
          <div className="font-display text-2xl font-extrabold uppercase tabular-nums text-[#f6c85a]">
            {formatXAF(deposit.amount).replace("XAF", "FCFA")}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[#8f8f98]">
            <span>
              Reference · <span className="font-semibold text-[#a8a39a]">JCM-{reference.slice(0, 6)}</span>
            </span>
            <button
              type="button"
              onClick={copyRef}
              aria-label="Copy reference"
              className="text-[#8f8f98] transition-colors hover:text-[#f6c85a]"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2 flex justify-center">
            <MethodBadge method={method} />
          </div>
        </div>

        {/* Vertical timeline */}
        <div>
          <TimelineStep step={1} done label="Uploaded" sub="Payment proof received · just now" />
          <TimelineStep
            step={2}
            done={approved}
            active={!approved && !rejected}
            label={rejected ? "Verification failed" : "Verifying"}
            sub={
              approved
                ? "Payment confirmed by our team"
                : rejected
                  ? "We couldn't match this payment"
                  : "Verifying your payment now… our team is checking"
            }
          />
          <TimelineStep
            step={3}
            done={approved}
            last
            label="Credited"
            sub={approved ? "Funds added to your wallet" : "Funds will be credited to your wallet"}
          />
        </div>

        {/* ETA / transaction info */}
        <div className="rounded-xl border border-[#7f6731] bg-[#1d1a12] p-3">
          <div className="flex items-center gap-2.5">
            <Clock className="h-6 w-6 shrink-0 text-[#f6c85a]" strokeWidth={1.75} />
            <div className="min-w-0">
              <div className="text-xs font-bold">Estimated time: 5–15 minutes</div>
              <div className="text-[11px] text-[#a8a39a]">You&apos;ll receive a notification once credited</div>
            </div>
          </div>
          {!approved && !rejected && (
            <div className="mt-2 flex items-center gap-2 border-t border-[#7f6731]/40 pt-2 text-[11px] text-[#a8a39a]">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-[#f6c85a]"
                    animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </span>
              Checking your payment proof live — this page updates by itself
            </div>
          )}
        </div>

        {/* Progress */}
        <div>
          <div className="mb-1 flex justify-between text-xs font-semibold">
            <span>Progress</span>
            <span className="text-[#f6c85a]">{approved ? 100 : displayPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#26262c]">
            <motion.div
              className={`relative h-full overflow-hidden rounded-full ${approved ? "bg-green-500" : "bg-[#f6c85a]"}`}
              animate={{ width: `${approved ? 100 : displayPct}%` }}
              transition={{ ease: "linear", duration: 0.6 }}
            >
              {!approved && !rejected && (
                <motion.span
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </motion.div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            to="/dashboard"
            className="flex h-11 items-center justify-center rounded-xl bg-[#eab532] text-sm font-bold text-[#101014] transition-colors hover:bg-[#f6c85a]"
          >
            Back to Dashboard
          </Link>
          {whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#d9b54a] bg-transparent text-xs font-bold text-[#f6c85a] transition-colors hover:bg-[#f6c85a]/10"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              WhatsApp Support
            </a>
          ) : (
            <Link
              to="/dashboard/wallet"
              search={{ filter: "Deposits" } as never}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#d9b54a] bg-transparent text-xs font-bold text-[#f6c85a] transition-colors hover:bg-[#f6c85a]/10"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              Contact Support
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}
