"use client";

import { useRouter } from "next/navigation";
import Pills from "../../components/Pills";
import SideTabs from "../../components/SideTabs";
import Stamp from "../../components/Stamp";
import { mockEntries } from "../../lib/mock-data";

// Public/social feed — grid of stamps that open into postcards.
export default function ExplorePage() {
  const router = useRouter();

  // Repeat mock entries to show a denser social feed.
  const grid = [...mockEntries, ...mockEntries, ...mockEntries];

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--pink)"
      }}
    >
      <Pills active="explore" />
      <SideTabs />

      <div
        style={{
          padding: "30px 24px 80px",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 14,
          justifyItems: "center"
        }}
      >
        {grid.map((e, i) => (
          <div
            key={`${e.id}-${i}`}
            onClick={() => router.push(`/feed/${e.id}`)}
            className="fade-up"
            style={{ animationDelay: `${i * 30}ms`, cursor: "pointer" }}
          >
            <Stamp
              color={
                e.color === "blue"
                  ? "blue"
                  : e.color === "olive"
                    ? "olive"
                    : e.color === "soft"
                      ? "soft"
                      : "dark"
              }
              size={130}
              rotate={(i % 5) - 2}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
