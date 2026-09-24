/**
 * The deposit a customer is asked for when booking a service online, in minor
 * units - or 0 when none is taken.
 *
 * Mirrors `app.settle_deposit_state` so the booking page can say "10 € now"
 * before the database says the same thing. The database stays the authority:
 * if the two ever disagree, the booking carries what Postgres decided.
 */
export function effectiveDepositCents(
  service: { requiresDeposit: boolean; depositCents: number; priceCents: number },
  depositsEnabled: boolean,
) {
  if (!depositsEnabled || !service.requiresDeposit || service.depositCents <= 0) {
    return 0;
  }
  return Math.min(service.depositCents, service.priceCents);
}
