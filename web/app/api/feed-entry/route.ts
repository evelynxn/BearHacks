import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FEED_PATH = path.join(process.cwd(), "public", "feed-data.json");

export async function POST(req: NextRequest) {
  const entry = await req.json();

  let entries = [];
  try {
    const raw = fs.readFileSync(FEED_PATH, "utf-8");
    entries = JSON.parse(raw);
  } catch {
    entries = [];
  }

  entries.unshift(entry);
  fs.writeFileSync(FEED_PATH, JSON.stringify(entries, null, 2));

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  let entries = [];
  try {
    const raw = fs.readFileSync(FEED_PATH, "utf-8");
    entries = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const before = entries.length;
  entries = entries.filter((e: { id: string }) => e.id !== id);
  if (entries.length === before) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  fs.writeFileSync(FEED_PATH, JSON.stringify(entries, null, 2));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const { id, title } = await req.json();

  let entries = [];
  try {
    const raw = fs.readFileSync(FEED_PATH, "utf-8");
    entries = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const entry = entries.find((e: { id: string }) => e.id === id);
  if (!entry) return NextResponse.json({ ok: false }, { status: 404 });

  entry.title = title;
  fs.writeFileSync(FEED_PATH, JSON.stringify(entries, null, 2));

  return NextResponse.json({ ok: true });
}
