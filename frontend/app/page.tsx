/* The page is the tool. The h1 is for crawlers and screen readers; every
   word a visitor sees belongs to the round itself. The round arrives with
   the run-engine cards; until then the page asks the one question. */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="sr-only">Impromptu speaking practice, a free random topic generator and timer</h1>
      <p className="font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl">
        Can you talk for a minute?
      </p>
      <p className="mt-6 text-muted">The round is on its way.</p>
    </main>
  );
}
