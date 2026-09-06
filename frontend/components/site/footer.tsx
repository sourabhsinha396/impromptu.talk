import Link from "next/link";

import { Wordmark } from "@/components/site/wordmark";
import { CONTACT_EMAIL, OWNER } from "@/lib/site";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/genres", label: "All genres" },
      { href: "/streak", label: "Your streak" },
      { href: "/pro", label: "Pro" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact us" },
      { href: "/affiliate", label: "Affiliates" },
      { href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms and conditions" },
      { href: "/refunds", label: "Refund policy" },
    ],
  },
];

/* One line of the old about column, kept on every page because it is the
   reason a stranger starts a round without signing up. It says a different
   thing to each of them, and it has to: a stranger is told they need no
   account, which is the promise; somebody signed in is not told anything
   about uploads, because by then their runs are rows on our server, which
   is what makes a streak follow them to a phone. */
export const BOTTOM_LINE = {
  signedOut: "No account needed - your streak lives in this browser.",
  signedIn: "Be shameless, this is your judgement free zone.",
};

/* The footer's one flourish, and it is addressed rather than broadcast: it
   says something to a visitor in India and nothing at all to anybody else,
   so it never guesses out loud. */
function MadeInIndia() {
  return (
    <p className="inline-flex items-center gap-2">
      <svg viewBox="0 0 24 16" className="h-4 w-6 shrink-0" aria-hidden>
        <rect width="24" height="16" rx="2" fill="#ffffff" />
        <path d="M2 0h20a2 2 0 0 1 2 2v3.33H0V2a2 2 0 0 1 2-2z" fill="#ff9933" />
        <path d="M0 10.67h24V14a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z" fill="#138808" />
        <circle cx="12" cy="8" r="2.1" fill="none" stroke="#000080" strokeWidth=".85" />
        <rect x=".5" y=".5" width="23" height="15" rx="1.5" fill="none" stroke="#00000026" />
      </svg>
      Proudly made in India
    </p>
  );
}

export function Footer({
  signedIn,
  inIndia,
  year = new Date().getFullYear(),
}: {
  signedIn: boolean;
  inIndia: boolean;
  year?: number;
}) {
  return (
    <footer className="shrink-0 border-t border-line px-[clamp(16px,4vw,32px)] pt-[34px] pb-10 text-[13.5px] text-muted filming:invisible">
      <div className="mx-auto grid max-w-[80rem] gap-8 sm:grid-cols-2 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        {/* The only place on the site where the name, what it does and who
            owns it are said together. */}
        <div className="sm:col-span-2 md:col-span-1">
          <Wordmark />
          <p className="mt-3 max-w-xs">A random topic, a minute to think, a minute to talk.</p>
          <p className="mt-2 text-xs">
            &copy; {year} {OWNER}
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-[0.08em] text-ink uppercase">{column.title}</p>
            {column.links.map((link) => (
              <Link key={link.href} href={link.href} className="w-fit transition-colors hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-8 flex max-w-[80rem] flex-col gap-2 border-t border-line pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
        <p>{signedIn ? BOTTOM_LINE.signedIn : BOTTOM_LINE.signedOut}</p>
        {inIndia && <MadeInIndia />}
      </div>
    </footer>
  );
}
