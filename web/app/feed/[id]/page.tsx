"use client";

import { useRouter } from "next/navigation";
import { use, useState, useEffect } from "react";
import Pills from "../../../components/Pills";
import SideTabs from "../../../components/SideTabs";
import { fallbackEntries } from "../../../lib/mock-data";
import { likeEntry, unlikeEntry } from "../../../lib/api";

const LIKES_KEY = "stampi_likes";

function getLikes(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LIKES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function setLikes(likes: Record<string, boolean>) {
  localStorage.setItem(LIKES_KEY, JSON.stringify(likes));
}

export default function FeedDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const entry = fallbackEntries.find((e) => e.id === id) ?? fallbackEntries[0];
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const likes = getLikes();
    setLiked(!!likes[entry.id]);
  }, [entry.id]);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);

    // Persist to localStorage immediately
    const likes = getLikes();
    if (next) {
      likes[entry.id] = true;
    } else {
      delete likes[entry.id];
    }
    setLikes(likes);

    // Persist to database (best-effort)
    const userId = localStorage.getItem("stampi_user_id") ?? "demo-user";
    try {
      if (next) {
        await likeEntry(userId, entry.id, entry.date);
      } else {
        await unlikeEntry(userId, entry.id, entry.date);
      }
    } catch {
      // DB unavailable — localStorage still has it
    }
  };

  return (
    <main
      className="page-with-tabs"
      style={{
        background: "var(--pink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1200,
          filter: "blur(4px)",
          opacity: 0.7,
        }}
      >
        <Pills />
      </div>
      <SideTabs />

      {/* dim overlay */}
      <div
        onClick={() => router.back()}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(60,35,28,0.18)",
          zIndex: 5,
        }}
      />

      {/* postcard */}
      <div
        className="stamp-down"
        style={{
          position: "relative",
          marginTop: 80,
          width: "100%",
          maxWidth: 560,
          marginLeft: "auto",
          marginRight: "auto",
          background: "var(--cream-light)",
          borderRadius: "var(--radius-card)",
          boxShadow: "0 16px 40px rgba(60,35,28,0.25)",
          padding: "clamp(24px, 4vw, 40px)",
          zIndex: 6,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.6, letterSpacing: 0.5 }}>
          {entry.date}
        </div>
        <h2
          style={{
            margin: "10px 0 16px",
            fontSize: "clamp(24px, 3.5vw, 32px)",
            fontWeight: 600,
            color: "var(--brown)",
          }}
        >
          {entry.title}
        </h2>
        <p
          style={{
            fontSize: "clamp(15px, 2vw, 18px)",
            lineHeight: 1.7,
            color: "var(--brown-light)",
            margin: 0,
          }}
        >
          {entry.body}
        </p>
      </div>

      {/* like FAB */}
      <button
        onClick={toggleLike}
        aria-label="Like"
        className={liked ? "pop-in" : ""}
        style={{
          position: "fixed",
          bottom: 40,
          right: "clamp(56px, 6vw, 90px)",
          width: 54,
          height: 54,
          borderRadius: 27,
          background: "var(--cream-light)",
          color: liked ? "var(--pink)" : "var(--brown-light)",
          fontSize: 24,
          boxShadow: "0 6px 20px rgba(60,35,28,0.2)",
          zIndex: 6,
          transition:
            "transform 200ms cubic-bezier(0.34, 1.2, 0.45, 1), color 200ms ease",
          transform: liked ? "scale(1.1)" : "scale(1)",
        }}
      >
        {liked ? "♥" : "♡"}
      </button>
    </main>
  );
}
