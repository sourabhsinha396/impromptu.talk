import Link from "next/link";

/* The frame every written page wears: about, contact, and the three the
   law asks for. One width and one heading scale for all five, because a
   policy that looks like a different site on every page is a policy
   nobody finishes reading. 66 characters a line in the prose, which is
   where a paragraph stops being a wall.

   The heading is the page's name and nothing else. These are documents
   somebody arrives at to check a fact - what is stored, how long a
   refund takes - and a line of voice above the answer is one more thing
   between them and it. The label above the headline went with it: it
   only ever repeated the name. */
export function Doc({
  name,
  updated,
  children,
}: {
  name: string;
  /** The date on the paperwork. Absent on about and contact, which are
      not promises and do not need one. */
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-[clamp(16px,4vw,32px)] pt-11 pb-[72px]">
      <h1 className="font-display text-[clamp(1.9rem,5vw,2.6rem)] leading-[1.1] font-semibold tracking-[-0.02em]">
        {name}
      </h1>
      {updated && <p className="mt-3 text-[13px] text-muted">Last updated {updated}.</p>}
      <div className="mt-6.5 text-[16.5px] leading-[1.65] [&_a]:font-semibold [&_a]:text-accent-strong [&_code]:rounded-md [&_code]:border [&_code]:border-line [&_code]:bg-card2 [&_code]:px-1.5 [&_code]:py-px [&_code]:text-sm [&_h2]:mt-8.5 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_li]:my-1.5 [&_p]:mb-4 [&_p]:max-w-[66ch] [&_ul]:mb-4 [&_ul]:max-w-[66ch] [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}

/** A link inside the prose. Internal ones go through Next so the round
    is not reloaded from scratch on the way back to it. */
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  if (href.startsWith("/")) return <Link href={href}>{children}</Link>;
  return <a href={href}>{children}</a>;
}
