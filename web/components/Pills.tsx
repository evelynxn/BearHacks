"use client";

import Link from "next/link";

type PillKey = "friends" | "explore" | "activity";

const PILLS: { key: PillKey; label: string; href: string }[] = [
  { key: "friends", label: "Friends", href: "/people" },
  { key: "explore", label: "Explore", href: "/explore" },
  { key: "activity", label: "Activity", href: "/activity" }
];

export default function Pills({ active }: { active?: PillKey }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "20px 24px",
        flexWrap: "wrap",
        justifyContent: "center",
        position: "relative",
        zIndex: 56,
      }}
    >
      {PILLS.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          style={{
            background:
              active === p.key ? "var(--brown)" : "var(--brown-light)",
            color: "var(--cream)",
            padding: "8px 18px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            transition: "background var(--transition)",
            textDecoration: "none",
          }}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
