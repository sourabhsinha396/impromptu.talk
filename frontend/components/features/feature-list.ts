/* The data for /features, approved in docs/mocks/features.html. A plain
   array rather than anything fetched: this is copy about the product, not
   product policy, and it changes exactly when this file changes. */
export type Feature = {
  slug: string;
  name: string;
  blurb: string;
  href: string;
  /** Gated on the viewer's `is_pro`: locked and badged for a reader who
      has not bought it, an ordinary card for one who has. */
  pro?: boolean;
};

export const FREE_FEATURES: Feature[] = [
  { slug: "streak", name: "Streak", blurb: "Comes back tomorrow. Lives in your browser, or on your account.", href: "/streak" },
  { slug: "genres", name: "All genres", blurb: "Open, argue, teach, tell - four ways to be asked the same topic.", href: "/genres" },
  {
    slug: "tongue-twisters",
    name: "Tongue twisters",
    blurb: "Long ones, read aloud off a scroller. Warm up your mouth before you talk.",
    /* The page, not the tool: Streak and All genres already point at
       pages, and unlike picture mode this one has a page worth landing
       on. It is also the link somebody types into a comment reply. */
    href: "/tongue-twisters",
  },
  {
    slug: "image-impromptu",
    name: "Enable Image impromptu",
    blurb: "A photograph instead of a sentence, in every genre. The round is the same.",
    /* The home stage carries no control for it, so this link is the way
       in: it turns the mode on for the visit and remembers it. */
    href: "/?pictures=1",
  },
];

export const PRO_FEATURES: Feature[] = [
  {
    slug: "custom-genre-text",
    name: "Custom genre",
    blurb: "Your own topics, written or pasted, in your own picker.",
    href: "/genres/yours",
    pro: true,
  },
  {
    slug: "custom-genre-image",
    name: "Custom genre (Images)",
    /* Says the private part out loud, because it is the one rule that
       surprises somebody: every other genre they make can be shared. */
    blurb: "Upload your own pictures. A genre with pictures in it stays private.",
    href: "/genres/yours",
    pro: true,
  },
  {
    slug: "custom-tongue-twisters",
    name: "Custom tongue twisters",
    /* Says what is sold rather than what is withheld: reading every
       built-in passage is free at every difficulty, and what Pro buys is
       putting your own words on the same scroller. */
    blurb: "Your own passages on the scroller. A script, a class handout, a twister nobody else has.",
    href: "/pro/custom-tongue-twisters",
    pro: true,
  },
  {
    slug: "history",
    name: "Full history",
    blurb: "Every round you've spoken, not just the last few.",
    href: "/streak",
    pro: true,
  },
];
