"use client";

import { useRouter } from "next/navigation";

type PillKey = "friends" | "explore" | "activity";

const PILLS: { key: PillKey; label: string; href: string }[] = [
  { key: "friends", label: "Friends", href: "/people" },
  { key: "explore", label: "Explore", href: "/explore" },
  { key: "activity", label: "Activity", href: "/activity" }
];

// Top-row pill nav shown on the mail/feed pages.
export default function Pills({ active }: { active?: PillKey }) {
  const router = useRouter();
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "20px 24px",
        flexWrap: "wrap"
      }}
    >
      {PILLS.map((p) => (
        <button
          key={p.key}
          onClick={() => router.push(p.href)}
          style={{
            background:
              active === p.key ? "var(--brown)" : "var(--brown-light)",
            color: "var(--cream)",
            padding: "8px 18px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 500,
            transition: "background var(--transition)"
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
