/** NOWPayments crypto gateway helpers (server only). */

import { createHmac, timingSafeEqual } from "crypto";

const BASE = "https://api.nowpayments.io/v1";

type SettingsRow = {
  nowpayments_enabled: boolean | null;
  nowpayments_api_key: string | null;
  nowpayments_ipn_secret: string | null;
};

async function nowpaymentsSettings(): Promise<SettingsRow | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("nowpayments_enabled, nowpayments_api_key, nowpayments_ipn_secret")
    .eq("id", 1)
    .maybeSingle();
  return (data as SettingsRow | null) ?? null;
}

export async function nowpaymentsApiKey(): Promise<string> {
  const settings = await nowpaymentsSettings();
  const key = settings?.nowpayments_api_key?.trim();
  if (!key) throw new Error("Crypto payments are not configured yet.");
  return key;
}

export async function nowpaymentsIpnSecret(): Promise<string | null> {
  const settings = await nowpaymentsSettings();
  return settings?.nowpayments_ipn_secret?.trim() || null;
}

export type NowpaymentsInvoice = {
  id: string;
  invoice_url: string;
  order_id?: string;
};

/** Creates a hosted NOWPayments checkout invoice priced in USD. */
export async function createNowpaymentsInvoice(input: {
  reference: string;
  usdAmount: number;
  ipnUrl: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<NowpaymentsInvoice> {
  const res = await fetch(`${BASE}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": await nowpaymentsApiKey(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      price_amount: input.usdAmount,
      price_currency: "usd",
      order_id: input.reference,
      order_description: "JumboCM wallet deposit",
      ipn_callback_url: input.ipnUrl,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    id?: string | number;
    invoice_url?: string;
    order_id?: string;
  };
  if (!res.ok || !json.invoice_url) {
    throw new Error(json.message || "Could not start the crypto payment.");
  }
  return {
    id: String(json.id ?? ""),
    invoice_url: json.invoice_url,
    order_id: json.order_id,
  };
}

/** Verifies the `x-nowpayments-sig` HMAC-SHA512 signature over the sorted IPN body. */
export function verifyNowpaymentsIpn(
  payload: Record<string, unknown>,
  signature: string,
  secret: string,
): boolean {
  const sorted = JSON.stringify(
    Object.keys(payload)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = payload[key];
        return acc;
      }, {}),
  );
  const expected = createHmac("sha512", secret).update(sorted).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Maps a NOWPayments payment status to our settlement outcome, or null while still pending. */
export function outcomeForNowpayments(status: string): "success" | "failed" | null {
  const value = status.toLowerCase();
  if (value === "finished" || value === "confirmed") return "success";
  if (["failed", "expired", "refunded"].includes(value)) return "failed";
  return null;
}

/** Credits (or rejects) a crypto deposit exactly once. */
export async function settleNowpaymentsDeposit(
  reference: string,
  gatewayRef: string | null,
  outcome: "success" | "failed",
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("settle_nowpayments_deposit", {
    _reference: reference,
    _gateway_ref: gatewayRef ?? "",
    _outcome: outcome,
  });
  if (error) throw error;
  return data;
}
