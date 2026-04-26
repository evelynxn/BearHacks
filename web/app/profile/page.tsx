"use client";

import { useRouter } from "next/navigation";
import SideTabs from "../../components/SideTabs";
import Stamp from "../../components/Stamp";
import { mockProfile } from "../../lib/mock-data";

// Profile page — olive header w/ avatar + settings, then a "Your week" card
// with rounded summary rows. Some rows have stamp marks (recent activity).
export default function ProfilePage() {
  const router = useRouter();

  const rows = [
    { hasStamp: true, side: "left" as const },
    { hasStamp: true, side: "right" as const },
    { hasStamp: true, side: "left" as const },
    { hasStamp: false, side: "left" as const },
    { hasStamp: false, side: "left" as const },
    { hasStamp: false, side: "left" as const },
    { hasStamp: false, side: "left" as const }
  ];

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--olive)"
      }}
    >
      <SideTabs />

      {/* header */}
      <div
        style={{
          padding: "24px 24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative"
        }}
      >
        <button
          onClick={() => router.push("/settings")}
          aria-label="Settings"
          style={{
            position: "absolute",
            left: 24,
            top: 28,
            color: "var(--brown)",
            fontSize: 22
          }}
        >
          ⚙
        </button>
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 43,
            background: "var(--cream-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            color: "var(--brown)",
            border: "2px solid var(--cream-light)"
          }}
        >
          ⌒
        </div>
      </div>

      {/* "Your week" panel */}
      <section
        style={{
          margin: "20px 18px 0",
          padding: "18px 14px 22px",
          background: "var(--cream-light)",
          borderRadius: 14,
          minHeight: "calc(100vh - 200px)"
        }}
      >
        <h2
          style={{
            margin: "4px 8px 14px",
            fontSize: 18,
            fontWeight: 600,
            color: "var(--brown)"
          }}
        >
          Your week
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                height: 56,
                border: "1.5px solid var(--brown)",
                borderRadius: 28,
                background: "transparent",
                overflow: "hidden"
              }}
            >
              {r.hasStamp && (
                <div
                  style={{
                    position: "absolute",
                    top: 8,
                    [r.side]: 14,
                    transform: r.side === "right" ? "scaleX(-1)" : "none"
                  }}
                >
                  <Stamp color="dark" size={42} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
