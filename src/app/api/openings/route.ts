import { listOpenings } from "@/lib/queries/openings";

/**
 * Public, the same for every visitor, and allowed to be two minutes old: the
 * client drops anything that has started since, and booking re-checks the slot
 * anyway. Cached, it costs the database one round per two minutes instead of
 * one per landing-page view.
 */
export const revalidate = 120;

export async function GET() {
  try {
    const openings = await listOpenings();
    return Response.json({ openings });
  } catch {
    return Response.json({ openings: [] }, { status: 200 });
  }
}
