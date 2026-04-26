"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

type Tool = "draw" | "stamp" | "text" | "select";

type Element =
  | { id: string; type: "text"; x: number; y: number; value: string }
  | { id: string; type: "stamp"; x: number; y: number };

// Editor canvas. Mock-only — drawing/upload/etc. are UI-stubs.
// TODO(backend): on save, POST canvas data to /api/client/image as multipart.
export default function CreateEditor() {
  const router = useRouter();
  const [tool, setTool] = useState<Tool>("select");
  const [elements, setElements] = useState<Element[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (tool === "stamp") {
      setElements((els) => [
        ...els,
        { id: crypto.randomUUID(), type: "stamp", x, y }
      ]);
    } else if (tool === "text") {
      setElements((els) => [
        ...els,
        {
          id: crypto.randomUUID(),
          type: "text",
          x,
          y,
          value: "Tap to edit"
        }
      ]);
    }
  };

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "20px 22px"
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ fontSize: 22, color: "var(--brown)" }}
        >
          ←
        </button>
        <button
          onClick={() => {
            // TODO(backend): upload canvas. For now, return to create.
            router.push("/create");
          }}
          aria-label="Save"
          style={{ fontSize: 22, color: "var(--brown)" }}
        >
          ↑
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{
          flex: 1,
          margin: "0 18px",
          background: "var(--cream-light)",
          borderRadius: 8,
          position: "relative",
          overflow: "hidden",
          cursor: tool === "select" ? "default" : "crosshair"
        }}
      >
        {elements.map((el) =>
          el.type === "stamp" ? (
            <div
              key={el.id}
              style={{
                position: "absolute",
                left: el.x - 30,
                top: el.y - 35,
                width: 60,
                height: 70,
                background: "var(--stamp-dark)",
                borderRadius: 4
              }}
            />
          ) : (
            <div
              key={el.id}
              style={{
                position: "absolute",
                left: el.x,
                top: el.y - 10,
                fontSize: 16,
                color: "var(--brown)"
              }}
            >
              {el.value}
            </div>
          )
        )}
      </div>

      {/* Toolbar */}
      <div
        style={{
          margin: "16px 18px 22px",
          padding: "14px 18px",
          background: "rgba(164,164,92,0.35)",
          borderRadius: 18,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          gap: 12
        }}
      >
        <ToolBtn label="✎" active={tool === "draw"} onClick={() => setTool("draw")} />
        <ToolBtn label="☺" active={tool === "stamp"} onClick={() => setTool("stamp")} />
        <ToolBtn label="T" active={tool === "text"} onClick={() => setTool("text")} />
        <ToolBtn label="⌷" active={tool === "select"} onClick={() => setTool("select")} />
      </div>
    </main>
  );
}

function ToolBtn({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        fontSize: 20,
        color: "var(--brown)",
        background: active ? "rgba(245,236,221,0.6)" : "transparent",
        transition: "background 200ms"
      }}
    >
      {label}
    </button>
  );
}
