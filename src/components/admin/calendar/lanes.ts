/**
 * Side-by-side layout for appointments that overlap in one column - the way
 * every desktop calendar draws a busy afternoon. Without it, two stylists
 * booked at 10:00 in the week view were drawn on top of each other and the
 * one underneath simply disappeared.
 *
 * Items are grouped into clusters of transitively-overlapping intervals; each
 * item takes the first free lane in its cluster, and every item in a cluster
 * shares the cluster's lane count so their widths line up.
 */
export type LaneItem = { id: string; start: number; end: number };
export type Lane = { lane: number; lanes: number };

export function layoutLanes(items: LaneItem[]): Map<string, Lane> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, Lane>();

  let cluster: Array<{ id: string; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  function flush() {
    const lanes = laneEnds.length || 1;
    for (const entry of cluster) result.set(entry.id, { lane: entry.lane, lanes });
    cluster = [];
    laneEnds = [];
  }

  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ id: item.id, lane });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();

  return result;
}

/**
 * One fixed track per stylist, for the week view with the whole team. Each
 * stylist keeps the same place on every day, so a column reads as swim lanes
 * instead of a staircase that reshuffles with every overlap.
 *
 * A stylist cannot be double-booked, so tracks do not overlap - except when
 * cancelled visits are shown beside the booking that replaced them. Then, or
 * when an item has no stylist in `order`, the column falls back to
 * `layoutLanes`.
 */
export function staffTracks(
  items: Array<LaneItem & { staffId: string | null }>,
  order: readonly string[],
): Map<string, Lane> {
  const byStaff = new Map<string, LaneItem[]>();
  for (const item of items) {
    if (!item.staffId || !order.includes(item.staffId)) return layoutLanes(items);
    const list = byStaff.get(item.staffId) ?? [];
    list.push(item);
    byStaff.set(item.staffId, list);
  }
  for (const list of byStaff.values()) {
    const sorted = [...list].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start < sorted[i - 1].end) return layoutLanes(items);
    }
  }

  const result = new Map<string, Lane>();
  for (const item of items) {
    result.set(item.id, { lane: order.indexOf(item.staffId as string), lanes: order.length });
  }
  return result;
}
