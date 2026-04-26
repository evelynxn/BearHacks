"use client";

import { useRouter } from "next/navigation";
import { use, useState } from "react";
import Pills from "../../../components/Pills";
import SideTabs from "../../../components/SideTabs";
import { mockEntries } from "../../../lib/mock-data";

// Modal-style detail view for a single postcard. Per plan.md: faded background,
// flip-in animation. We render this as a full page route over the feed.
export default function FeedDetail({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const entry = mockEntries.find((e) => e.id === id) ?? mockEntries[0];
  const [liked, setLiked] = useState(false);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--pink)"
      }}
    >
      <div style={{ filter: "blur(4px)", opacity: 0.7 }}>
        <Pills />
      </div>
      <SideTabs />

      {/* dim overlay */}
      <div
        onClick={() => router.back()}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(60,35,28,0.18)",
          zIndex: 5
        }}
      />

      {/* postcard */}
      <div
        className="flip-in"
        style={{
          position: "absolute",
          top: 130,
          left: 24,
          right: 24,
          background: "var(--cream-light)",
          borderRadius: var_radius_card,
          boxShadow: "0 16px 40px rgba(60,35,28,0.25)",
          padding: 28,
          zIndex: 6
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.6 }}>{entry.date}</div>
        <h2
          style={{
            margin: "8px 0 14px",
            fontSize: 26,
            fontWeight: 600,
            color: "var(--brown)"
          }}
        >
          {entry.title}
        </h2>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.65,
            color: "var(--brown-light)",
            margin: 0
          }}
        >
          {entry.body}
        </p>
      </div>

      {/* like FAB */}
      <button
        onClick={() => setLiked((v) => !v)}
        aria-label="Like"
        style={{
          position: "absolute",
          bottom: 70,
          right: 50,
          width: 50,
          height: 50,
          borderRadius: 25,
          background: "var(--cream-light)",
          color: liked ? "var(--pink)" : "var(--brown-light)",
          fontSize: 22,
          boxShadow: "var(--shadow-card)",
          zIndex: 6,
          transform: liked ? "scale(1.08)" : "scale(1)",
          transition: "transform 200ms"
        }}
      >
        {liked ? "♥" : "♡"}
      </button>
    </main>
  );
}

const var_radius_card = "var(--radius-card)";
