import { Button } from "@/components/site/button";
import { ChevronDownIcon, GenreIcon, SettingsIcon } from "@/components/site/icons";

/* How long they will talk, as the question says it. The number follows the
   setting, so nobody is surprised by the clock. "a minute" reads better
   than "1 minute" and is the only one worth spelling out by hand. */
export function speakingLength(seconds: number): string {
  if (seconds === 60) return "a minute";
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds % 60) return `${Math.floor(seconds / 60)} min ${seconds % 60}s`;
  return `${seconds / 60} minutes`;
}

/* The first screen, as approved in docs/mocks/home.html: the genre chip
   and the settings gear above the question, the question in the accent,
   one button that says Spin, nothing else. Without handlers it is the
   server's first paint; the round attaches them a frame later. */
export function Idle({
  genre,
  speakSeconds,
  onSpin,
  onGenre,
  onSettings,
}: {
  genre: { name: string; icon: string };
  speakSeconds: number;
  onSpin?: () => void;
  onGenre?: () => void;
  onSettings?: () => void;
}) {
  return (
    <main className="flex min-h-[calc(100dvh-var(--header-h))] flex-1 flex-col items-center justify-center px-[clamp(16px,4vw,32px)] py-6 text-center">
      <h1 className="sr-only">Impromptu speaking practice, a free random topic generator and timer</h1>
      <div className="mb-6 flex items-center justify-center gap-2">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onGenre}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-card2 pr-3.5 pl-3 text-sm font-semibold text-ink transition-colors hover:border-accent"
        >
          <GenreIcon icon={genre.icon} className="text-accent" />
          {genre.name}
          <ChevronDownIcon size={14} className="-ml-0.5 text-muted" />
        </button>
        <button
          type="button"
          aria-label="Settings"
          title="Settings"
          aria-haspopup="dialog"
          onClick={onSettings}
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-card2 text-muted transition-colors hover:border-accent hover:text-ink"
        >
          <SettingsIcon size={18} />
        </button>
      </div>
      <p className="font-display text-headline font-semibold text-accent text-balance">
        Can you talk for {speakingLength(speakSeconds)}?
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button size="xl" onClick={onSpin}>
          Spin
        </Button>
      </div>
    </main>
  );
}
