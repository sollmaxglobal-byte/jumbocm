# Fix: wallet balance is never debited on withdrawal or investment

## What's happening

Withdrawals and investments are recorded correctly (the request rows and the ledger entries are created), but the user's wallet balance stays the same. Confirmed against live data: user `6cd7…f1` has withdrawal holds of 7,600 / 1,000 / 3,000 / 3,800 XAF and an investment of 10,500 XAF logged, yet the profile balance never moved.

## Root cause (verified)

The `profiles` table has **two** BEFORE UPDATE guard triggers, and they fire in name order:

1. `profiles_block_privileged_updates` — respects the `app.bypass_profile_guard` flag that the money functions set, so it correctly lets the debit through.
2. `trg_prevent_profile_privilege_escalation` — fires second and does **not** know about that flag. For any non-admin signed-in session it silently rewrites `NEW.balance := OLD.balance` (and `total_invested`, `total_earned`, `referral_earnings`).

So the debit inside `request_withdrawal` and `activate_investment_v2` is silently discarded. No error is raised — which is why the app reports success while the balance is untouched. Admin actions (like rejecting a withdrawal and refunding) still work, because the trigger exempts admins.

## Secondary issue found

The admin panel inserts a second `withdrawal` ledger row when approving/marking paid, even though a `withdrawal_hold` row already exists for the same request. Live data shows duplicate −7,600 and −1,000 entries. This double-counts in the transaction history.

## The fix

1. **Migration — make the second guard honour the bypass flag.** Update `prevent_profile_privilege_escalation()` so it returns early (allowing the change) when `app.bypass_profile_guard` is `on`, matching the first guard. Role/identity fields stay protected exactly as today; only the flagged, server-side money functions can move balances.
2. **Migration — one-time reconciliation.** Recompute each affected profile's `balance` and `total_invested` from the existing transaction ledger so current users see the correct amounts instead of the inflated ones.
3. **Admin panel — stop double-logging.** In `src/routes/admin.withdrawals.tsx`, don't insert an extra `withdrawal` transaction on approve/paid when a `withdrawal_hold` already exists for that request; just update the status.

## Technical notes

- Change is confined to the trigger function body plus a reconciliation UPDATE; no schema/column changes, no RLS or grant changes.
- `request_withdrawal`, `create_withdrawal`, `activate_investment_v2`, and `reject_withdrawal` themselves are correct and stay as-is.
- After applying, verification: submit a withdrawal and an investment as a normal user and confirm balance decreases and the ledger has exactly one entry per action.
- Task tracked in `roadmap.md` once implementation starts.

## Verification

Re-run a balance-vs-ledger comparison query across all profiles to confirm they match after reconciliation.
