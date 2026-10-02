import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { XAF_PER_USD } from "@/lib/format";

const startSchema = z.object({
  amount: z.number().int().positive(),
});

export const startNowpaymentsDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => startSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createNowpaymentsInvoice } = await import("@/lib/nowpayments.server");

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("nowpayments_enabled, deposit_min_amount, deposit_max_amount")
      .eq("id", 1)
      .maybeSingle();

    if (!settings?.nowpayments_enabled) throw new Error("Crypto payments are currently unavailable.");
    const min = Number(settings.deposit_min_amount ?? 1000);
    const max = Number(settings.deposit_max_amount ?? 1000000);
    if (data.amount < min || data.amount > max) {
      throw new Error(`Enter an amount between ${min} and ${max} FCFA.`);
    }

    const reference = `JCM-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

    const { data: deposit, error } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: context.userId,
        amount: data.amount,
        reference,
        status: "pending",
        gateway: "nowpayments",
        gateway_status: "initiated",
      })
      .select("id")
      .single();
    if (error || !deposit) throw new Error("Could not create the deposit.");

    const origin = new URL(getRequest().url).origin;
    const usdAmount = Math.round((data.amount / XAF_PER_USD) * 100) / 100;

    try {
      const invoice = await createNowpaymentsInvoice({
        reference,
        usdAmount,
        ipnUrl: `${origin}/api/public/nowpayments-webhook`,
        successUrl: `${origin}/deposit-pending/${deposit.id}`,
        cancelUrl: `${origin}/dashboard/deposit`,
      });

      await supabaseAdmin
        .from("deposits")
        .update({ gateway_ref: invoice.id, gateway_status: "waiting" })
        .eq("id", deposit.id);

      return { depositId: deposit.id as string, reference, invoiceUrl: invoice.invoice_url };
    } catch (err) {
      await supabaseAdmin
        .from("deposits")
        .update({
          status: "rejected",
          gateway_status: "failed",
          auto_note: "Crypto payment could not be started",
        })
        .eq("id", deposit.id);
      throw err instanceof Error ? err : new Error("Could not start the crypto payment.");
    }
  });
