const BASE =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:3000";

async function apiFetch(
  path: string,
  opts: RequestInit & { userId?: string } = {}
) {
  const { userId, ...fetchOpts } = opts;
  const headers: Record<string, string> = {
    ...(fetchOpts.headers as Record<string, string>),
  };
  if (userId) headers["x-user-id"] = userId;

  const res = await fetch(`${BASE}${path}`, { ...fetchOpts, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API ${res.status}`);
  }
  return res;
}

/** Fetch published journal entries for the feed. */
export async function fetchFeed(userId: string, days = 30) {
  const res = await apiFetch(`/api/feed?days=${days}`, { userId });
  const data = await res.json();
  return data.entries as Array<{
    JOURNAL_DATE: string;
    NARRATIVE_TEXT: string;
    IS_READY: boolean;
  }>;
}

/** Fetch today's fragments (for the create/edit view). */
export async function fetchFragments(userId: string, date: string) {
  const res = await apiFetch(`/api/fragments/${date}`, { userId });
  const data = await res.json();
  return data.fragments as Array<{
    USER_ID: string;
    EVENT_TYPE: string;
    CONTENT: string;
    CREATED_AT: string;
  }>;
}

/** Fetch draft journal for a date. */
export async function fetchDraft(userId: string, date: string) {
  const res = await apiFetch(`/api/journal/${date}/draft`, { userId });
  return (await res.json()) as { narrative: string };
}

/** Update journal narrative text. */
export async function updateNarrative(
  userId: string,
  date: string,
  narrative: string
) {
  await apiFetch(`/api/journal/${date}`, {
    userId,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ narrative }),
  });
}

/** Upload an image for context extraction. */
export async function uploadImage(userId: string, file: File) {
  const form = new FormData();
  form.append("image", file);
  const res = await apiFetch(`/api/client/image`, {
    userId,
    method: "POST",
    body: form,
  });
  return res.json();
}

/** Delete a single fragment. */
export async function deleteFragment(
  userId: string,
  date: string,
  fragmentId: string
) {
  await apiFetch(`/api/fragments/${date}/${fragmentId}`, {
    userId,
    method: "DELETE",
  });
}

/** Edit a fragment's text. */
export async function editFragment(
  userId: string,
  date: string,
  fragmentId: string,
  text: string
) {
  await apiFetch(`/api/fragments/${date}/${fragmentId}`, {
    userId,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

/** Publish a draft journal (set IS_READY=TRUE). */
export async function publishJournal(userId: string, date: string) {
  await apiFetch(`/api/orchestrate/publish`, {
    userId,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });
}

// ── Stamps ────────────────────────────────────────────────────────────

/** Upload an image as a new stamp. */
export async function createStamp(userId: string, file: File, label: string) {
  const form = new FormData();
  form.append("image", file);
  form.append("label", label);
  const res = await apiFetch(`/api/stamps`, {
    userId,
    method: "POST",
    body: form,
  });
  return res.json() as Promise<{ ok: boolean; image_url: string; label: string }>;
}

/** Fetch all stamps for the user. */
export async function fetchStamps(userId: string) {
  const res = await apiFetch(`/api/stamps`, { userId });
  const data = await res.json();
  return data.stamps as Array<{
    ID: string;
    USER_ID: string;
    IMAGE_URL: string;
    LABEL: string;
    CREATED_AT: string;
  }>;
}

/** Delete a stamp by ID. */
export async function deleteStampApi(userId: string, stampId: string) {
  await apiFetch(`/api/stamps/${stampId}`, { userId, method: "DELETE" });
}

// ── Likes ─────────────────────────────────────────────────────────────

/** Like a journal entry. */
export async function likeEntry(userId: string, targetUserId: string, targetDate: string) {
  await apiFetch(`/api/likes`, {
    userId,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_user_id: targetUserId, target_date: targetDate }),
  });
}

/** Unlike a journal entry. */
export async function unlikeEntry(userId: string, targetUserId: string, targetDate: string) {
  await apiFetch(`/api/likes`, {
    userId,
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_user_id: targetUserId, target_date: targetDate }),
  });
}

/** Fetch all likes for the user. */
export async function fetchLikes(userId: string) {
  const res = await apiFetch(`/api/likes`, { userId });
  const data = await res.json();
  return data.likes as Array<{
    USER_ID: string;
    TARGET_USER_ID: string;
    TARGET_JOURNAL_DATE: string;
    CREATED_AT: string;
  }>;
}

// ── Profile slots ─────────────────────────────────────────────────────

/** Get profile stamp slots. */
export async function fetchProfileSlots(userId: string) {
  const res = await apiFetch(`/api/profile/slots`, { userId });
  const data = await res.json();
  return data.slots as Array<{
    SLOT_INDEX: number;
    STAMP_ID: string;
    IMAGE_URL: string;
  }>;
}

/** Set a profile slot to a stamp. */
export async function setProfileSlot(userId: string, slotIndex: number, stampId: string) {
  await apiFetch(`/api/profile/slots/${slotIndex}`, {
    userId,
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stamp_id: stampId }),
  });
}
