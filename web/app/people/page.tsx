"use client";

import { useRouter } from "next/navigation";
import { mockFriends } from "../../lib/mock-data";

export default function PeoplePage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--cream-light)",
        padding: "20px 26px"
      }}
    >
      {/* header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          marginBottom: 24
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ fontSize: 22, color: "var(--brown)" }}
        >
          ←
        </button>
        <h1
          style={{
            margin: 0,
            textAlign: "center",
            fontSize: 18,
            fontWeight: 500,
            color: "var(--brown)"
          }}
        >
          People
        </h1>
        <button
          aria-label="Add"
          style={{
            border: "1.5px solid var(--brown)",
            borderRadius: 6,
            width: 32,
            height: 32,
            color: "var(--brown)",
            fontSize: 18
          }}
        >
          +
        </button>
      </div>

      {/* list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {mockFriends.map((f, i) => (
          <button
            key={f.id}
            className="fade-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "8px 0",
              animationDelay: `${i * 40}ms`
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: "var(--avatar-purple)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                color: "var(--brown)"
              }}
            >
              ⌒
            </div>
            <div style={{ fontSize: 15, color: "var(--brown)" }}>
              {f.name === "Maya" ? "Friend Name" : "Friend Name"}
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
