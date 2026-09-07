/* The second door, drawn only when a client id ships (the backend's own
   keys are what actually turn it on; this only decides whether the button
   renders, per docs/mocks/signin.html: neither is on the page until both
   of its keys are set). A plain anchor, not a form: OAuth needs a real
   top-level navigation so Google can redirect the browser back, which a
   fetch cannot do. It goes through the `/api` rewrite like every other
   request, so the session it ends in lands on this site's own origin. */
export function GoogleButton({ next }: { next: string }) {
  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;
  const href = next === "/" ? "/api/v1/auth/google" : `/api/v1/auth/google?next=${encodeURIComponent(next)}`;

  return (
    <>
      <a
        href={href}
        className="mt-[26px] flex w-full items-center justify-center gap-2.5 rounded-full border border-line-strong px-5 py-[13px] text-[15.5px] font-semibold text-ink"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[18px]">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8H1.3v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.5-3.5A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
        </svg>
        Continue with Google
      </a>
      <p className="mt-[18px] mb-[-6px] flex items-center gap-3 text-[12.5px] font-semibold tracking-[.04em] text-muted uppercase before:h-px before:flex-1 before:bg-line before:content-[''] after:h-px after:flex-1 after:bg-line after:content-['']">
        or
      </p>
    </>
  );
}
