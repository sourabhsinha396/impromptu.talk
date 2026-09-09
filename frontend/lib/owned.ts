import { backendFetch } from "@/lib/api";
import type { Bank, Genre } from "@/lib/bank";
import { isOwnSlug, ownSlug } from "@/lib/genres";

export { isOwnSlug, OWN_PREFIX, ownPath, ownSlug } from "@/lib/genres";

/* The genres somebody wrote for themselves. One shape for the list page,
   the editor and the picker, because on the backend they are one table
   with the built-in bank: a genre with an owner, and topics under it. */
export type OwnedTopic = {
  id: number;
  text: string;
  style: string;
  style_label: string;
  /** Ready for an `img` tag, or empty. The row holds a storage key and
      the backend resolves it, so the CDN's name is never in our data. */
  image?: string;
};
export type OwnedGenre = {
  slug: string;
  name: string;
  icon: string;
  topic_count: number;
  /** The link, or null for a genre nobody else can see. */
  share_token: string | null;
  topics: OwnedTopic[];
  /** The styles this genre coined, so the second topic to use one picks
      it from a list instead of retyping it into existence. */
  own_styles: string[];
  /** Whether it holds an uploaded picture, which is what makes it
      unshareable: /g/<token> needs no account, so a shared genre of
      uploads would be image hosting behind a link. */
  has_pictures?: boolean;
};
export type Mine = {
  genres: OwnedGenre[];
  max_genres: number;
  max_topics: number;
  /** Whether the model key is set at all. */
  can_generate: boolean;
  /** Zero both when the allowance is spent and when there is no key, so a
      page asks one question and reads `can_generate` for which. */
  generations_left: number;
};
export type SharedGenre = {
  name: string;
  icon: string;
  /** The owner's name if they gave one, never their address. */
  owner_name: string;
  token: string;
  topics: OwnedTopic[];
};

export const NO_GENRES: Mine = {
  genres: [],
  max_genres: 10,
  max_topics: 200,
  can_generate: false,
  generations_left: 0,
};

/** Every genre this account owns. Empty for a stranger and for a backend
    that is not answering, so the page draws rather than fails. */
export async function fetchMine(): Promise<Mine> {
  try {
    const response = await backendFetch("/api/v1/topics/mine");
    if (!response.ok) return NO_GENRES;
    return (await response.json()) as Mine;
  } catch {
    return NO_GENRES;
  }
}

/** One of this account's genres, or null, which the page turns into a
    404: a slug somebody else holds is not this account's business. */
export async function fetchOwned(slug: string): Promise<OwnedGenre | null> {
  try {
    const response = await backendFetch(`/api/v1/topics/mine/${encodeURIComponent(slug)}`);
    if (!response.ok) return null;
    return (await response.json()) as OwnedGenre;
  } catch {
    return null;
  }
}

/** The genre behind a share link, to anybody holding it. Null for a token
    nobody holds, which includes one whose owner turned sharing off. */
export async function fetchSharedGenre(token: string): Promise<SharedGenre | null> {
  try {
    const response = await backendFetch(`/api/v1/topics/shared/${encodeURIComponent(token)}`);
    if (!response.ok) return null;
    return (await response.json()) as SharedGenre;
  } catch {
    return null;
  }
}

/** The bank with somebody's own genres folded in, which is what the
    picker and the reel read. One payload, one row shape: a topic of
    theirs is a topic, and the round cannot tell the difference. */
export function withOwn(bank: Bank, genres: OwnedGenre[]): Bank {
  if (genres.length === 0) return bank;
  const own: Genre[] = genres.map((genre) => ({
    slug: ownSlug(genre.slug),
    name: genre.name,
    icon: genre.icon,
    blurb: `${genre.topic_count} of your own`,
    own: true,
  }));
  const topics = genres.flatMap((genre) =>
    genre.topics.map((topic) => ({
      text: topic.text,
      genre: ownSlug(genre.slug),
      style: topic.style,
      slug: "",
      image: topic.image,
    })),
  );
  return { ...bank, genres: [...bank.genres, ...own], topics: [...bank.topics, ...topics] };
}

/** A shared genre folded in the same way, for a visit carrying
    `?genre=<token>`. It is somebody else's list, so it is not "yours":
    it rides for this visit and is never written down. */
export function withShared(bank: Bank, shared: SharedGenre): Bank {
  /* The token is the slug, because the link is `/?genre=<token>` and the
     engine picks a genre by finding that slug in the bank. Nothing is
     written down: this genre rides for one visit. */
  const slug = shared.token;
  const genre: Genre = {
    slug,
    name: shared.name,
    icon: shared.icon,
    blurb: shared.owner_name ? `Shared by ${shared.owner_name}` : "Shared with you",
    own: true,
  };
  const topics = shared.topics.map((topic) => ({ text: topic.text, genre: slug, style: topic.style, slug: "" }));
  return { ...bank, genres: [...bank.genres, genre], topics: [...bank.topics, ...topics] };
}
