import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/nowpayments-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const { nowpaymentsIpnSecret, verifyNowpaymentsIpn, outcomeForNowpayments, settleNowpaymentsDeposit } =
          await import("@/lib/nowpayments.server");

        const secret = await nowpaymentsIpnSecret();
        if (!secret) return new Response("Not configured", { status: 503 });

        const signature = request.headers.get("x-nowpayments-sig") ?? "";
        if (!verifyNowpaymentsIpn(payload, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const reference = String(payload["order_id"] ?? "");
        if (!reference) return new Response("Missing order", { status: 400 });

        const status = String(payload["payment_status"] ?? "");
        const outcome = outcomeForNowpayments(status);
        if (!outcome) return Response.json({ ok: true, ignored: status });

        try {
          await settleNowpaymentsDeposit(
            reference,
            payload["payment_id"] != null ? String(payload["payment_id"]) : null,
            outcome,
          );
        } catch (err) {
          console.error("[nowpayments-webhook] settle failed", err);
          return new Response("Could not process", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
