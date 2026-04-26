"use client";

import { usePathname, useRouter } from "next/navigation";

type Tab = {
  key: "mail" | "create" | "profile";
  label: string;
  href: string;
  bg: string;
};

const TABS: Tab[] = [
  { key: "mail", label: "mail", href: "/feed", bg: "var(--pink)" },
  { key: "create", label: "create", href: "/create", bg: "var(--pink-soft)" },
  { key: "profile", label: "profile", href: "/profile", bg: "var(--olive)" }
];

// Stack of vertical tabs anchored to the right edge. The active tab disappears
// (its page is the foreground); inactive tabs peek out to be tapped.
export default function SideTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const activeKey: Tab["key"] = pathname.startsWith("/create")
    ? "create"
    : pathname.startsWith("/profile")
      ? "profile"
      : "mail";

  return (
    <div
      style={{
        position: "absolute",
        top: 70,
        right: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        zIndex: 5,
        pointerEvents: "none"
      }}
    >
      {TABS.map((tab) => {
        if (tab.key === activeKey) return null;
        return (
          <button
            key={tab.key}
            onClick={() => router.push(tab.href)}
            aria-label={`Go to ${tab.label}`}
            style={{
              pointerEvents: "auto",
              width: 32,
              height: 110,
              background: tab.bg,
              borderTopLeftRadius: 14,
              borderBottomLeftRadius: 14,
              color: "var(--brown)",
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
              fontSize: 16,
              letterSpacing: 1,
              padding: "12px 0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "-2px 2px 6px rgba(60,35,28,0.08)",
              transition: "transform var(--transition), width var(--transition)"
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.width = "38px";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.width = "32px";
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
