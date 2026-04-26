"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import SideTabs from "../../components/SideTabs";
import Stamp from "../../components/Stamp";
import { loadStamps, deleteStamp, LocalStamp } from "../../lib/stamps-store";

export default function CreatePage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [stamps, setStamps] = useState<LocalStamp[]>([]);
  const [selected, setSelected] = useState<LocalStamp | null>(null);

  useEffect(() => {
    loadStamps().then(setStamps);
  }, []);

  const handleDelete = async (id: string) => {
    setStamps((prev) => prev.filter((s) => s.id !== id));
    setSelected(null);
    await deleteStamp(id);
  };

  return (
    <main
      className="page-with-tabs"
      style={{
        background: "var(--pink-soft)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <SideTabs />

      {/* Header */}
      <div
        style={{
          padding: "24px 24px 8px",
          width: "100%",
          maxWidth: 900,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "clamp(18px, 2.5vw, 22px)",
            fontWeight: 600,
            color: "var(--brown)",
            opacity: 0.7,
          }}
        >
          Your Stamps
        </h2>
      </div>

      {/* VSCO-style grid */}
      {stamps.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "80px 24px",
            opacity: 0.4,
          }}
        >
          <span style={{ fontSize: 48 }}>☺</span>
          <span style={{ fontSize: 15, color: "var(--brown)" }}>
            No stamps yet. Tap + to create one.
          </span>
        </div>
      ) : (
        <div
          style={{
            padding: "16px 12px 120px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 4,
            width: "100%",
            maxWidth: 900,
          }}
        >
          {stamps.map((s, i) => (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              className="float-up"
              style={{
                animationDelay: `${i * 30}ms`,
                cursor: "pointer",
                position: "relative",
                aspectRatio: "1",
                overflow: "hidden",
                borderRadius: 2,
              }}
            >
              {s.path.endsWith(".svg") ? (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(74,45,38,0.04)",
                  }}
                >
                  <Stamp
                    color={s.color as "pink" | "olive" | "soft" | "dark" | "blue"}
                    size={80}
                  />
                </div>
              ) : (
                <img
                  src={s.path}
                  alt={s.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stamp detail modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(60,35,28,0.3)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="stamp-down"
            style={{
              width: "min(90vw, 400px)",
              background: "var(--cream-light)",
              borderRadius: "var(--radius-card)",
              boxShadow: "0 16px 48px rgba(60,35,28,0.25)",
              padding: "clamp(20px, 4vw, 32px)",
              zIndex: 101,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Stamp preview */}
            {selected.path.endsWith(".svg") ? (
              <Stamp
                color={selected.color as "pink" | "olive" | "soft" | "dark" | "blue"}
                size={140}
              />
            ) : (
              <Stamp
                color={selected.color as "pink" | "olive" | "soft" | "dark" | "blue"}
                size={180}
                imageSrc={selected.path}
                style={{ filter: "drop-shadow(0 4px 12px rgba(60,35,28,0.15))" }}
              />
            )}

            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: "var(--brown)",
                textAlign: "center",
              }}
            >
              {selected.title}
            </h3>

            <div style={{ fontSize: 12, opacity: 0.4, color: "var(--brown)" }}>
              {selected.path}
            </div>

            <div
              style={{
                fontSize: 12,
                opacity: 0.4,
                color: "var(--brown)",
                fontFamily: "monospace",
                background: "rgba(74,45,38,0.04)",
                padding: "8px 12px",
                borderRadius: 8,
                width: "100%",
                wordBreak: "break-all",
              }}
            >
              {JSON.stringify(
                { path: selected.path, title: selected.title, id: selected.id },
                null,
                2
              )}
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button
                onClick={() => setSelected(null)}
                style={{
                  padding: "10px 24px",
                  borderRadius: 999,
                  fontSize: 14,
                  color: "var(--brown)",
                  border: "1.5px solid var(--brown)",
                  background: "transparent",
                }}
              >
                Close
              </button>
              <button
                onClick={() => handleDelete(selected.id)}
                style={{
                  padding: "10px 24px",
                  borderRadius: 999,
                  fontSize: 14,
                  color: "white",
                  background: "#b04040",
                  border: "none",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* + FAB with menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pop-in"
            style={{
              position: "fixed",
              bottom: 100,
              right: "clamp(56px, 6vw, 90px)",
              background: "white",
              borderRadius: 14,
              boxShadow: "0 8px 30px rgba(60,35,28,0.2)",
              padding: 12,
              minWidth: 200,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <MenuButton
              icon="☺"
              label="New Stamp"
              onClick={() => router.push("/create/new?type=stamp")}
            />
            <MenuButton
              icon="✦"
              label="New Post Card"
              onClick={() => router.push("/create/new?type=postcard")}
            />
          </div>
        </div>
      )}

      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="New"
        className="pop-in"
        style={{
          position: "fixed",
          bottom: 30,
          right: "clamp(56px, 6vw, 90px)",
          width: 60,
          height: 60,
          borderRadius: 30,
          background: "var(--brown)",
          color: "var(--cream)",
          fontSize: 28,
          fontWeight: 300,
          boxShadow: "0 6px 24px rgba(60, 35, 28, 0.25)",
          zIndex: 100,
          transition: "transform 200ms ease, box-shadow 200ms ease",
          animationDelay: "200ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1) rotate(90deg)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1) rotate(0deg)";
        }}
      >
        +
      </button>
    </main>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 10,
        textAlign: "left",
        fontSize: 15,
        color: "var(--brown)",
        transition: "background 180ms, transform 180ms",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#faf3eb";
        e.currentTarget.style.transform = "translateX(4px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.transform = "translateX(0)";
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  );
}
