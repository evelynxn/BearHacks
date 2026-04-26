"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Stamp from "../components/Stamp";

// Splash screen — Punchi Pal logo with floating stamps. Auto-routes to /welcome.
// TODO(backend): replace timeout with auth check (if session → /feed, else → /welcome).
export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.push("/welcome"), 1600);
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
      <div style={{ position: "absolute", top: 30, left: -30 }} className="fade-up">
        <Stamp color="pink" size={130} rotate={-25} />
      </div>
      <div style={{ position: "absolute", top: 100, right: -20 }} className="fade-up">
        <Stamp color="pink" size={120} rotate={20} />
      </div>
      <div style={{ position: "absolute", bottom: 80, left: -20 }} className="fade-up">
        <Stamp color="pink" size={140} rotate={-18} />
      </div>

      <h1
        className="fade-up"
        style={{
          fontSize: 36,
          fontWeight: 600,
          color: "var(--brown)",
          letterSpacing: 0.5,
          margin: 0
        }}
      >
        Punchi Pal
      </h1>
    </main>
  );
}
