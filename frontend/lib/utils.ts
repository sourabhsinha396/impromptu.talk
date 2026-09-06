import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* The shadcn helper its components import by name. Vendored rather than
   generated, because `shadcn init` would rewrite globals.css and its token
   set on top of ours. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
