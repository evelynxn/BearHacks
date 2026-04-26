// TODO(backend): replace mock data with real API calls to NEXT_PUBLIC_ORCHESTRATOR_URL.

export type JournalEntry = {
  id: string;
  date: string;
  title: string;
  body: string;
  color: "pink" | "olive" | "blue" | "soft";
  stampImages: string[];
};

export type Friend = {
  id: string;
  name: string;
};

export type ActivityItem = {
  id: string;
  who: string;
  action: string;
  when: string;
};

export const mockEntries: JournalEntry[] = [
  {
    id: "e1",
    date: "Today, 9:42pm",
    title: "Bloom day",
    body:
      "Walked through the park after class and the cherry blossoms were finally open. Sat on a bench and ate a peach. The light was the soft kind I keep meaning to bottle.",
    color: "pink",
    stampImages: []
  },
  {
    id: "e2",
    date: "Today, 4:11pm",
    title: "Studio afternoon",
    body:
      "Stayed late printing. Smudged the second proof but the third one came out clean. Coffee tasted burnt and I loved it anyway.",
    color: "olive",
    stampImages: []
  },
  {
    id: "e3",
    date: "Today, 11:02am",
    title: "Quiet morning",
    body:
      "Made tea, opened the window, listened to the bird that lives in the maple. No phone for an hour.",
    color: "soft",
    stampImages: []
  }
];

export const mockFriends: Friend[] = [
  { id: "f1", name: "Maya" },
  { id: "f2", name: "Theo" },
  { id: "f3", name: "Juno" },
  { id: "f4", name: "Ren" },
  { id: "f5", name: "Sage" },
  { id: "f6", name: "Iris" }
];

export const mockActivity: ActivityItem[] = [
  { id: "a1", who: "Maya", action: "stamped your postcard", when: "2m" },
  { id: "a2", who: "Theo", action: "sent you mail", when: "1h" },
  { id: "a3", who: "Juno", action: "started following you", when: "3h" },
  { id: "a4", who: "Ren", action: "liked your weekly summary", when: "1d" }
];

export const mockProfile = {
  name: "evelyn",
  handle: "@evelyn",
  weeklyStamps: 3,
  totalStamps: 27
};

// 15-cell stamp grid for create + profile views
export const mockStampGrid = Array.from({ length: 15 }, (_, i) => ({
  id: `s${i}`,
  filled: i < 12
}));
