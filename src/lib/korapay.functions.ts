import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const startSchema = z.object({
  amount: z.number().int().positive(),
  phone: z.string().min(8).max(20),
});

function localPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

export const startKorapayDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => startSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { initiateMobileMoneyCharge, outcomeFor, settleDeposit } = await import(
      "@/lib/korapay.server"
    );

    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("korapay_enabled, deposit_min_amount, deposit_max_amount")
      .eq("id", 1)
      .maybeSingle();

    if (!settings?.korapay_enabled) throw new Error("Instant payment is currently unavailable.");
    const min = Number(settings.deposit_min_amount ?? 1000);
    const max = Number(settings.deposit_max_amount ?? 1000000);
    if (data.amount < min || data.amount > max) {
      throw new Error(`Enter an amount between ${min} and ${max} FCFA.`);
    }

    const phone = localPhone(data.phone);
    if (phone.length !== 9) throw new Error("Enter a valid 9-digit mobile money number.");

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
        gateway: "korapay",
        gateway_status: "initiated",
        payer_phone: phone,
      })
      .select("id")
      .single();
    if (error || !deposit) throw new Error("Could not create the deposit.");

    const claims = context.claims as { email?: string } | null;
    const origin = new URL(getRequest().url).origin;

    try {
      const charge = await initiateMobileMoneyCharge({
        reference,
        amount: data.amount,
        phone: `237${phone}`,
        customerName: "JumboCM member",
        customerEmail: claims?.email ?? "member@jumbocm.app",
        notificationUrl: `${origin}/api/public/korapay-webhook`,
      });

      await supabaseAdmin
        .from("deposits")
        .update({ gateway_status: charge.status, gateway_ref: charge.transaction_reference })
        .eq("id", deposit.id);

      const outcome = outcomeFor(charge.status);
      if (outcome) await settleDeposit(reference, charge.transaction_reference ?? null, outcome);

      return { depositId: deposit.id, reference, status: outcome ?? "pending" };
    } catch (err) {
      await supabaseAdmin
        .from("deposits")
        .update({
          status: "rejected",
          gateway_status: "failed",
          auto_note: "Instant payment could not be started",
        })
        .eq("id", deposit.id);
      throw err instanceof Error ? err : new Error("Could not start the payment.");
    }
  });

export const checkKorapayDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ depositId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchCharge, outcomeFor, settleDeposit } = await import("@/lib/korapay.server");

    const { data: deposit } = await supabaseAdmin
      .from("deposits")
      .select("id, user_id, status, reference, gateway")
      .eq("id", data.depositId)
      .maybeSingle();

    if (!deposit || deposit.user_id !== context.userId) throw new Error("Deposit not found.");
    if (deposit.status !== "pending" || deposit.gateway !== "korapay") {
      return { status: deposit.status };
    }

    const charge = await fetchCharge(deposit.reference!);
    await supabaseAdmin
      .from("deposits")
      .update({ gateway_status: charge.status })
      .eq("id", deposit.id);

    const outcome = outcomeFor(charge.status);
    if (!outcome) return { status: "pending" as const };
    await settleDeposit(deposit.reference!, charge.transaction_reference ?? null, outcome);
    return { status: outcome === "success" ? ("approved" as const) : ("rejected" as const) };
  });
