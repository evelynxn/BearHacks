import { FeedEntry, fallbackEntries } from "./mock-data";

const FEED_JSON_PATH = "/feed-data.json";

/** Load feed entries from the public JSON file. Falls back to hardcoded data. */
export async function loadFeedEntries(): Promise<FeedEntry[]> {
  try {
    const res = await fetch(FEED_JSON_PATH);
    if (!res.ok) return fallbackEntries;
    const data: FeedEntry[] = await res.json();
    return data.length > 0 ? data : fallbackEntries;
  } catch {
    return fallbackEntries;
  }
}

/**
 * Append a new entry to the feed JSON.
 * In dev, this writes to the public JSON via a Next.js API route.
 * The stamp image should already be saved to public/stamps/.
 */
export async function appendFeedEntry(entry: FeedEntry): Promise<void> {
  await fetch("/api/feed-entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}
