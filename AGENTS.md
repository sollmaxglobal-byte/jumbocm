- Customer dashboard money summaries use USD as the primary display with XAF equivalents at an indicative 1 USD = 600 XAF rate, because account records remain denominated in XAF.
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
