# Roadmap

- [x] Fix wallet balance not being debited on withdrawal and investment (profile guard trigger was silently reverting balance changes)
- [x] Reconcile existing balances and total_invested from the transaction ledger
- [x] Stop admin withdrawal approval from double-logging a withdrawal transaction
- [x] Replace the customer dashboard with a clean mobile-first USD/XAF overview
- [x] Replace the login and registration screens and remove app-download prompts
- [x] Remove public deposit and withdrawal activity alerts
- [x] Add an animated trading bot panel driven by real customer profit data
- [ ] Rework login and registration into compact mobile-first screens
- [ ] Keep registration fully visible without page scrolling
- [ ] Remove the withdrawal PIN everywhere (database, registration, withdrawal, profile, reset page)
- [ ] Save payout accounts and show "Add another account" instead of the always-open form
- [ ] Redesign the profile page in the obsidian and gold style
- [ ] Rebuild the deposit flow: every step a single no-scroll mobile page
- [ ] Deposit proof is upload only — no transaction ID field anywhere
- [ ] Make the payment processing page lively and animated on one no-scroll screen
