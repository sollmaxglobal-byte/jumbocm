import { createFileRoute } from "@tanstack/react-router";

/**
 * The phone macro (MacroDroid) reports each payout step here: "parsed",
 * "dialing", "pin-entered", "result". It lets the admin see exactly which step
 * stalled instead of guessing — the queue call alone only proves the HTTP part
 * worked, because claiming a payout is a side effect of that same request.
 */
export const Route = createFileRoute("/api/public/auto-log")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { secretMatches } = await import("@/lib/deposit-verify.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { logStep } = await import("@/lib/withdraw-auto.server");

        let payload: { id?: string; step?: string; detail?: string; secret?: string } = {};
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid payload" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const authorization = request.headers.get("authorization");
        const provided =
          request.headers.get("x-mm-secret")?.trim() ||
          (authorization ? authorization.replace(/^Bearer\s+/i, "").trim() : "") ||
          payload.secret?.trim() ||
          null;

        const { data: settings } = await supabaseAdmin
          .from("app_settings")
          .select("mm_webhook_secret")
          .eq("id", 1)
          .maybeSingle();
        const expected = settings?.mm_webhook_secret ?? process.env["MM_SMS_WEBHOOK_SECRET"] ?? null;

        if (!expected || !secretMatches(provided, expected)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const step = (payload.step ?? "").toString().trim().slice(0, 60);
        if (!step) {
          return new Response(JSON.stringify({ error: "Missing step" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        await logStep((payload.id ?? "").toString(), step, payload.detail ?? null);
        return Response.json({ ok: true });
      },
    },
  },
});
