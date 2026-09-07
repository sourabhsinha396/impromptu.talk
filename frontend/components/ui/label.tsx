import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/* The label over a field, in the shadcn shape. */
export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}
