import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  MessageCircle,
  Smartphone,
  Building2,
  Bitcoin,
  XCircle,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { formatXAF, txRef } from "@/lib/format";

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

/** Dynamic method logo: picks a branded badge from the method the customer actually used. */
function MethodLogo({ method }: { method: PaymentMethod | null }) {
  const label = (method?.label ?? "").toLowerCase();
  const base =
    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[11px] font-black";
  if (label.includes("mtn"))
    return <span className={`${base} bg-[#ffcc00] text-black shadow-[0_0_20px_rgba(255,204,0,0.35)]`}>MTN</span>;
  if (label.includes("orange"))
    return <span className={`${base} bg-[#ff7900] text-white shadow-[0_0_20px_rgba(255,121,0,0.35)]`}>OM</span>;
  if (method?.type === "crypto")
    return <span className={`${base} bg-[#f7931a]/15 text-[#f7931a]`}><Bitcoin className="h-6 w-6" /></span>;
  if (method?.type === "bank_transfer")
    return <span className={`${base} bg-[#f6c85a]/15 text-[#f6c85a]`}><Building2 className="h-6 w-6" /></span>;
  return <span className={`${base} bg-[#f6c85a]/15 text-[#f6c85a]`}><Smartphone className="h-6 w-6" /></span>;
}

function Confetti() {
  const pieces = Array.from({ length: 14 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {pieces.map((_, i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const dist = 46 + (i % 4) * 12;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{ background: i % 3 === 0 ? "#f6c85a" : i % 3 === 1 ? "#22c55e" : "#f8f7f2" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * dist,
              y: Math.sin(angle) * dist,
              opacity: 0,
              scale: 0.4,
            }}
            transition={{ duration: 1.1, delay: 0.15 + i * 0.03, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

function TimelineRow({
  done,
  active,
  last,
  label,
  sub,
}: {
  done?: boolean;
  active?: boolean;
  last?: boolean;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${
            done
              ? "border-green-500 bg-green-500 text-[#101014]"
              : active
                ? "border-[#f6c85a] bg-[#f6c85a]/10 text-[#f6c85a]"
                : "border-[#3b3b42] bg-transparent text-[#6b6b73]"
          }`}
        >
          {done ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : active ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
        {!last && <span className={`mt-1 w-0.5 flex-1 ${done ? "bg-green-500/60" : "bg-[#3b3b42]"}`} />}
      </div>
      <div className={last ? "pb-0" : "pb-5"}>
        <div className={`text-sm font-semibold ${done || active ? "text-[#f8f7f2]" : "text-[#6b6b73]"}`}>
          {label}
        </div>
        <div className="text-xs text-[#8f8f98]">{sub}</div>
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
        supabase.from("app_settings").select("announcement_link").eq("id", 1).maybeSingle(),
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
      <div className="grid min-h-screen place-items-center bg-[#0f0f12]">
        <Loader2 className="h-8 w-8 animate-spin text-[#f6c85a]" />
      </div>
    );
  }

  const pct = Math.min(100, Math.max(60, (elapsed / WAIT_MS) * 100));
  const displayPct = Math.round(pct);
  const reference = txRef(deposit.id);
  const approved = deposit.status === "approved";
  const rejected = deposit.status === "rejected";

  return (
    <div className="min-h-screen bg-[#0f0f12] text-[#f8f7f2]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto w-full max-w-md space-y-5 px-4 py-8 pb-10 sm:max-w-lg"
      >
        {/* Success icon + heading */}
        <div className="text-center">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            {approved && <Confetti />}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className={`flex h-20 w-20 items-center justify-center rounded-full ${
                approved
                  ? "bg-green-500/15 shadow-[0_0_40px_rgba(34,197,94,0.35)]"
                  : rejected
                    ? "bg-red-500/15"
                    : "bg-green-500/15 shadow-[0_0_40px_rgba(34,197,94,0.25)]"
              }`}
            >
              {rejected ? (
                <XCircle className="h-11 w-11 text-red-500" />
              ) : (
                <CheckCircle2 className="h-11 w-11 text-green-500" />
              )}
            </motion.div>
          </div>
          <h1 className="mt-4 font-display text-2xl font-bold text-[#f6c85a] sm:text-3xl">
            {approved
              ? "Deposit approved successfully"
              : rejected
                ? "Deposit rejected"
                : "Payment submitted successfully"}
          </h1>
          <p className="mt-1 text-sm text-[#8f8f98]">
            {approved
              ? "Your deposit has been confirmed and credited to your wallet."
              : rejected
                ? "We couldn't verify this payment. Contact support if you believe this is a mistake."
                : "Now waiting for approval — this might take up to 15 minutes."}
          </p>
        </div>

        {/* Amount + reference card with dynamic method logo */}
        <div className="rounded-2xl border border-[#2a2a30] bg-[#17171c] p-5">
          <div className="flex items-center gap-3">
            <MethodLogo method={method} />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-[#8f8f98]">
                Payment amount
              </div>
              <div className="truncate font-display text-2xl font-bold uppercase tabular-nums text-[#f6c85a] sm:text-3xl">
                {formatXAF(deposit.amount)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-[#2a2a30] pt-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-[#8f8f98]">Method</div>
              <div className="truncate text-sm font-semibold">{method?.label ?? "Mobile Money"}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-[#8f8f98]">Reference</div>
              <div className="font-mono text-sm font-semibold text-[#f6c85a]">{reference}</div>
            </div>
          </div>
        </div>

        {/* Vertical timeline */}
        <div className="rounded-2xl border border-[#2a2a30] bg-[#17171c] p-5">
          <TimelineRow
            done
            label="Uploaded"
            sub="Payment proof received"
          />
          <TimelineRow
            done={approved}
            active={!approved && !rejected}
            label={rejected ? "Verification failed" : "Verifying"}
            sub={
              approved
                ? "Payment confirmed by our team"
                : rejected
                  ? "We couldn't match this payment"
                  : "Our team is confirming your payment"
            }
          />
          <TimelineRow
            done={approved}
            last
            label="Credited"
            sub={approved ? "Funds added to your wallet" : "Funds will appear in your wallet"}
          />
        </div>

        {/* ETA / transaction info */}
        <div className="rounded-2xl border border-[#7f6731] bg-[#1d1a12] p-4">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Estimated time: 5–15 minutes</span>
            <Clock className="h-5 w-5 text-[#f6c85a]" />
          </div>
          <p className="mt-1 text-sm text-[#a8a39a]">
            You&apos;ll receive a notification once credited.
          </p>
          <p className="mt-3 text-sm text-[#a8a39a]">
            Transaction ID: <span className="font-mono text-[#f8f7f2]">{deposit.id}</span>
          </p>
        </div>

        {/* Progress */}
        <div>
          <div className="mb-2 flex justify-between text-sm font-semibold">
            <span>Progress</span>
            <span className="text-[#f6c85a]">{approved ? 100 : displayPct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[#26262c]">
            <motion.div
              className={`h-full rounded-full ${approved ? "bg-green-500" : "bg-[#f6c85a]"}`}
              animate={{ width: `${approved ? 100 : displayPct}%` }}
              transition={{ ease: "linear", duration: 0.6 }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button asChild className="h-12 bg-[#eab532] font-semibold text-[#101014] hover:bg-[#f6c85a]">
            <Link to="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          {whatsappLink ? (
            <Button
              asChild
              variant="outline"
              className="h-12 border-[#d9b54a] bg-transparent font-semibold text-[#f6c85a] hover:bg-[#f6c85a]/10"
            >
              <a href={whatsappLink} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp Support
              </a>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              className="h-12 border-[#d9b54a] bg-transparent font-semibold text-[#f6c85a] hover:bg-[#f6c85a]/10"
            >
              <Link to="/dashboard/wallet" search={{ filter: "Deposits" } as never}>
                <History className="mr-2 h-4 w-4" />
                History
              </Link>
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
