"use client";

import type { ReactNode } from "react";

// Big pink stamp-shaped container that holds a white inner card. Used for
// the login + signup forms.
export default function StampFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "relative", width: 320, height: 400 }}>
      <svg
        viewBox="0 0 100 130"
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        <defs>
          <mask id="frame-mask">
            <rect width="100" height="130" fill="white" />
            {Array.from({ length: 11 }).map((_, i) => (
              <circle
                key={`t-${i}`}
                cx={i * 10}
                cy={0}
                r={4.5}
                fill="black"
              />
            ))}
            {Array.from({ length: 11 }).map((_, i) => (
              <circle
                key={`b-${i}`}
                cx={i * 10}
                cy={130}
                r={4.5}
                fill="black"
              />
            ))}
            {Array.from({ length: 14 }).map((_, i) => (
              <circle
                key={`l-${i}`}
                cx={0}
                cy={i * 10}
                r={4.5}
                fill="black"
              />
            ))}
            {Array.from({ length: 14 }).map((_, i) => (
              <circle
                key={`r-${i}`}
                cx={100}
                cy={i * 10}
                r={4.5}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          x="3"
          y="3"
          width="94"
          height="124"
          fill="var(--pink)"
          mask="url(#frame-mask)"
          rx="2"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          inset: "16% 12%",
          background: "white",
          borderRadius: 4,
          padding: "26px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 14
        }}
      >
        {children}
      </div>
    </div>
  );
}
