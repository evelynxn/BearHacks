"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import StampFrame from "../../components/StampFrame";

const fieldLabel: React.CSSProperties = {
  fontSize: 14,
  color: "var(--olive-dark)",
  marginBottom: 4
};

const fieldInput: React.CSSProperties = {
  border: "1px solid var(--olive)",
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 15,
  color: "var(--brown)",
  background: "white",
  outline: "none"
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to Auth0 universal login — returns to /auth/callback → /feed
    window.location.href = "/auth/login?returnTo=/feed";
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
    >
      <StampFrame>
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="email" style={fieldLabel}>
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={fieldInput}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <label htmlFor="password" style={fieldLabel}>
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={fieldInput}
            />
          </div>

          <button
            type="submit"
            style={{
              background: "var(--olive)",
              color: "white",
              padding: "12px",
              borderRadius: 6,
              fontSize: 16,
              fontWeight: 500,
              marginTop: 4
            }}
          >
            Login
          </button>

          <Link
            href="/forgot"
            style={{ fontSize: 13, color: "var(--olive-dark)" }}
          >
            Forgot password?
          </Link>
        </form>
      </StampFrame>
    </main>
  );
}
