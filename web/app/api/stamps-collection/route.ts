import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STAMPS_PATH = path.join(process.cwd(), "public", "stamps-collection.json");

function readStamps() {
  try {
    return JSON.parse(fs.readFileSync(STAMPS_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function writeStamps(stamps: unknown[]) {
  fs.writeFileSync(STAMPS_PATH, JSON.stringify(stamps, null, 2));
}

export async function POST(req: NextRequest) {
  const stamp = await req.json();
  const stamps = readStamps();
  stamps.unshift(stamp);
  writeStamps(stamps);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const stamps = readStamps();
  const filtered = stamps.filter((s: { id: string }) => s.id !== id);
  writeStamps(filtered);
  return NextResponse.json({ ok: true });
}
