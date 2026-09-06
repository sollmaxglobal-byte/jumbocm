/** Korapay mobile-money helpers (server only). */

const BASE = "https://api.korapay.com/merchant/api/v1";

export function korapaySecret(): string {
  const key = process.env["KORAPAY_SECRET_KEY"];
  if (!key) throw new Error("Instant payment is not configured yet.");
  return key;
}

export type KorapayCharge = {
  status: "success" | "processing" | "pending" | "failed" | "expired" | string;
  reference: string;
  transaction_reference?: string | null;
  message?: string | null;
};

function normalise(data: Record<string, unknown>): KorapayCharge {
  return {
    status: String(data["status"] ?? "processing").toLowerCase(),
    reference: String(data["reference"] ?? ""),
    transaction_reference: (data["transaction_reference"] as string | undefined) ?? null,
    message: (data["message"] as string | undefined) ?? null,
  };
}

export async function initiateMobileMoneyCharge(input: {
  reference: string;
  amount: number;
  phone: string;
  customerName: string;
  customerEmail: string;
  notificationUrl?: string;
}): Promise<KorapayCharge> {
  const res = await fetch(`${BASE}/charges/mobile-money`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${korapaySecret()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      reference: input.reference,
      amount: input.amount,
      currency: "XAF",
      customer: { name: input.customerName, email: input.customerEmail },
      mobile_money: { number: input.phone },
      ...(input.notificationUrl ? { notification_url: input.notificationUrl } : {}),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  if (!res.ok || json.status === false || !json.data) {
    throw new Error(json.message || "Could not start the mobile money payment.");
  }
  return normalise(json.data);
}

export async function fetchCharge(reference: string): Promise<KorapayCharge> {
  const res = await fetch(`${BASE}/charges/${encodeURIComponent(reference)}`, {
    headers: { authorization: `Bearer ${korapaySecret()}` },
  });
  const json = (await res.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  if (!res.ok || !json.data) throw new Error(json.message || "Could not check the payment status.");
  return normalise(json.data);
}

/** Maps Korapay statuses to our settlement outcome, or null while still pending. */
export function outcomeFor(status: string): "success" | "failed" | null {
  if (status === "success") return "success";
  if (["failed", "expired", "cancelled", "reversed"].includes(status)) return "failed";
  return null;
}

/** Credits (or rejects) the deposit exactly once. */
export async function settleDeposit(
  reference: string,
  gatewayRef: string | null,
  outcome: "success" | "failed",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("settle_gateway_deposit", {
    _reference: reference,
    _gateway_ref: gatewayRef,
    _outcome: outcome,
  });
  if (error) throw error;
  return data;
}
