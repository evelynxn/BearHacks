"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Stamp from "../components/Stamp";

// Splash screen — Stampi logo with rotating stamps clustered around title.
// TODO(backend): replace timeout with auth check (if session → /feed, else → /welcome).
export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push("/welcome"), 2200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "var(--cream)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {/* Stamp cluster — tightly grouped around center title */}
      <div
        style={{
          position: "relative",
          width: 320,
          height: 260,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {/* Top-left stamp */}
        <div
          className="stamp-down"
          style={{
            position: "absolute",
            top: 0,
            left: 20,
            animationDelay: "100ms"
          }}
        >
          <Stamp color="blue" size={100} rotate={-12} />
        </div>

        {/* Top-right stamp */}
        <div
          className="stamp-down"
          style={{
            position: "absolute",
            top: -10,
            right: 20,
            animationDelay: "250ms"
          }}
        >
          <Stamp color="olive" size={110} rotate={8} />
        </div>

        {/* Bottom-left stamp */}
        <div
          className="stamp-down"
          style={{
            position: "absolute",
            bottom: 10,
            left: 40,
            animationDelay: "400ms"
          }}
        >
          <Stamp color="pink" size={105} rotate={-6} />
        </div>

        {/* Bottom-right stamp */}
        <div
          className="stamp-down"
          style={{
            position: "absolute",
            bottom: 0,
            right: 30,
            animationDelay: "550ms"
          }}
        >
          <Stamp color="soft" size={95} rotate={14} />
        </div>

        {/* Title — centered over stamps */}
        <h1
          className="pop-in"
          style={{
            position: "relative",
            zIndex: 10,
            fontSize: 40,
            fontWeight: 600,
            color: "var(--brown)",
            letterSpacing: 1,
            margin: 0,
            textShadow: "0 2px 8px rgba(242,232,216,0.8)",
            animationDelay: "700ms"
          }}
        >
          Stampi
        </h1>
      </div>
    </main>
  );
}
