"use client";

import Pills from "../../components/Pills";
import SideTabs from "../../components/SideTabs";
import { mockFriends } from "../../lib/mock-data";

export default function PeoplePage() {
  return (
    <main
      className="page-with-tabs"
      style={{
        background: "var(--pink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 600 }}>
        <Pills active="friends" />
      </div>
      <SideTabs />

      <div
        style={{
          padding: "20px 24px 80px",
          width: "100%",
          maxWidth: 500,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {mockFriends.map((f, i) => (
          <div
            key={f.id}
            className="float-up"
            style={{
              animationDelay: `${i * 60}ms`,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "14px 18px",
              background: "var(--cream-light)",
              borderRadius: 16,
              boxShadow: "0 2px 8px rgba(60,35,28,0.08)",
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                background: "var(--avatar-purple)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 600,
                color: "var(--brown)",
                flexShrink: 0,
              }}
            >
              {f.name[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--brown)" }}>
                {f.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--brown)", opacity: 0.55, marginTop: 2 }}>
                feeling {f.feeling}
              </div>
            </div>
            <button
              aria-label={`Message ${f.name}`}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "var(--pink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "transform 180ms ease, background 180ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--brown-light)";
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--pink)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13" stroke="#f5ecdd" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#f5ecdd" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
