"use client";

import Pills from "../../components/Pills";
import SideTabs from "../../components/SideTabs";
import { mockActivity } from "../../lib/mock-data";

export default function ActivityPage() {
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
      <div style={{ width: "100%", maxWidth: 1200 }}>
        <Pills active="activity" />
      </div>
      <SideTabs />

      <div
        style={{
          margin: "12px 22px",
          padding: "clamp(18px, 3vw, 28px)",
          background: "var(--cream-light)",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: "100%",
          maxWidth: 700,
        }}
      >
        {mockActivity.map((a, i) => (
          <div
            key={a.id}
            className="float-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              animationDelay: `${i * 60}ms`,
              padding: "8px 4px",
              borderRadius: 10,
              transition: "background 200ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(201,137,155,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
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
                color: "var(--brown)",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ⌒
            </div>
            <div style={{ flex: 1, fontSize: 15, color: "var(--brown)" }}>
              <strong style={{ fontWeight: 600 }}>{a.who}</strong> {a.action}
            </div>
            <div style={{ fontSize: 12, opacity: 0.55, flexShrink: 0 }}>{a.when}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
