import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STAMPS_DIR = path.join(process.cwd(), "public", "stamps");

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "png";
  const filename = `stamp-${Date.now()}.${ext}`;
  const filePath = path.join(STAMPS_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  return NextResponse.json({ ok: true, path: `/stamps/${filename}` });
}
