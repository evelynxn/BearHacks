"use client";

import type { CSSProperties, ReactNode } from "react";

type Props = {
  width?: number;
  height?: number;
  rotate?: number;
  children?: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
};

/**
 * Jagged / torn-paper edge cutout frame.
 * Uses an SVG clip-path with irregular edges to simulate a hand-torn photo cutout.
 * Wrap an <img> or any content inside to get the cutout effect.
 */
export default function CutoutFrame({
  width = 280,
  height = 320,
  rotate = 0,
  children,
  style,
  onClick,
}: Props) {
  // Generate a unique ID per instance to avoid SVG clip-path collisions
  const clipId = `cutout-${width}-${height}-${Math.random().toString(36).slice(2, 6)}`;

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width,
        height,
        transform: `rotate(${rotate}deg)`,
        cursor: onClick ? "pointer" : "default",
        filter: "drop-shadow(0 4px 12px rgba(60, 35, 28, 0.18))",
        ...style,
      }}
    >
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path
              d={`
                M 0.02 0.01
                L 0.06 0.0  L 0.10 0.015 L 0.14 0.005 L 0.18 0.02
                L 0.22 0.0  L 0.26 0.012 L 0.30 0.0   L 0.34 0.018
                L 0.38 0.005 L 0.42 0.0  L 0.46 0.015 L 0.50 0.0
                L 0.54 0.01  L 0.58 0.0  L 0.62 0.02  L 0.66 0.005
                L 0.70 0.0   L 0.74 0.012 L 0.78 0.0  L 0.82 0.018
                L 0.86 0.0   L 0.90 0.01  L 0.94 0.0  L 0.98 0.015

                L 1.0 0.04  L 0.985 0.08 L 1.0 0.12  L 0.988 0.16
                L 1.0 0.20  L 0.982 0.24 L 1.0 0.28  L 0.985 0.32
                L 1.0 0.36  L 0.988 0.40 L 1.0 0.44  L 0.982 0.48
                L 1.0 0.52  L 0.985 0.56 L 1.0 0.60  L 0.988 0.64
                L 1.0 0.68  L 0.982 0.72 L 1.0 0.76  L 0.985 0.80
                L 1.0 0.84  L 0.988 0.88 L 1.0 0.92  L 0.985 0.96

                L 0.98 1.0  L 0.94 0.985 L 0.90 1.0  L 0.86 0.988
                L 0.82 1.0  L 0.78 0.982 L 0.74 1.0  L 0.70 0.985
                L 0.66 1.0  L 0.62 0.988 L 0.58 1.0  L 0.54 0.982
                L 0.50 1.0  L 0.46 0.985 L 0.42 1.0  L 0.38 0.988
                L 0.34 1.0  L 0.30 0.982 L 0.26 1.0  L 0.22 0.985
                L 0.18 1.0  L 0.14 0.988 L 0.10 1.0  L 0.06 0.985
                L 0.02 1.0

                L 0.0 0.96  L 0.015 0.92 L 0.0 0.88  L 0.012 0.84
                L 0.0 0.80  L 0.018 0.76 L 0.0 0.72  L 0.015 0.68
                L 0.0 0.64  L 0.012 0.60 L 0.0 0.56  L 0.018 0.52
                L 0.0 0.48  L 0.015 0.44 L 0.0 0.40  L 0.012 0.36
                L 0.0 0.32  L 0.018 0.28 L 0.0 0.24  L 0.015 0.20
                L 0.0 0.16  L 0.012 0.12 L 0.0 0.08  L 0.015 0.04
                Z
              `}
            />
          </clipPath>
        </defs>
      </svg>
      <div
        style={{
          width: "100%",
          height: "100%",
          clipPath: `url(#${clipId})`,
          background: "var(--cream-light)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
