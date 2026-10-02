import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { detectNetwork, localDigits } from "@/lib/mm-network";

/**
 * After a withdrawal is created, fire a push webhook to the Automate (or MacroDroid)
 * flow on the admin's Android phone so it dials the USSD code instantly — no polling
 * needed. If the webhook fails (phone offline, timeout) the withdrawal stays pending
 * for manual admin processing or the existing pull-based queue.
 */
export const fireUssdWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { withdrawalId: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Read settings
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("auto_withdraw_enabled, ussd_webhook_url, ussd_pin, mm_webhook_secret")
      .eq("id", 1)
      .maybeSingle();

    const s = settings as {
      auto_withdraw_enabled: boolean | null;
      ussd_webhook_url: string | null;
      ussd_pin: string | null;
      mm_webhook_secret: string | null;
    } | null;

    if (!s?.auto_withdraw_enabled || !s?.ussd_webhook_url) {
      return { fired: false, reason: "Auto-payout disabled or no webhook URL configured" };
    }

    // Read the withdrawal record
    const { data: withdrawal } = await supabaseAdmin
      .from("withdrawals")
      .select("id, amount, account_number, method, auto_state")
      .eq("id", data.withdrawalId)
      .maybeSingle();

    const w = withdrawal as {
      id: string;
      amount: number;
      account_number: string;
      method: string;
      auto_state: string;
    } | null;

    if (!w) return { fired: false, reason: "Withdrawal not found" };
    if (w.method !== "mobile_money") return { fired: false, reason: "Not a mobile money withdrawal" };

    const phone = localDigits(w.account_number);
    const net = detectNetwork(w.account_number);
    if (net !== "mtn" && net !== "orange") {
      return { fired: false, reason: "Unknown mobile money provider" };
    }

    const payload: Record<string, unknown> = {
      withdrawal_id: w.id,
      provider: net,
      phone,
      amount: Math.trunc(Number(w.amount)),
      secret_token: s.mm_webhook_secret,
    };

    // Include the PIN only if the admin configured one server-side.
    // If empty, the Automate flow uses its locally stored PIN variable.
    if (s.ussd_pin) {
      payload.pin = s.ussd_pin;
    }

    try {
      const res = await fetch(s.ussd_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("[ussd-webhook] failed", res.status, detail.slice(0, 200));
        return { fired: true, success: false, reason: `Webhook returned ${res.status}` };
      }

      // Mark as queued so the pull-based fallback also knows about it.
      await supabaseAdmin
        .from("withdrawals")
        .update({ auto_state: "queued" })
        .eq("id", w.id);

      return { fired: true, success: true };
    } catch (err) {
      console.error("[ussd-webhook] delivery error", err);
      // Leave auto_state as 'manual' — stays pending for manual admin processing.
      return { fired: true, success: false, reason: "Webhook delivery failed (phone offline?)" };
    }
  });
