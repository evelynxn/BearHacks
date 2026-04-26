"use client";

import { useState, useEffect } from "react";
import Pills from "../../components/Pills";
import SideTabs from "../../components/SideTabs";
import Stamp from "../../components/Stamp";
import { FeedEntry, fallbackEntries } from "../../lib/mock-data";
import { loadFeedEntries } from "../../lib/feed-store";

const EXTRA_STAMPS: FeedEntry[] = [
  {
    id: "ex1",
    time: "8:15 AM",
    date: "Yesterday, 8:15 AM",
    title: "Foggy campus run",
    body: "Ran through the fog at sunrise. Couldn\u2019t see past the library steps. Everything felt dreamlike and muffled, just my footsteps and breath.",
    color: "blue" as const,
    stampImage: "/stamps/sample-1.svg",
  },
  {
    id: "ex2",
    time: "1:30 PM",
    date: "Yesterday, 1:30 PM",
    title: "Ramen with Theo",
    body: "Tried the new ramen spot off 4th. The tonkotsu was rich and silky. Theo spilled chili oil everywhere and we couldn\u2019t stop laughing.",
    color: "olive",
    stampImage: "/stamps/sample-2.svg",
  },
  {
    id: "ex3",
    time: "6:45 PM",
    date: "2 days ago, 6:45 PM",
    title: "Golden hour sketch",
    body: "Sat on the fire escape with my sketchbook. Drew the rooftops in that last warm light. Pages are getting full\u2014need a new book soon.",
    color: "pink",
    stampImage: "/stamps/sample-3.svg",
  },
  {
    id: "ex4",
    time: "10:00 AM",
    date: "3 days ago, 10:00 AM",
    title: "Vinyl haul",
    body: "Found a mint condition Khruangbin LP at the flea market for $8. Also grabbed a Vince Guaraldi for dad\u2019s birthday.",
    color: "soft",
    stampImage: "/stamps/sample-1.svg",
  },
  {
    id: "ex5",
    time: "3:20 PM",
    date: "3 days ago, 3:20 PM",
    title: "Pottery glazing day",
    body: "Applied the celadon glaze to my tea bowl. Won\u2019t know how it turned out until next week\u2019s firing. The waiting is the hardest part.",
    color: "olive",
    stampImage: "/stamps/sample-2.svg",
  },
  {
    id: "ex6",
    time: "7:00 PM",
    date: "4 days ago, 7:00 PM",
    title: "Sunset bike ride",
    body: "Biked along the river trail as the sky turned pink and orange. Wind in my face, playlist on shuffle. Didn\u2019t want to stop.",
    color: "pink",
    stampImage: "/stamps/sample-3.svg",
  },
  {
    id: "ex7",
    time: "11:45 AM",
    date: "5 days ago, 11:45 AM",
    title: "Farmers market find",
    body: "Scored the last basket of strawberries. So sweet they taste like candy. Made jam with half and ate the rest standing at the counter.",
    color: "soft",
    stampImage: "/stamps/sample-1.svg",
  },
  {
    id: "ex8",
    time: "2:10 PM",
    date: "5 days ago, 2:10 PM",
    title: "Library nap",
    body: "Fell asleep on the third floor of the library with my book open on my chest. Woke up to rain on the skylight. Perfect accident.",
    color: "blue" as const,
    stampImage: "/stamps/sample-2.svg",
  },
  {
    id: "ex9",
    time: "9:30 AM",
    date: "6 days ago, 9:30 AM",
    title: "Morning bake",
    body: "Made sourdough for the first time. The crumb was uneven but the crust crackled when I cut it. Smeared with salted butter.",
    color: "olive",
    stampImage: "/stamps/sample-3.svg",
  },
];

const COLORS: Array<"dark" | "pink" | "olive" | "blue" | "soft"> = [
  "dark",
  "pink",
  "olive",
  "blue",
  "soft",
];

export default function ExplorePage() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [selected, setSelected] = useState<FeedEntry | null>(null);

  useEffect(() => {
    loadFeedEntries().then((feed) => {
      // combine real feed + extra stamps, deduplicate by id
      const seen = new Set<string>();
      const all: FeedEntry[] = [];
      for (const e of [...feed, ...EXTRA_STAMPS, ...fallbackEntries]) {
        if (!seen.has(e.id)) {
          seen.add(e.id);
          all.push(e);
        }
      }
      setEntries(all);
    });
  }, []);

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
      <div style={{ width: "100%", maxWidth: 1200 }}>
        <Pills active="explore" />
      </div>
      <SideTabs />

      <div
        style={{
          padding: "30px 24px 80px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: 18,
          justifyItems: "center",
          width: "100%",
          maxWidth: 1200,
        }}
      >
        {entries.map((e, i) => (
          <div
            key={`${e.id}-${i}`}
            onClick={() => setSelected(e)}
            className="float-up"
            style={{
              animationDelay: `${i * 40}ms`,
              cursor: "pointer",
              transition:
                "transform 200ms cubic-bezier(0.34, 1.2, 0.45, 1)",
            }}
            onMouseEnter={(el) => {
              el.currentTarget.style.transform = "scale(1.08) rotate(3deg)";
            }}
            onMouseLeave={(el) => {
              el.currentTarget.style.transform = "scale(1) rotate(0deg)";
            }}
          >
            <Stamp
              color={COLORS[i % COLORS.length]}
              size={120}
              rotate={(i % 5) - 2}
              imageSrc={e.stampImage.endsWith(".svg") ? undefined : e.stampImage}
            />
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
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
          <div
            onClick={(ev) => ev.stopPropagation()}
            className="stamp-down"
            style={{
              width: "min(92vw, 480px)",
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
            {/* Small stamp corner */}
            {selected.stampImage.endsWith(".svg") ? (
              <img
                src={selected.stampImage}
                alt=""
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 48,
                  height: "auto",
                  opacity: 0.7,
                }}
              />
            ) : (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  opacity: 0.7,
                }}
              >
                <Stamp
                  color={
                    (selected.color as
                      | "pink"
                      | "olive"
                      | "soft"
                      | "dark"
                      | "blue") ?? "pink"
                  }
                  size={48}
                  imageSrc={selected.stampImage}
                />
              </div>
            )}

            <div style={{ fontSize: 13, opacity: 0.55, letterSpacing: 0.5 }}>
              {selected.date}
            </div>
            <h2
              style={{
                margin: "10px 0 14px",
                fontSize: "clamp(20px, 3vw, 26px)",
                fontWeight: 600,
                color: "var(--brown)",
                paddingRight: 60,
              }}
            >
              {selected.title}
            </h2>
            <p
              style={{
                fontSize: "clamp(14px, 2vw, 16px)",
                lineHeight: 1.7,
                color: "var(--brown-light)",
                margin: 0,
              }}
            >
              {selected.body}
            </p>
            <button
              onClick={() => setSelected(null)}
              style={{
                marginTop: 20,
                fontSize: 14,
                color: "var(--brown)",
                opacity: 0.5,
                padding: "6px 0",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
