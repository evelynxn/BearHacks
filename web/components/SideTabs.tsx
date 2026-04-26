"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  key: "mail" | "create" | "profile";
  label: string;
  href: string;
  bg: string;
};

const TABS: Tab[] = [
  { key: "mail", label: "mail", href: "/feed", bg: "var(--pink)" },
  { key: "create", label: "create", href: "/create", bg: "var(--pink-soft)" },
  { key: "profile", label: "profile", href: "/profile", bg: "var(--olive)" },
];

export default function SideTabs() {
  const pathname = usePathname();

  const activeKey: Tab["key"] = pathname.startsWith("/create")
    ? "create"
    : pathname.startsWith("/profile")
      ? "profile"
      : "mail";

  return (
    <>
      {TABS.map((tab, i) => {
        const isActive = tab.key === activeKey;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-label={`Go to ${tab.label}`}
            onClick={(e) => { if (isActive) e.preventDefault(); }}
            style={{
              position: "fixed",
              top: `calc(var(--tab-top-start) + ${i} * (var(--tab-height) - var(--tab-overlap)))`,
              right: 0,
              zIndex: isActive ? 55 : 52 - i,
              width: isActive ? "var(--tab-width-active)" : "var(--tab-width)",
              height: "var(--tab-height)",
              background: tab.bg,
              borderTopLeftRadius: 14,
              borderBottomLeftRadius: 14,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              border: "none",
              color: "var(--brown)",
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
              fontSize: "var(--tab-font)",
              fontWeight: isActive ? 600 : 500,
              letterSpacing: 1.5,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isActive ? "default" : "pointer",
              boxShadow: isActive
                ? "none"
                : "-3px 0 8px rgba(60,35,28,0.1)",
              textDecoration: "none",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </>
  );
}
