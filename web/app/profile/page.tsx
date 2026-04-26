"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import SideTabs from "../../components/SideTabs";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function loadLocalNotes(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem("stampi_day_notes") ?? "{}");
  } catch {
    return {};
  }
}

function saveLocalNotes(notes: Record<number, string>) {
  localStorage.setItem("stampi_day_notes", JSON.stringify(notes));
}

export default function ProfilePage() {
  const router = useRouter();
  const [dayNotes, setDayNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    setDayNotes(loadLocalNotes());
  }, []);

  const handleNoteChange = (index: number, value: string) => {
    setDayNotes((prev) => {
      const updated = { ...prev, [index]: value };
      saveLocalNotes(updated);
      return updated;
    });
  };

  return (
    <main
      className="page-with-tabs"
      style={{
        background: "var(--olive)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <SideTabs />

      {/* header */}
      <div
        style={{
          padding: "28px 24px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          width: "100%",
          maxWidth: 800,
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
            fontSize: "clamp(32px, 4.5vw, 48px)",
            transition: "transform 200ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "rotate(90deg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "rotate(0deg)";
          }}
        >
          ⚙
        </button>
        <div
          className="pop-in"
          style={{
            width: 90,
            height: 90,
            borderRadius: 45,
            background: "var(--cream-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 42,
            color: "var(--brown)",
            border: "3px solid var(--cream-light)",
            boxShadow: "0 4px 16px rgba(60,35,28,0.15)",
          }}
        >
          ⌒
        </div>
      </div>

      {/* "Your week" panel */}
      <section
        style={{
          margin: "20px auto 0",
          padding: "clamp(18px, 3vw, 28px)",
          background: "var(--cream-light)",
          borderRadius: 14,
          width: "clamp(280px, 88%, 800px)",
          minHeight: "calc(100vh - 200px)",
        }}
      >
        <h2
          style={{
            margin: "4px 8px 18px",
            fontSize: "clamp(18px, 2.5vw, 22px)",
            fontWeight: 600,
            color: "var(--brown)",
          }}
        >
          Your week
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DAYS.map((day, i) => (
            <div
              key={i}
              className="float-up"
              style={{
                animationDelay: `${i * 50}ms`,
                display: "flex",
                flexDirection: "column",
                gap: 0,
              }}
            >
              {/* Day label */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--brown)",
                  opacity: 0.45,
                  paddingLeft: 4,
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {day}
              </span>

              {/* Text field */}
              <input
                type="text"
                placeholder="on this day I felt..."
                value={dayNotes[i] ?? ""}
                onChange={(e) => handleNoteChange(i, e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1.5px solid rgba(74,45,38,0.12)",
                  borderRadius: 12,
                  background: "transparent",
                  fontSize: 14,
                  color: "var(--brown)",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 200ms ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--olive)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(74,45,38,0.12)";
                }}
              />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
