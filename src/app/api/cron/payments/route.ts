import { refuseUnlessCron } from "@/lib/cron-auth";
import { runPaymentsMaintenance } from "@/lib/payments/deposits";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Releases slots held for deposits nobody paid, and issues the refunds that
 * cancellations queued. The webhook does most of this as it happens; this is
 * what makes it true even when a webhook never arrives.
 */
export async function GET(request: Request) {
  const refused = refuseUnlessCron(request);
  if (refused) return refused;

  try {
    const report = await runPaymentsMaintenance(20);
    return Response.json({ ok: true, ...report });
  } catch (cause) {
    console.error("payments maintenance failed", cause);
    return Response.json({ ok: false, error: "worker_failed" }, { status: 500 });
  }
}
