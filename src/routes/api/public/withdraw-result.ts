import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  id: z.string().uuid().optional(),
  status: z.enum(["success", "sent", "paid", "failed", "error"]).optional(),
  ref: z.string().max(80).optional().nullable(),
  note: z.string().max(400).optional().nullable(),
  // On-screen USSD result reported by the phone (Read Screen Contents action):
  // `code` is the dialled USSD string, `text` is what the screen showed after the PIN.
  code: z.string().max(200).optional().nullable(),
  text: z.string().max(8000).optional().nullable(),
  secret: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/public/withdraw-result")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { secretMatches } = await import("@/lib/deposit-verify.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { completeWithdrawal, failWithdrawal } = await import("@/lib/withdraw-auto.server");

        let payload: z.infer<typeof bodySchema>;
        try {
          payload = bodySchema.parse(await request.json());
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
        const expected =
          settings?.mm_webhook_secret ?? process.env["MM_SMS_WEBHOOK_SECRET"] ?? null;

        if (!expected || !secretMatches(provided || payload.secret || null, expected)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          // Preferred path: the phone reads the USSD result off the screen right after
          // submitting the PIN and posts it here. The dialled code carries the exact
          // destination number and amount (so the matcher identifies the withdrawal),
          // and the screen text says whether MTN reported success or a failure — so the
          // payout is approved the moment the transfer completes, without waiting for SMS.
          if (!payload.id) {
            const haystack = [payload.code, payload.text].filter(Boolean).join(" ");
            if (!haystack.trim()) {
              return new Response(JSON.stringify({ error: "Nothing to record" }), {
                status: 400,
                headers: { "content-type": "application/json" },
              });
            }
            const { tryConfirmWithdrawalFromSms } = await import("@/lib/withdraw-auto.server");
            const matched = await tryConfirmWithdrawalFromSms(haystack);
            return Response.json({ ok: !!matched, id: matched });
          }

          const ok = ["success", "sent", "paid"].includes(payload.status ?? "");
          const result = ok
            ? await completeWithdrawal(payload.id, payload.ref ?? null)
            : await failWithdrawal(payload.id, payload.note ?? "Phone reported a failure");
          return Response.json(result);
        } catch (err) {
          console.error("[withdraw-result] failed", err);
          return new Response(JSON.stringify({ error: "Could not record the result" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
