"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, Suspense } from "react";
import CutoutFrame from "../../../components/CutoutFrame";
import Stamp from "../../../components/Stamp";
import { createStamp, fetchDraft } from "../../../lib/api";
import { appendFeedEntry } from "../../../lib/feed-store";
import { saveStamp } from "../../../lib/stamps-store";

type Tool = "select" | "stamp" | "text" | "image";

type CanvasElement =
  | { id: string; type: "text"; x: number; y: number; value: string }
  | { id: string; type: "stamp"; x: number; y: number; color: "dark" | "pink" | "olive" }
  | { id: string; type: "image"; x: number; y: number; src: string; w: number; h: number; file?: File };

function CreateEditorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("type") ?? "stamp"; // "stamp" | "postcard"

  const isStampMode = mode === "stamp";
  const isPostcardMode = mode === "postcard";

  // ── Stamp mode state ──────────────────────────────────────────────
  const [stampFile, setStampFile] = useState<File | null>(null);
  const [stampPreview, setStampPreview] = useState<string | null>(null);
  const [stampName, setStampName] = useState("");
  const [saving, setSaving] = useState(false);
  const stampFileRef = useRef<HTMLInputElement>(null);

  // ── Postcard mode state ───────────────────────────────────────────
  const [tool, setTool] = useState<Tool>("select");
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [journalText, setJournalText] = useState<string | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null);

  // Postcard: fetch daily journal
  useEffect(() => {
    if (!isPostcardMode) return;
    setJournalLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const userId = localStorage.getItem("stampi_user_id") ?? "demo-user";
    fetchDraft(userId, today)
      .then((d) => setJournalText(d.narrative))
      .catch(() => setJournalText(null))
      .finally(() => setJournalLoading(false));
  }, [isPostcardMode]);

  // ── Stamp mode: image pick ────────────────────────────────────────
  const handleStampPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setStampFile(file);
    const reader = new FileReader();
    reader.onload = () => setStampPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleStampSave = async () => {
    if (!stampFile || saving) return;
    setSaving(true);
    const userId = localStorage.getItem("stampi_user_id") ?? "demo-user";
    try {
      // 1. Save image to public/stamps/ via local API
      let imagePath = "/stamps/sample-1.svg";
      try {
        const uploadForm = new FormData();
        uploadForm.append("image", stampFile);
        const uploadRes = await fetch("/api/upload-stamp", { method: "POST", body: uploadForm });
        const uploadData = await uploadRes.json();
        if (uploadData.path) imagePath = uploadData.path;
      } catch {
        imagePath = stampPreview ?? imagePath;
      }

      // 2. Hit Gemma for a label
      let gemmaLabel = "";
      try {
        const result = await createStamp(userId, stampFile, stampName.trim());
        if (result.label) gemmaLabel = result.label;
      } catch { /* orchestrator offline */ }

      const title = stampName.trim() || gemmaLabel || "New stamp";

      // 3. Save to local stamp collection (NOT feed)
      await saveStamp({
        id: `stamp-${Date.now()}`,
        path: imagePath,
        title,
        owner: userId,
        color: (["pink", "olive", "soft"] as const)[Math.floor(Math.random() * 3)],
        createdAt: new Date().toISOString(),
      });

      router.push("/create");
    } catch (err) {
      console.error("Save failed:", err);
      router.push("/create");
    } finally {
      setSaving(false);
    }
  };

  // ── Stamp mode UI ─────────────────────────────────────────────────
  if (isStampMode) {
    return (
      <main
        style={{
          position: "relative",
          minHeight: "100vh",
          background: "var(--cream)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 22px",
            width: "100%",
            maxWidth: 800,
          }}
        >
          <button
            onClick={() => router.back()}
            aria-label="Back"
            style={{ fontSize: 22, color: "var(--brown)" }}
          >
            &larr;
          </button>
          <span style={{ fontSize: 16, fontWeight: 500, color: "var(--brown)", opacity: 0.6 }}>
            New Stamp
          </span>
          <div style={{ width: 50 }} />
        </div>

        <input
          ref={stampFileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleStampPick}
        />

        {/* No image yet — show upload prompt */}
        {!stampPreview && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 20,
              padding: "60px 24px",
            }}
          >
            <div style={{ fontSize: 60, opacity: 0.3 }}>📷</div>
            <button
              onClick={() => stampFileRef.current?.click()}
              className="float-up"
              style={{
                padding: "16px 40px",
                background: "var(--olive)",
                color: "white",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 600,
                boxShadow: "0 4px 16px rgba(164,164,92,0.25)",
                transition: "transform 200ms ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.04)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              Choose a Photo
            </button>
            <span style={{ fontSize: 14, opacity: 0.4, color: "var(--brown)" }}>
              Your photo will be cut into a stamp shape
            </span>
          </div>
        )}

        {/* Image selected — show cutout preview + actions */}
        {stampPreview && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 28,
              padding: "40px 24px",
            }}
          >
            <div className="stamp-down">
              <CutoutFrame width={260} height={300} rotate={2}>
                <img
                  src={stampPreview}
                  alt="Stamp preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </CutoutFrame>
            </div>

            {/* Stamp name */}
            <input
              type="text"
              placeholder="Name your stamp..."
              value={stampName}
              onChange={(e) => setStampName(e.target.value)}
              style={{
                width: "100%",
                maxWidth: 260,
                padding: "10px 16px",
                border: "1.5px solid rgba(74,45,38,0.15)",
                borderRadius: 12,
                background: "transparent",
                fontSize: 15,
                color: "var(--brown)",
                textAlign: "center",
                outline: "none",
                fontFamily: "inherit",
                transition: "border-color 200ms ease",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--olive)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(74,45,38,0.15)"; }}
            />

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 14 }}>
              <button
                onClick={() => {
                  setStampFile(null);
                  setStampPreview(null);
                  router.back();
                }}
                style={{
                  padding: "12px 28px",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--brown)",
                  border: "1.5px solid var(--brown)",
                  background: "transparent",
                  transition: "background 200ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(74,45,38,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Cancel
              </button>
              <button
                onClick={() => stampFileRef.current?.click()}
                style={{
                  padding: "12px 28px",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 500,
                  color: "var(--brown)",
                  border: "1.5px solid var(--brown)",
                  background: "transparent",
                  transition: "background 200ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(74,45,38,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                New Photo
              </button>
              <button
                onClick={handleStampSave}
                disabled={saving}
                style={{
                  padding: "12px 32px",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 600,
                  color: "white",
                  background: saving ? "var(--brown-light)" : "var(--olive)",
                  opacity: saving ? 0.6 : 1,
                  boxShadow: "0 4px 14px rgba(164,164,92,0.3)",
                  transition: "transform 200ms ease",
                }}
                onMouseEnter={(e) => { if (!saving) e.currentTarget.style.transform = "scale(1.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ── Postcard mode ─────────────────────────────────────────────────

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || tool === "select" || tool === "image") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "stamp") {
      const colors = ["dark", "pink", "olive"] as const;
      setElements((els) => [
        ...els,
        {
          id: crypto.randomUUID(),
          type: "stamp",
          x,
          y,
          color: colors[els.filter((el) => el.type === "stamp").length % 3],
        },
      ]);
    } else if (tool === "text") {
      const id = crypto.randomUUID();
      setElements((els) => [...els, { id, type: "text", x, y, value: "" }]);
      setEditingId(id);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 200;
        const scale = maxW / img.width;
        setElements((els) => [
          ...els,
          { id: crypto.randomUUID(), type: "image", x: 40, y: 40, src: reader.result as string, w: maxW, h: img.height * scale, file },
        ]);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeElement = (id: string) => setElements((els) => els.filter((el) => el.id !== id));

  const handleDragStart = (id: string, clientX: number, clientY: number) => {
    if (tool !== "select") return;
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    dragging.current = { id, startX: clientX, startY: clientY, elX: el.x, elY: el.y };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!dragging.current) return;
    const dx = clientX - dragging.current.startX;
    const dy = clientY - dragging.current.startY;
    setElements((els) =>
      els.map((el) =>
        el.id === dragging.current!.id
          ? { ...el, x: dragging.current!.elX + dx, y: dragging.current!.elY + dy }
          : el
      )
    );
  };

  const handleDragEnd = () => { dragging.current = null; };

  const handlePostcardSave = async () => {
    if (saving) return;
    setSaving(true);
    const userId = localStorage.getItem("stampi_user_id") ?? "demo-user";
    try {
      // Save each image element as a stamp + get Gemma label
      const imageEls = elements.filter((el) => el.type === "image") as Array<CanvasElement & { type: "image" }>;
      let gemmaLabel = "";
      for (const el of imageEls) {
        if (el.file) {
          try {
            const result = await createStamp(userId, el.file, "");
            if (!gemmaLabel && result.label) gemmaLabel = result.label;
          } catch { /* orchestrator offline */ }
        }
      }

      // Create a feed entry for the postcard
      const now = new Date();
      const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const date = `Today, ${time}`;
      const firstImage = imageEls[0];
      let imagePath = "/stamps/sample-2.svg";
      if (firstImage?.file) {
        try {
          const uploadForm = new FormData();
          uploadForm.append("image", firstImage.file);
          const uploadRes = await fetch("/api/upload-stamp", { method: "POST", body: uploadForm });
          const uploadData = await uploadRes.json();
          if (uploadData.path) imagePath = uploadData.path;
        } catch { /* upload API unavailable */ }
      }

      await appendFeedEntry({
        id: `e-${Date.now()}`,
        time,
        date,
        title: gemmaLabel || "New post card",
        body: journalText ?? "",
        color: (["pink", "olive", "soft"] as const)[Math.floor(Math.random() * 3)],
        stampImage: imagePath,
        owner: userId,
      });

      router.push("/feed");
    } catch (err) {
      console.error("Save failed:", err);
      router.push("/feed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 22px",
          width: "100%",
          maxWidth: 800,
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ fontSize: 22, color: "var(--brown)", transition: "transform 200ms ease" }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = "translateX(-3px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = "translateX(0)"; }}
        >
          &larr;
        </button>
        <span style={{ fontSize: 16, fontWeight: 500, color: "var(--brown)", opacity: 0.6 }}>
          New Post Card
        </span>
        <button
          onClick={handlePostcardSave}
          disabled={saving}
          aria-label="Save"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "white",
            background: saving ? "var(--brown-light)" : "var(--olive)",
            padding: "8px 18px",
            borderRadius: 999,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Today's journal */}
      <div
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 18px 12px",
          padding: "16px 20px",
          background: "var(--pink-soft)",
          borderRadius: 12,
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--brown)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, opacity: 0.6 }}>
          Today&apos;s Journal
        </div>
        {journalLoading ? (
          <span style={{ opacity: 0.5 }}>Loading journal...</span>
        ) : journalText ? (
          <p style={{ margin: 0 }}>{journalText}</p>
        ) : (
          <span style={{ opacity: 0.5 }}>
            No journal entries yet today. Record some via your Stampy companion device or add them here.
          </span>
        )}
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchMove={(e) => { const t = e.touches[0]; handleDragMove(t.clientX, t.clientY); }}
        onTouchEnd={handleDragEnd}
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 760,
          margin: "0 18px",
          minHeight: 500,
          background: "var(--cream-light)",
          borderRadius: 12,
          position: "relative",
          overflow: "hidden",
          cursor: tool === "select" ? (dragging.current ? "grabbing" : "default") : tool === "image" ? "default" : "crosshair",
          boxShadow: "inset 0 2px 8px rgba(60,35,28,0.06)",
        }}
      >
        {elements.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              opacity: 0.35,
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 40 }}>✦</span>
            <span style={{ fontSize: 15, color: "var(--brown)" }}>
              Tap to add stamps and text, or upload a photo
            </span>
          </div>
        )}

        {elements.map((el) => {
          if (el.type === "stamp") {
            return (
              <div
                key={el.id}
                className="stamp-down"
                style={{ position: "absolute", left: el.x - 30, top: el.y - 35, cursor: tool === "select" ? "grab" : "default" }}
                onDoubleClick={() => removeElement(el.id)}
                onMouseDown={(e) => { e.stopPropagation(); handleDragStart(el.id, e.clientX, e.clientY); }}
                onTouchStart={(e) => { const t = e.touches[0]; handleDragStart(el.id, t.clientX, t.clientY); }}
              >
                <Stamp color={el.color} size={60} />
              </div>
            );
          }
          if (el.type === "image") {
            return (
              <div
                key={el.id}
                className="pop-in"
                style={{ position: "absolute", left: el.x, top: el.y, cursor: tool === "select" ? "grab" : "default" }}
                onDoubleClick={() => removeElement(el.id)}
                onMouseDown={(e) => { e.stopPropagation(); handleDragStart(el.id, e.clientX, e.clientY); }}
                onTouchStart={(e) => { const t = e.touches[0]; handleDragStart(el.id, t.clientX, t.clientY); }}
              >
                <CutoutFrame width={el.w} height={el.h} rotate={Math.random() * 6 - 3}>
                  <img src={el.src} alt="uploaded" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </CutoutFrame>
              </div>
            );
          }
          return (
            <div
              key={el.id}
              style={{ position: "absolute", left: el.x, top: el.y - 10, cursor: tool === "select" ? "grab" : "default" }}
              onDoubleClick={() => removeElement(el.id)}
              onMouseDown={(e) => { e.stopPropagation(); handleDragStart(el.id, e.clientX, e.clientY); }}
              onTouchStart={(e) => { const t = e.touches[0]; handleDragStart(el.id, t.clientX, t.clientY); }}
            >
              {editingId === el.id ? (
                <input
                  autoFocus
                  defaultValue={el.value}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (!val) { removeElement(el.id); } else {
                      setElements((els) => els.map((item) => item.id === el.id && item.type === "text" ? { ...item, value: val } : item));
                    }
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  style={{ background: "transparent", border: "none", borderBottom: "1.5px solid var(--olive)", fontSize: 16, color: "var(--brown)", outline: "none", minWidth: 80, fontFamily: "inherit" }}
                />
              ) : (
                <span onClick={() => setEditingId(el.id)} style={{ fontSize: 16, color: "var(--brown)", cursor: "text" }}>
                  {el.value || "Click to type"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />

      {/* Toolbar */}
      <div
        style={{
          margin: "16px 18px 22px",
          padding: "14px 20px",
          background: "rgba(164,164,92,0.25)",
          borderRadius: 20,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          gap: 8,
          maxWidth: 400,
          width: "100%",
          backdropFilter: "blur(8px)",
        }}
      >
        <ToolBtn icon="☺" label="Stamp" active={tool === "stamp"} onClick={() => setTool("stamp")} />
        <ToolBtn icon="T" label="Text" active={tool === "text"} onClick={() => setTool("text")} />
        <ToolBtn icon="🖼" label="Photo" active={tool === "image"} onClick={() => { setTool("image"); fileRef.current?.click(); }} />
        <ToolBtn icon="↕" label="Select" active={tool === "select"} onClick={() => setTool("select")} />
      </div>
    </main>
  );
}

export default function CreateEditor() {
  return (
    <Suspense>
      <CreateEditorInner />
    </Suspense>
  );
}

function ToolBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        padding: "8px 14px",
        borderRadius: 12,
        fontSize: 20,
        color: "var(--brown)",
        background: active ? "rgba(245,236,221,0.7)" : "transparent",
        transition: "background 200ms, transform 200ms",
        transform: active ? "scale(1.05)" : "scale(1)",
      }}
    >
      <span>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>{label}</span>
    </button>
  );
}
