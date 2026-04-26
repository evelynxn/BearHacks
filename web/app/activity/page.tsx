"use client";

import Pills from "../../components/Pills";
import SideTabs from "../../components/SideTabs";
import { mockActivity } from "../../lib/mock-data";

export default function ActivityPage() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--pink)"
      }}
    >
      <Pills active="activity" />
      <SideTabs />

      <div
        style={{
          margin: "12px 22px",
          padding: 20,
          background: "var(--cream-light)",
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}
      >
        {mockActivity.map((a, i) => (
          <div
            key={a.id}
            className="fade-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              animationDelay: `${i * 50}ms`
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                background: "var(--avatar-purple)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brown)"
              }}
            >
              ⌒
            </div>
            <div style={{ flex: 1, fontSize: 14, color: "var(--brown)" }}>
              <strong style={{ fontWeight: 600 }}>{a.who}</strong> {a.action}
            </div>
            <div style={{ fontSize: 12, opacity: 0.55 }}>{a.when}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
