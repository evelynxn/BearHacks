"use client";

import { useRouter } from "next/navigation";
import { useState, useRef } from "react";
import Pills from "../../components/Pills";
import SideTabs from "../../components/SideTabs";
import { mockEntries } from "../../lib/mock-data";

// Mail / feed page — the home screen. Stack of postcards that loop infinitely
// within the same day (per plan.md). Swipe left/right (touch + drag) navigates.
export default function FeedPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);

  const total = mockEntries.length;
  const current = mockEntries[index];
  const next = mockEntries[(index + 1) % total];
  const after = mockEntries[(index + 2) % total];

  const advance = (dir: 1 | -1) => {
    setIndex((i) => (i + dir + total) % total);
    setDragX(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current !== null) setDragX(e.clientX - startX.current);
  };
  const onPointerUp = () => {
    if (startX.current === null) return;
    if (dragX < -60) advance(1);
    else if (dragX > 60) advance(-1);
    else setDragX(0);
    startX.current = null;
  };

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--pink)"
      }}
    >
      <Pills />
      <SideTabs />

      <div
        style={{
          position: "relative",
          margin: "60px 30px 0",
          height: 380
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* back stack */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--cream-light)",
            borderRadius: "var(--radius-card)",
            transform: "translate(16px, 12px) rotate(-3deg)",
            opacity: 0.7,
            zIndex: 1
          }}
          aria-hidden
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--cream-light)",
            borderRadius: "var(--radius-card)",
            transform: "translate(8px, 6px) rotate(2deg)",
            opacity: 0.85,
            zIndex: 2
          }}
          aria-hidden
        >
          <CardBody title={after.title} />
        </div>

        {/* "next" peek behind */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--cream-light)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            transform: `translate(4px, 3px) rotate(1deg)`,
            zIndex: 3
          }}
          aria-hidden
        >
          <CardBody title={next.title} />
        </div>

        {/* current card */}
        <div
          onClick={() => Math.abs(dragX) < 6 && router.push(`/feed/${current.id}`)}
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--cream-light)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-card)",
            transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
            zIndex: 4,
            cursor: "grab",
            padding: 24,
            transition: startX.current ? "none" : "transform 240ms ease",
            touchAction: "pan-y"
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.55 }}>{current.date}</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              marginTop: 6,
              color: "var(--brown)"
            }}
          >
            {current.title}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              marginTop: 10,
              color: "var(--brown-light)"
            }}
          >
            {current.body}
          </div>
        </div>
      </div>

      {/* hint dots */}
      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "center",
          marginTop: 24
        }}
      >
        {mockEntries.map((_, i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: i === index ? "var(--brown)" : "rgba(74,45,38,0.3)"
            }}
          />
        ))}
      </div>

      {/* + FAB */}
      <button
        onClick={() => router.push("/create/new")}
        aria-label="New entry"
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
          boxShadow: "var(--shadow-card)"
        }}
      >
        +
      </button>
    </main>
  );
}

function CardBody({ title }: { title: string }) {
  return (
    <div style={{ padding: 24, opacity: 0.45 }}>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{title}</div>
    </div>
  );
}
