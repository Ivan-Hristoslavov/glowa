import { after } from "next/server";

import { refuseUnlessCron } from "@/lib/cron-auth";
import { runNotificationWorker } from "@/lib/notifications/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Drains the notification outbox. Driven by a scheduler (Vercel Cron, or any
 * HTTP caller holding the secret) rather than a long-lived process, so the
 * queue survives a deploy and a cold start costs nothing.
 *
 * The endpoint is public in the routing sense, so the secret is the whole
 * authorization: without a matching bearer token it answers 401 and does no
 * work. `CRON_SECRET` is server-only and must never be given a NEXT_PUBLIC_
 * prefix.
 */
export async function GET(request: Request) {
  const refused = refuseUnlessCron(request);
  if (refused) return refused;

  try {
    const report = await runNotificationWorker(50);
    return Response.json({ ok: true, ...report });
  } catch (cause) {
    console.error("notification worker failed", cause);
    return Response.json({ ok: false, error: "worker_failed" }, { status: 500 });
  }
}

/**
 * Lets a successful booking nudge the queue without waiting for the next cron
 * tick, so a confirmation arrives in seconds. Same secret, same work.
 */
export async function POST(request: Request) {
  const response = await GET(request);
  if (response.status === 200) {
    after(async () => {
      // A second pass catches anything enqueued while the first was running.
      await runNotificationWorker(50).catch(() => undefined);
    });
  }
  return response;
}
