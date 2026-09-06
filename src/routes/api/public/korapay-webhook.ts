import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/korapay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["KORAPAY_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const raw = await request.text();
        let payload: { event?: string; data?: Record<string, unknown> };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad payload", { status: 400 });
        }
        if (!payload.data) return new Response("Bad payload", { status: 400 });

        const expected = createHmac("sha256", secret)
          .update(JSON.stringify(payload.data))
          .digest("hex");
        const provided = request.headers.get("x-korapay-signature") ?? "";
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const reference = String(payload.data["reference"] ?? "");
        if (!reference) return new Response("Missing reference", { status: 400 });

        const event = String(payload.event ?? "");
        const outcome: "success" | "failed" | null = event.endsWith("success")
          ? "success"
          : event.endsWith("failed") || event.endsWith("expired")
            ? "failed"
            : null;
        if (!outcome) return Response.json({ ok: true, ignored: event });

        try {
          const { settleDeposit } = await import("@/lib/korapay.server");
          await settleDeposit(
            reference,
            (payload.data["transaction_reference"] as string | undefined) ?? null,
            outcome,
          );
        } catch (err) {
          console.error("[korapay-webhook] settle failed", err);
          return new Response("Could not process", { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
