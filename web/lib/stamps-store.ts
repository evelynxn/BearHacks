export type LocalStamp = {
  id: string;
  path: string;
  title: string;
  owner: string;
  color: "pink" | "olive" | "blue" | "soft";
  createdAt: string;
};

const STAMPS_JSON = "/stamps-collection.json";

export async function loadStamps(): Promise<LocalStamp[]> {
  try {
    const res = await fetch(STAMPS_JSON);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function saveStamp(stamp: LocalStamp): Promise<void> {
  await fetch("/api/stamps-collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(stamp),
  });
}

export async function deleteStamp(id: string): Promise<void> {
  await fetch("/api/stamps-collection", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}
