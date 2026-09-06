"use client";

import { ErrorPage } from "@/components/site/error-page";

/* A page, never a JSON blob, for a visitor who was expecting a page. The
   API answers under /api in its own shape; everything else is a page of
   ours with the one button on it. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorPage
      status={500}
      headline="Something broke on our side."
      hint="It has been noted. Give it a moment and try again."
      retry={reset}
    />
  );
}
