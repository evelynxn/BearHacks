"use client";

import type { FeedEntry } from "../lib/mock-data";

type Props = {
  entry: FeedEntry;
  offset?: number; // visual stack offset (back cards)
  onClick?: () => void;
};

export default function Postcard({ entry, offset = 0, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--cream-light)",
        borderRadius: var_radius_card,
        boxShadow: "var(--shadow-card)",
        transform: `translate(${offset * 8}px, ${offset * 6}px) rotate(${
          offset * -2
        }deg)`,
        zIndex: 10 - offset,
        cursor: onClick ? "pointer" : "default",
        padding: 22,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "transform var(--transition)"
      }}
    >
      {offset === 0 && (
        <>
          <div
            style={{
              fontSize: 12,
              opacity: 0.6,
              letterSpacing: 0.5
            }}
          >
            {entry.date}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: "var(--brown)"
            }}
          >
            {entry.title}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--brown-light)",
              flex: 1,
              overflow: "hidden"
            }}
          >
            {entry.body}
          </div>
        </>
      )}
    </div>
  );
}

const var_radius_card = "var(--radius-card)";
