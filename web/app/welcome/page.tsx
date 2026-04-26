"use client";

import Link from "next/link";
import Stamp from "../../components/Stamp";

export default function Welcome() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        padding: "60px 32px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between"
      }}
    >
      {/* Stamp cluster */}
      <div
        className="fade-up"
        style={{
          position: "relative",
          width: 280,
          height: 240,
          marginTop: 60
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 30 }}>
          <Stamp color="blue" size={110} rotate={-8} />
        </div>
        <div style={{ position: "absolute", top: -10, left: 110 }}>
          <Stamp color="olive" size={120} rotate={6} />
        </div>
        <div style={{ position: "absolute", top: 80, left: 70 }}>
          <Stamp color="pink" size={110} rotate={-4} />
        </div>
        <div style={{ position: "absolute", top: 90, left: 160 }}>
          <Stamp color="soft" size={100} rotate={10} />
        </div>
      </div>

      {/* CTAs */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          marginBottom: 40
        }}
      >
        <Link
          href="/signup"
          style={{
            background: "var(--pink)",
            color: "var(--cream)",
            padding: "16px 80px",
            borderRadius: 999,
            fontSize: 17,
            fontWeight: 500,
            boxShadow: "var(--shadow-card)"
          }}
        >
          Sign Up
        </Link>
        <Link
          href="/login"
          style={{
            color: "var(--brown)",
            fontSize: 15
          }}
        >
          Or Login
        </Link>
      </div>
    </main>
  );
}
