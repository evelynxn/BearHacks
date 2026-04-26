"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SideTabs from "../../components/SideTabs";
import Stamp from "../../components/Stamp";
import { mockStampGrid } from "../../lib/mock-data";

export default function CreatePage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--pink-soft)"
      }}
    >
      <SideTabs />

      <div
        style={{
          padding: "30px 24px 120px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          justifyItems: "center"
        }}
      >
        {mockStampGrid.map((s, i) => (
          <div
            key={s.id}
            onClick={() => router.push("/create/new")}
            style={{
              animation: `fadeUp ${280 + i * 30}ms both`,
              cursor: "pointer"
            }}
          >
            <Stamp color="dark" size={92} rotate={(i % 3 - 1) * 2} />
          </div>
        ))}
      </div>

      {/* + Menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 8
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="fade-up"
            style={{
              position: "absolute",
              bottom: 100,
              right: 50,
              background: "white",
              borderRadius: 14,
              boxShadow: "var(--shadow-card)",
              padding: 12,
              minWidth: 180,
              display: "flex",
              flexDirection: "column",
              gap: 4
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
        style={{
          position: "absolute",
          bottom: 30,
          right: 60,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: "var(--brown)",
          color: "var(--cream)",
          fontSize: 26,
          boxShadow: "var(--shadow-card)",
          zIndex: 9
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
  onClick
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
        padding: "10px 14px",
        borderRadius: 10,
        textAlign: "left",
        fontSize: 15,
        color: "var(--brown)",
        transition: "background 180ms"
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "#faf3eb";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  );
}
