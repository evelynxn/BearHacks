"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import Pills from "../../components/Pills";
import SideTabs from "../../components/SideTabs";
import Stamp from "../../components/Stamp";
import { FeedEntry, fallbackEntries } from "../../lib/mock-data";
import { loadFeedEntries } from "../../lib/feed-store";

type TransitionDir = "none" | "left" | "right";

export default function FeedPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<FeedEntry[]>(fallbackEntries);
  const [index, setIndex] = useState(0);
  const [entered, setEntered] = useState(false);
  const [transition, setTransition] = useState<TransitionDir>("none");
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalEntry, setModalEntry] = useState<FeedEntry | null>(null);
  const animating = useRef(false);

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
    loadFeedEntries().then(setEntries);
  }, []);

  const total = entries.length;
  const current = entries[index];
  const [nextIndex, setNextIndex] = useState<number | null>(null);
  const nextEntry = nextIndex !== null ? entries[nextIndex] : null;

  const advance = useCallback(
    (dir: 1 | -1) => {
      if (animating.current || total === 0) return;
      animating.current = true;
      const ni = (index + dir + total) % total;
      setNextIndex(ni);
      setTransition(dir === 1 ? "left" : "right");
      setTimeout(() => {
        setIndex(ni);
        setNextIndex(null);
        setTransition("none");
        animating.current = false;
      }, 600);
    },
    [total, index]
  );

  const peekOffset = (depth: number) => {
    const x = depth * 8;
    const y = depth * 5;
    const r = depth === 1 ? 1.5 : -2;
    return `translate(${x}px, ${y}px) rotate(${r}deg)`;
  };

  const flyOutStyle: React.CSSProperties =
    transition === "left"
      ? { animation: "cardFlyOut 550ms cubic-bezier(0.4, 0, 0.9, 1) forwards" }
      : transition === "right"
        ? { animation: "cardFlyOutRight 550ms cubic-bezier(0.4, 0, 0.9, 1) forwards" }
        : {};

  const slideInStyle: React.CSSProperties =
    transition === "left"
      ? { animation: "cardSlideIn 620ms cubic-bezier(0.22, 1, 0.36, 1) both" }
      : transition === "right"
        ? { animation: "cardSlideInLeft 620ms cubic-bezier(0.22, 1, 0.36, 1) both" }
        : {};

  if (!current) return null;

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
      <div style={{ width: "100%", maxWidth: 600 }}>
        <Pills />
      </div>
      <SideTabs />

      {/* Card area with nav buttons */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 620,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          margin: "40px auto 0",
          padding: "0 20px",
        }}
      >
        {/* Left arrow */}
        <NavButton dir="left" onClick={() => advance(-1)} />

        {/* Card stack */}
        <div
          style={{
            position: "relative",
            flex: 1,
            maxWidth: 320,
            height: "clamp(340px, 50vh, 420px)",
          }}
        >
          {/* Back peek */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--cream-light)",
              borderRadius: "var(--radius-card)",
              transform: entered ? peekOffset(2) : "translate(16px, 40px) rotate(-3deg)",
              opacity: entered ? 0.6 : 0,
              zIndex: 1,
              transition: "all 600ms cubic-bezier(0.34, 1.2, 0.45, 1) 200ms",
            }}
            aria-hidden
          />

          {/* Middle peek */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--cream-light)",
              borderRadius: "var(--radius-card)",
              boxShadow: "var(--shadow-card)",
              transform: entered ? peekOffset(1) : "translate(8px, 30px) rotate(2deg)",
              opacity: entered ? 0.8 : 0,
              zIndex: 2,
              transition: "all 500ms cubic-bezier(0.34, 1.2, 0.45, 1) 100ms",
            }}
            aria-hidden
          />

          {/* Incoming card (slides in during transition) */}
          {transition !== "none" && nextEntry && (
            <FeedCard
              entry={nextEntry}
              zIndex={3}
              extraStyle={slideInStyle}
              onClick={() => {}}
            />
          )}

          {/* Current card — flies out during transition */}
          <FeedCard
            entry={current}
            zIndex={4}
            extraStyle={
              transition !== "none"
                ? flyOutStyle
                : {
                    opacity: entered ? 1 : 0,
                    transition: "transform 400ms cubic-bezier(0.34, 1.2, 0.45, 1), opacity 400ms ease, box-shadow 400ms ease",
                  }
            }
            onClick={() => transition === "none" && setModalEntry(current)}
          />
        </div>

        {/* Right arrow */}
        <NavButton dir="right" onClick={() => advance(1)} />
      </div>

      {/* Hint dots */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          marginTop: 28,
        }}
      >
        {entries.map((_, i) => (
          <div
            key={i}
            onClick={() => {
              if (!animating.current) setIndex(i);
            }}
            style={{
              width: i === index ? 20 : 7,
              height: 7,
              borderRadius: 4,
              background: i === index ? "var(--brown)" : "rgba(74,45,38,0.3)",
              transition: "all 300ms cubic-bezier(0.34, 1.2, 0.45, 1)",
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      {/* Detail modal overlay */}
      {modalEntry && (
        <DetailModal
          entry={modalEntry}
          onClose={() => setModalEntry(null)}
          onRename={(id, newTitle) => {
            setEntries((prev) =>
              prev.map((e) => (e.id === id ? { ...e, title: newTitle } : e))
            );
            setModalEntry((prev) => prev && prev.id === id ? { ...prev, title: newTitle } : prev);
            fetch("/api/feed-entry", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, title: newTitle }),
            });
          }}
          onDelete={(id) => {
            setModalEntry(null);
            setEntries((prev) => {
              const updated = prev.filter((e) => e.id !== id);
              if (index >= updated.length) setIndex(Math.max(0, updated.length - 1));
              return updated;
            });
            fetch("/api/feed-entry", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            });
          }}
        />
      )}

      {/* + FAB with popup menu */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pop-in"
            style={{
              position: "fixed",
              bottom: 100,
              right: "clamp(56px, 6vw, 90px)",
              background: "white",
              borderRadius: 14,
              boxShadow: "0 8px 30px rgba(60,35,28,0.2)",
              padding: 12,
              minWidth: 200,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <MenuButton icon="☺" label="New Stamp" onClick={() => { setMenuOpen(false); router.push("/create/new?type=stamp"); }} />
            <MenuButton icon="✦" label="New Post Card" onClick={() => { setMenuOpen(false); router.push("/create/new?type=postcard"); }} />
          </div>
        </div>
      )}

      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="New entry"
        className="pop-in"
        style={{
          position: "fixed",
          bottom: 30,
          right: "clamp(56px, 6vw, 90px)",
          width: 60,
          height: 60,
          borderRadius: 30,
          background: "var(--brown)",
          color: "var(--cream)",
          fontSize: 28,
          fontWeight: 300,
          boxShadow: "0 6px 24px rgba(60, 35, 28, 0.25)",
          zIndex: 100,
          transition: "transform 200ms ease, box-shadow 200ms ease",
          animationDelay: "300ms",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1) rotate(90deg)";
          e.currentTarget.style.boxShadow = "0 8px 32px rgba(60, 35, 28, 0.35)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1) rotate(0deg)";
          e.currentTarget.style.boxShadow = "0 6px 24px rgba(60, 35, 28, 0.25)";
        }}
      >
        +
      </button>
    </main>
  );
}

/* ── Feed card (stamp + time + owner) ─────────────────────────────── */

function FeedCard({
  entry,
  zIndex,
  extraStyle,
  onClick,
}: {
  entry: FeedEntry;
  zIndex: number;
  extraStyle?: React.CSSProperties;
  onClick: () => void;
}) {
  const userId = typeof window !== "undefined"
    ? localStorage.getItem("stampi_user_id") ?? "demo-user"
    : "demo-user";
  const isMe = !entry.owner || entry.owner === userId;
  const displayName = isMe ? "You" : (entry.ownerName ?? "A friend");

  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--cream-light)",
        borderRadius: "var(--radius-card)",
        boxShadow: "0 8px 30px rgba(60, 35, 28, 0.18)",
        zIndex,
        cursor: "pointer",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        ...extraStyle,
      }}
    >
      {/* Owner label */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 16,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--brown)",
          opacity: 0.4,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {displayName}
      </div>

      {/* Stamp image */}
      {entry.stampImage.endsWith(".svg") ? (
        <img
          src={entry.stampImage}
          alt={entry.title}
          style={{
            width: "clamp(140px, 50%, 200px)",
            height: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 4px 12px rgba(60,35,28,0.15))",
          }}
        />
      ) : (
        <Stamp
          color={(entry.color as "pink" | "olive" | "soft" | "dark" | "blue") ?? "pink"}
          size={160}
          imageSrc={entry.stampImage}
          style={{ filter: "drop-shadow(0 4px 12px rgba(60,35,28,0.15))" }}
        />
      )}

      {/* Title */}
      <div
        style={{
          fontSize: "clamp(15px, 2vw, 18px)",
          fontWeight: 600,
          color: "var(--brown)",
          textAlign: "center",
          padding: "0 20px",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.title}
      </div>

      {/* Body preview */}
      {entry.body && (
        <div
          style={{
            fontSize: 12,
            color: "var(--brown-light)",
            opacity: 0.7,
            textAlign: "center",
            padding: "0 24px",
            lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {entry.body}
        </div>
      )}

      {/* Time label */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--brown)",
          opacity: 0.4,
          letterSpacing: 0.5,
        }}
      >
        {entry.time}
      </div>
    </div>
  );
}

/* ── Detail modal ──────────────────────────────────────────────────── */

function DetailModal({
  entry,
  onClose,
  onRename,
  onDelete,
}: {
  entry: FeedEntry;
  onClose: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const userId = typeof window !== "undefined"
    ? localStorage.getItem("stampi_user_id") ?? "demo-user"
    : "demo-user";
  const isOwner = !!entry.owner && entry.owner === userId;

  useEffect(() => {
    try {
      const likes = JSON.parse(localStorage.getItem("stampi_likes") ?? "{}");
      setLiked(!!likes[entry.id]);
    } catch { /* */ }
  }, [entry.id]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    try {
      const likes = JSON.parse(localStorage.getItem("stampi_likes") ?? "{}");
      if (next) likes[entry.id] = true; else delete likes[entry.id];
      localStorage.setItem("stampi_likes", JSON.stringify(likes));
    } catch { /* */ }
  };

  const commitRename = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== entry.title) {
      onRename(entry.id, trimmed);
    } else {
      setTitle(entry.title);
    }
    setEditing(false);
  };

  return (
    <>
      {/* Backdrop + centering container */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(60,35,28,0.22)",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >

      {/* Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="stamp-down"
        style={{
          width: "min(92vw, 520px)",
          background: "var(--cream-light)",
          borderRadius: "var(--radius-card)",
          boxShadow: "0 16px 48px rgba(60,35,28,0.25)",
          padding: "clamp(22px, 4vw, 36px)",
          zIndex: 101,
          maxHeight: "85vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {/* Small stamp in top-right corner */}
        {entry.stampImage.endsWith(".svg") ? (
          <img
            src={entry.stampImage}
            alt=""
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 56,
              height: "auto",
              opacity: 0.7,
              filter: "drop-shadow(0 2px 6px rgba(60,35,28,0.12))",
            }}
          />
        ) : (
          <div style={{ position: "absolute", top: 16, right: 16, opacity: 0.7 }}>
            <Stamp
              color={(entry.color as "pink" | "olive" | "soft" | "dark" | "blue") ?? "pink"}
              size={48}
              imageSrc={entry.stampImage}
            />
          </div>
        )}

        <div style={{ fontSize: 13, opacity: 0.55, letterSpacing: 0.5 }}>
          {entry.date}
        </div>
        {editing ? (
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setTitle(entry.title); setEditing(false); }
            }}
            style={{
              margin: "10px 0 14px",
              fontSize: "clamp(22px, 3.5vw, 30px)",
              fontWeight: 600,
              color: "var(--brown)",
              background: "rgba(74,45,38,0.06)",
              border: "1.5px solid var(--pink)",
              borderRadius: 8,
              padding: "4px 8px",
              width: "100%",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        ) : (
          <h2
            onClick={() => setEditing(true)}
            style={{
              margin: "10px 0 14px",
              fontSize: "clamp(22px, 3.5vw, 30px)",
              fontWeight: 600,
              color: "var(--brown)",
              paddingRight: 60,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {title}
            <span style={{ fontSize: "0.5em", opacity: 0.35 }}>&#9998;</span>
          </h2>
        )}
        <p
          style={{
            fontSize: "clamp(14px, 2vw, 17px)",
            lineHeight: 1.7,
            color: "var(--brown-light)",
            margin: 0,
          }}
        >
          {entry.body}
        </p>

        {/* Actions row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <button
            onClick={onClose}
            style={{
              fontSize: 14,
              color: "var(--brown)",
              opacity: 0.5,
              padding: "6px 0",
            }}
          >
            Close
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isOwner && (
              <button
                onClick={() => {
                  if (confirm("Delete this entry?")) onDelete(entry.id);
                }}
                style={{
                  fontSize: 13,
                  color: "#b04040",
                  opacity: 0.7,
                  padding: "6px 0",
                  transition: "opacity 200ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; }}
              >
                Delete
              </button>
            )}
            <button
              onClick={toggleLike}
              style={{
                fontSize: 22,
                color: liked ? "var(--pink)" : "var(--brown-light)",
                transition: "transform 200ms cubic-bezier(0.34, 1.2, 0.45, 1), color 200ms ease",
                transform: liked ? "scale(1.2)" : "scale(1)",
              }}
            >
              {liked ? "♥" : "♡"}
            </button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

/* ── Nav button ────────────────────────────────────────────────────── */

function NavButton({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === "left" ? "Previous" : "Next"}
      style={{
        flexShrink: 0,
        width: 44,
        height: 44,
        borderRadius: 22,
        ...(dir === "right" ? { marginLeft: 12 } : {}),
        background: "rgba(242,232,216,0.85)",
        color: "var(--brown)",
        fontSize: 20,
        fontWeight: 600,
        boxShadow: "0 2px 10px rgba(60,35,28,0.12)",
        backdropFilter: "blur(6px)",
        transition: "transform 180ms ease, box-shadow 180ms ease",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.12)";
        e.currentTarget.style.boxShadow = "0 4px 16px rgba(60,35,28,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 2px 10px rgba(60,35,28,0.12)";
      }}
    >
      {dir === "left" ? "‹" : "›"}
    </button>
  );
}

/* ── Menu button ───────────────────────────────────────────────────── */

function MenuButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 10,
        textAlign: "left",
        fontSize: 15,
        color: "var(--brown)",
        transition: "background 180ms, transform 180ms",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#faf3eb"; e.currentTarget.style.transform = "translateX(4px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translateX(0)"; }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  );
}
