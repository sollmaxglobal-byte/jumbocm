import { createFileRoute } from "@tanstack/react-router";

/**
 * MacroDroid polls this endpoint.
 *
 * Default (no query param): JSON `{claimed, code, ...}` / `{claimed:false}`.
 * `?mode=check` — plain text `true`/`false`, does NOT claim anything.
 * `?mode=code`  — plain text: the ready-to-dial USSD code, or `NONE`.
 *
 * The phone macro uses `?mode=check` first (so it can branch on a plain string
 * instead of MacroDroid's unreliable JSON dictionary magic text), then `?mode=code`.
 */
async function handle(request: Request) {
  const { secretMatches } = await import("@/lib/deposit-verify.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { claimNext, hasEligible } = await import("@/lib/withdraw-auto.server");
  const mode = new URL(request.url).searchParams.get("mode");

  let bodySecret: string | null = null;
  if (request.method === "POST") {
    try {
      const body = (await request.json()) as { secret?: string };
      bodySecret = typeof body?.secret === "string" ? body.secret : null;
    } catch {
      bodySecret = null;
    }
  }
  const authorization = request.headers.get("authorization");
  const provided =
    request.headers.get("x-mm-secret")?.trim() ||
    (authorization ? authorization.replace(/^Bearer\s+/i, "").trim() : "") ||
    bodySecret?.trim() ||
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

  try {
    if (mode === "check") {
      const ok = await hasEligible();
      return new Response(ok ? "true" : "false", {
        headers: { "content-type": "text/plain" },
      });
    }
    const result = await claimNext();
    if (mode === "code") {
      return new Response(result.claimed ? result.code : "NONE", {
        headers: { "content-type": "text/plain" },
      });
    }
    return Response.json(result);
  } catch (err) {
    console.error("[withdraw-queue] failed", err);
    return new Response(JSON.stringify({ error: "Could not read the queue" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export const Route = createFileRoute("/api/public/withdraw-queue")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
