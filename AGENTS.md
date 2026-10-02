- Customer dashboard money summaries show **USD as the primary figure with the XAF value underneath** at the indicative 1 USD = 600 XAF rate. Account records stay denominated in XAF; USD is a display conversion only. Use the shared `DualMoney` component (`src/components/DualMoney.tsx`) with `primary="usd"` and the `XAF_PER_USD`/`formatUSD`/`formatXAF` helpers in `src/lib/format.ts` rather than re-declaring the rate or a local formatter.
- Crypto deposits use NOWPayments (hosted invoice + IPN). Admin-configured `nowpayments_enabled` / `nowpayments_api_key` / `nowpayments_ipn_secret` live in `app_settings`; the IPN endpoint is `/api/public/nowpayments-webhook` and settlement goes through the `settle_nowpayments_deposit` RPC. The `public_settings` view exposes only `nowpayments_enabled`. These require migration `supabase/migrations/20261002030000_add_nowpayments.sql`; without it the admin crypto fields and the deposit "Pay with crypto" option stay hidden and the settings save falls back gracefully.
- Trading-bot status and profit figures must be derived from the customer's active investments and recorded profit transactions; never simulate activity or earnings.
- Third-party chat widgets load only from validated public identifiers saved by an administrator, preventing arbitrary embed code execution.

## Dev environment (Base44)

- TanStack Start SSR app (Vite 8 + React 19 + Tailwind 4) using Bun as the package manager.
- The Vite dev server listens on port 5173 inside the container; compose maps host 3000 → container 5173.
- Source is bind-mounted at `/app`; `bun install --frozen-lockfile` runs on container start before `bun run dev`.
- The committed `.env` contains public Supabase credentials (URL + publishable key) — enough to boot and render pages.
- `SUPABASE_SERVICE_ROLE_KEY` is required for admin/server-side operations (deposit settlement, push, email) but not for booting.
- Remote Supabase is used for both auth and data; no local database service is needed.
- `bunfig.toml` sets a 24h `minimumReleaseAge` supply-chain guard; `--frozen-lockfile` installs from the existing lockfile without issue.
- Keep the direct React Router and router-plugin pins compatible with React Start when upgrading; mismatched releases can install duplicate router cores.
- Reflected-XSS advisory GHSA-qx66-fv34-fjm8 is patched by `@tanstack/react-start@1.168.60` and its `@tanstack/start-server-core@1.169.39` dependency. Do not use Vercel's dangerous-deployment override instead of the patch.
- Verify the Vercel preset with `docker compose -f docker-compose.base44.yml exec -T -e VERCEL=1 web bun run build`; Nitro emits `.vercel/output/config.json` and the `__server.func` server function. Vercel installs using the frozen Bun lockfile.
- Unauthenticated requests to `/` redirect to `/login`; use `curl -fsSL http://localhost:3000/` to check rendered HTML rather than treating the empty redirect body as a blank page.
- The customer dashboard home (`src/routes/dashboard.index.tsx`) is a real page, not the TanStack scaffold. A regression had replaced it with the `Hello "/dashboard/"!` stub on `main`, so a logged-in user landed on a blank placeholder; restore the real page (dual-currency balance hero + profit/withdrawal cards) if it ever reappears.
- Shared UI must live in `src/components`, not be imported from another route. The dashboard overhaul removed the deposit route's `StatusBadge` export while withdrawals still imported it, causing a production `MISSING_EXPORT`; the original badge now lives in `src/components/StatusBadge.tsx`.
- Deployment verification must include a fresh `bun install --frozen-lockfile`, `VERCEL=1 bun run build`, and requests through the generated `.vercel/output/functions/__server.func/index.mjs` default `fetch` handler. `/login` and `/register` return HTML with forms; `/` returns 307 to `/login`. The existing registry mirror URLs and release-age guard both passed a cache-free install; they were not the reproduced build blocker.
