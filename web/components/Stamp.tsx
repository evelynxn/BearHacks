"use client";

import type { CSSProperties, ReactNode } from "react";

type StampColor = "dark" | "pink" | "olive" | "blue" | "soft";

const colorMap: Record<StampColor, string> = {
  dark: "#3d2c28",
  pink: "#c9899b",
  olive: "#a4a45c",
  blue: "#a8b8d8",
  soft: "#f0d8d5"
};

type Props = {
  color?: StampColor;
  size?: number;
  rotate?: number;
  imageSrc?: string;
  children?: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
};

// Scalloped-edge stamp shape using SVG. Children render inside the inner area.
export default function Stamp({
  color = "dark",
  size = 80,
  rotate = 0,
  imageSrc,
  children,
  style,
  onClick
}: Props) {
  const fill = colorMap[color];
  const width = size;
  const height = Math.round(size * 1.18);
  const maskId = `stamp-mask-${color}-${size}-${imageSrc ? "img" : "solid"}`;

  return (
    <div
      onClick={onClick}
      style={{
        width,
        height,
        transform: `rotate(${rotate}deg)`,
        cursor: onClick ? "pointer" : "default",
        position: "relative",
        ...style
      }}
    >
      <svg
        viewBox="0 0 100 118"
        width={width}
        height={height}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, display: "block" }}
      >
        <defs>
          <mask id={maskId}>
            <rect width="100" height="118" fill="white" />
            {Array.from({ length: 11 }).map((_, i) => (
              <circle
                key={`top-${i}`}
                cx={i * 10}
                cy={0}
                r={4.5}
                fill="black"
              />
            ))}
            {Array.from({ length: 11 }).map((_, i) => (
              <circle
                key={`bottom-${i}`}
                cx={i * 10}
                cy={118}
                r={4.5}
                fill="black"
              />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <circle
                key={`left-${i}`}
                cx={0}
                cy={i * 10 - 1}
                r={4.5}
                fill="black"
              />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <circle
                key={`right-${i}`}
                cx={100}
                cy={i * 10 - 1}
                r={4.5}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        {imageSrc ? (
          <g mask={`url(#${maskId})`}>
            <rect x="3" y="3" width="94" height="112" fill={fill} rx="2" />
            <image
              href={imageSrc}
              x="3"
              y="3"
              width="94"
              height="112"
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
        ) : (
          <rect
            x="3"
            y="3"
            width="94"
            height="112"
            fill={fill}
            mask={`url(#${maskId})`}
            rx="2"
          />
        )}
      </svg>
      {children && (
        <div
          style={{
            position: "absolute",
            inset: "10% 12%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--cream)"
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
