export type FeedEntry = {
  id: string;
  time: string;
  date: string;
  title: string;
  body: string;
  color: "pink" | "olive" | "blue" | "soft";
  stampImage: string;
  owner?: string;
  ownerName?: string;
};

export type Friend = {
  id: string;
  name: string;
  feeling: string;
};

export type ActivityItem = {
  id: string;
  who: string;
  action: string;
  when: string;
};

// Fallback entries used when feed-data.json hasn't loaded yet
export const fallbackEntries: FeedEntry[] = [
  {
    id: "e1",
    time: "9:42 PM",
    date: "Today, 9:42 PM",
    title: "Cherry blossom walk",
    body: "Took a long walk through the arboretum after my last lecture. The cherry blossoms finally peaked \u2014 petals drifting across the path like confetti. Sat on the stone bench by the pond and just watched the light change for twenty minutes.",
    color: "pink",
    stampImage: "/stamps/sample-1.svg"
  },
  {
    id: "e2",
    time: "4:11 PM",
    date: "Today, 4:11 PM",
    title: "Print studio session",
    body: "Spent the afternoon at the printmaking lab working on my linocut series. The first two pulls were off-register, but the third came out perfectly. There\u2019s something meditative about carving \u2014 the repetition clears my head.",
    color: "olive",
    stampImage: "/stamps/sample-2.svg"
  },
  {
    id: "e3",
    time: "11:02 AM",
    date: "Today, 11:02 AM",
    title: "Morning reset",
    body: "Brewed loose-leaf oolong and opened every window. Spent an hour reading without checking my phone. The house finch that nests in the maple was singing again \u2014 I\u2019m starting to recognize its call.",
    color: "soft",
    stampImage: "/stamps/sample-3.svg"
  },
  {
    id: "f-maya-1",
    time: "3:15 PM",
    date: "Today, 3:15 PM",
    title: "Rainy cafe sketch",
    body: "Sat by the window at Bluestone and filled two pages with people walking past with umbrellas. The barista gave me a free lavender latte because I drew her.",
    color: "blue" as const,
    stampImage: "/stamps/sample-2.svg",
    owner: "maya-chen",
    ownerName: "Maya Chen"
  },
  {
    id: "f-theo-1",
    time: "7:30 PM",
    date: "Today, 7:30 PM",
    title: "Night market haul",
    body: "Found handmade ceramic chopstick rests shaped like sleeping cats. Also got takoyaki that was way too hot but I ate it anyway. Worth it.",
    color: "olive",
    stampImage: "/stamps/sample-1.svg",
    owner: "theo-park",
    ownerName: "Theo Park"
  },
  {
    id: "f-juno-1",
    time: "12:00 PM",
    date: "Yesterday, 12:00 PM",
    title: "Darkroom afternoon",
    body: "Finally developed the roll from last month's hike. The shot of the fog rolling through the valley came out exactly how I hoped. Pinned it above my desk.",
    color: "pink",
    stampImage: "/stamps/sample-3.svg",
    owner: "juno-arai",
    ownerName: "Juno Arai"
  },
  {
    id: "f-ren-1",
    time: "9:00 AM",
    date: "Yesterday, 9:00 AM",
    title: "Guitar morning",
    body: "Learned the intro to Blackbird before my 10am. My fingers still hurt from the barre chords but it's starting to sound like actual music.",
    color: "soft",
    stampImage: "/stamps/sample-2.svg",
    owner: "ren-takashi",
    ownerName: "Ren Takashi"
  },
  {
    id: "f-sage-1",
    time: "5:45 PM",
    date: "2 days ago, 5:45 PM",
    title: "Sunset on the quad",
    body: "Laid in the grass and watched the clouds change color for an hour. Sage and I didn't even talk much, just existed next to each other. That was enough.",
    color: "olive",
    stampImage: "/stamps/sample-1.svg",
    owner: "sage-okafor",
    ownerName: "Sage Okafor"
  },
  {
    id: "f-iris-1",
    time: "2:20 PM",
    date: "3 days ago, 2:20 PM",
    title: "Thrift store gold",
    body: "Found a vintage corduroy jacket for $12 and a first edition paperback of The Bell Jar. The jacket smells like old books already. Perfect.",
    color: "pink",
    stampImage: "/stamps/sample-3.svg",
    owner: "iris-lam",
    ownerName: "Iris Lam"
  }
];

export const mockFriends: Friend[] = [
  { id: "f1", name: "Maya Chen",   feeling: "happy 🌸" },
  { id: "f2", name: "Theo Park",   feeling: "tired but grateful 🌙" },
  { id: "f3", name: "Juno Arai",   feeling: "excited ✨" },
  { id: "f4", name: "Ren Takashi", feeling: "at peace 🍃" },
  { id: "f5", name: "Sage Okafor", feeling: "nostalgic 🎞" },
  { id: "f6", name: "Iris Lam",    feeling: "cozy ☕" },
];

export const mockActivity: ActivityItem[] = [
  { id: "a1", who: "Maya", action: "stamped your postcard", when: "2m ago" },
  { id: "a2", who: "Theo", action: "sent you a postcard", when: "1h ago" },
  { id: "a3", who: "Juno", action: "started following you", when: "3h ago" },
  { id: "a4", who: "Ren", action: "liked your weekly summary", when: "1d ago" }
];

export const mockProfile = {
  name: "Evelyn",
  handle: "@evelyn",
  weeklyStamps: 3,
  totalStamps: 27
};

// 15-cell stamp grid for create + profile views
export const mockStampGrid = Array.from({ length: 15 }, (_, i) => ({
  id: `s${i}`,
  filled: i < 12
}));
