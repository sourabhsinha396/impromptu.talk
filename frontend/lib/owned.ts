import type { Bank, Genre } from "@/lib/bank";
import { isOwnSlug, ownSlug } from "@/lib/genres";

export { isOwnSlug, OWN_PREFIX, ownPath, ownSlug } from "@/lib/genres";

/* The genres somebody wrote for themselves. One shape for the list page,
   the editor and the picker, because on the backend a genre is one table
   with the built-in bank: a genre with an owner, and its rows under it.

   What hangs under it is two tables, and the wire says so: a prompt
   carries `style`, a passage carries `level` and `words`, and each is
   absent on the other kind rather than one key meaning both. */
export type OwnedTopic = {
  id: number;
  text: string;
  /** A prompt's: how it is asked, and what that is called on a page. */
  style?: string;
  style_label?: string;
  /** A passage's: easy or hard, and the count the editor states beside
      it, because the scroller's speed is in words a minute. */
  level?: string;
  words?: number;
  /** A passage's own name. Empty on a prompt, which is addressed by its
      text; a passage needs one because the warm-up page keys the best
      speed per passage on it, and because an empty one is a value that
      matches an empty search (see `withOwn`). */
  slug?: string;
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
  /** "read" on a warm-up somebody wrote: passages read aloud off the
      scroller rather than prompts to talk about. Absent otherwise. */
  mode?: "read";
  /** The cap this genre is held to, which differs by mode: a passage is a
      hundred words, so a warm-up holds far fewer rows than a genre. */
  max_topics?: number;
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
  /** The cap a warm-up is held to, which is far lower than a genre's: a
      passage is a hundred words, so fifty is already a long page. */
  max_passages?: number;
};
export type SharedGenre = {
  name: string;
  icon: string;
  /** The owner's name if they gave one, never their address. */
  owner_name: string;
  token: string;
  topics: OwnedTopic[];
};

/* The picture ceiling, in step with `MAX_BYTES` in
   backend/apps/topics/pictures.py. Checked here too so an oversized file
   is refused before it is uploaded: the backend reads the size and not
   the bytes, but the browser still has to push the whole body up the
   wire before it hears the refusal, which on a phone is the slow half. */
export const MAX_PICTURE_BYTES = 1024 * 1024;
export const PICTURE_TOO_BIG = "That picture is over 1MB. Try a smaller one.";

export const NO_GENRES: Mine = {
  genres: [],
  max_genres: 10,
  max_topics: 200,
  can_generate: false,
  generations_left: 0,
};

/** The bank with somebody's own genres folded in, which is what the
    picker and the reel read. One payload, one row shape: a topic of
    theirs is a topic, and the round cannot tell the difference. */
/** Whether a genre somebody owns is a warm-up. */
export function isOwnRead(genre: OwnedGenre): boolean {
  return genre.mode === "read";
}

export function withOwn(bank: Bank, genres: OwnedGenre[]): Bank {
  if (genres.length === 0) return bank;
  const own: Genre[] = genres.map((genre) => ({
    slug: ownSlug(genre.slug),
    name: genre.name,
    icon: genre.icon,
    blurb: `${genre.topic_count} of your own`,
    own: true,
    mode: genre.mode,
  }));
  const topics = genres.flatMap((genre) =>
    genre.topics.map((topic) => ({
      text: topic.text,
      genre: ownSlug(genre.slug),
      style: topic.style,
      /* Carried as its own key, so the warm-up page's difficulty filter
         narrows somebody's own passages exactly as it narrows the
         built-in ones. Read off `style`, an owned passage was invisible
         to every filter the moment the two stopped sharing a column. */
      level: topic.level,
      /* A real name, and the bug that came of not having one: every row
         here carried `slug: ""`, and the warm-up page looks its opening
         passage up with `find(topic => topic.slug === asked)` where
         `asked` is "" whenever the URL names none. So the moment somebody
         owned a passage, the page opened on *their* row, handed the engine
         an empty slug, and the engine - which resolves that slug against
         the bank - found nothing, stayed idle and drew a blank screen.
         An empty string is not an absent value; it is a value that
         matches. */
      slug: topic.slug ?? "",
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
