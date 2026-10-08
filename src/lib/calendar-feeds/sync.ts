import "server-only";

import { FetchFailure, safeRequest, UnsafeUrlError } from "@/lib/net/safe-fetch";
import { createAdminClient } from "@/lib/supabase/admin";

import { parseBusyBlocks } from "./parse";

export type FeedErrorCode =
  | "unsafe_url"
  | "timeout"
  | "too_large"
  | "network"
  | "not_calendar"
  | `http_${number}`;

const DAYS_BEFORE = 1;
const DAYS_AFTER = 120;

type Feed = { id: string; url: string; business_id: string };

/**
 * Copies a salon's own calendar into Lavena as busy time for one stylist.
 * A failed fetch keeps whatever was copied before and records why: showing a
 * stylist as free because a link broke would invite double bookings.
 */
export async function syncCalendarFeed(feed: Feed): Promise<{ ok: true; count: number } | { ok: false; error: FeedErrorCode }> {
  const db = createAdminClient();

  const fail = async (error: FeedErrorCode) => {
    await db.rpc("apply_calendar_feed", { p_feed_id: feed.id, p_blocks: [], p_error: error });
    return { ok: false, error } as const;
  };

  const { data: business } = await db
    .from("businesses")
    .select("timezone")
    .eq("id", feed.business_id)
    .maybeSingle();

  let text: string;
  try {
    const response = await safeRequest(feed.url, {
      method: "GET",
      timeoutMs: 15_000,
      maxBytes: 5_000_000,
      headers: { Accept: "text/calendar, text/plain;q=0.5", "User-Agent": "Lavena-Calendar/1" },
    });
    if (response.status !== 200) return fail(`http_${response.status}`);
    text = response.body;
  } catch (cause) {
    if (cause instanceof UnsafeUrlError) return fail("unsafe_url");
    if (cause instanceof FetchFailure) return fail(cause.code);
    return fail("network");
  }

  const now = Date.now();
  let blocks;
  try {
    blocks = parseBusyBlocks(text, {
      timezone: business?.timezone ?? "Europe/Sofia",
      windowStart: new Date(now - DAYS_BEFORE * 86_400_000),
      windowEnd: new Date(now + DAYS_AFTER * 86_400_000),
    });
  } catch {
    return fail("not_calendar");
  }

  const { data: count, error } = await db.rpc("apply_calendar_feed", {
    p_feed_id: feed.id,
    p_blocks: blocks,
  });
  if (error) return fail("network");
  return { ok: true, count: count ?? blocks.length };
}

export type FeedSyncReport = { checked: number; synced: number; failed: number };

/** Oldest-synced first, a few at a time, so one slow server cannot hold the rest. */
export async function runCalendarFeedSync(limit = 20): Promise<FeedSyncReport> {
  const db = createAdminClient();
  const { data: feeds } = await db
    .from("calendar_feeds")
    .select("id, url, business_id")
    .eq("is_active", true)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  const report: FeedSyncReport = { checked: 0, synced: 0, failed: 0 };
  const list = feeds ?? [];
  for (let i = 0; i < list.length; i += 5) {
    const results = await Promise.all(list.slice(i, i + 5).map((feed) => syncCalendarFeed(feed)));
    for (const result of results) {
      report.checked += 1;
      if (result.ok) report.synced += 1;
      else report.failed += 1;
    }
  }
  return report;
}
