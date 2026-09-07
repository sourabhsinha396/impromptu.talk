/* What somebody has done, as the streak page draws it. The numbers and
   the rows come from the backend in one answer; the arithmetic that turns
   dates into a grid lives here, with no DOM in it, so it is a table of
   tests rather than a page nobody can check. */

import type { Progress } from "@/lib/report";

export type Day = { date: string; count: number; frozen: boolean };
export type Recent = { topic_text: string; genre_slug: string; at: string };
export type History = {
  streak: number;
  longest: number;
  topics: number;
  minutes: number;
  would_be: number;
  days: number;
  runs_kept: number;
  calendar: Day[];
  recent: Recent[];
  share_token?: string | null;
  progress: Progress;
};

/** One person's practice as a stranger may see it. */
export type Shared = {
  name: string;
  streak: number;
  topics: number;
  minutes: number;
  days: number;
  calendar: Day[];
  recent: { text: string; slug: string }[];
};

/** A calendar longer than a quarter wants the whole width; anything
    shorter shares the row with the list beside it on a laptop. */
export function isWide(days: number): boolean {
  return days > 91;
}

export const EMPTY_PROGRESS: Progress = { enough: false, needed: 5, counted: 0, points: [], first: null, latest: null };

export const EMPTY_HISTORY: History = {
  streak: 0,
  longest: 0,
  topics: 0,
  minutes: 0,
  would_be: 0,
  days: 5,
  runs_kept: 25,
  calendar: [],
  recent: [],
  progress: EMPTY_PROGRESS,
};

/** The heading over the calendar is the plan's number, never a fixed word,
    so it cannot name one window while the grid draws another. */
export function windowLabel(days: number): string {
  return days >= 365 ? "Last year" : `Last ${days} days`;
}

/** A calendar of a week or less is a strip of named days; anything longer
    is the heatmap. Five squares in a week grid read as nothing. */
export function isStrip(days: number): boolean {
  return days <= 7;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const delta = Math.max(0, now - Date.parse(iso));
  const days = Math.floor(delta / 86_400_000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(delta / 3_600_000);
  if (hours >= 1) return `${hours}h ago`;
  return `${Math.max(1, Math.floor(delta / 60_000))}m ago`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Monday is 1 and Sunday 7, which is what a week-per-column grid counts
    rows from. */
export function weekdayRow(iso: string): number {
  return ((utcDate(iso).getUTCDay() + 6) % 7) + 1;
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekdayRow(iso) - 1];
}

export type HeatmapLayout = { firstRow: number; columns: number; months: { label: string; column: number }[] };

/** A week per column and a weekday per row, so a year reads left to right
    the way a year happens and the last column is the week you are in. The
    window ends on today, so the first column is the part week: `firstRow`
    drops the opening square onto its own weekday and the rest flow down
    and across. A month is named over the column its first day lands in;
    one landing in the final column goes unnamed, because it has no columns
    to its right and a name wider than its column is the one thing that
    would push the grid into a scrollbar it does not need. */
export function heatmapLayout(dates: string[]): HeatmapLayout {
  if (dates.length === 0) return { firstRow: 1, columns: 0, months: [] };
  const firstRow = weekdayRow(dates[0]);
  const columns = Math.floor((firstRow - 1 + dates.length - 1) / 7) + 1;
  const months: HeatmapLayout["months"] = [];
  dates.forEach((iso, n) => {
    const date = utcDate(iso);
    const column = Math.floor((firstRow - 1 + n) / 7) + 1;
    if (date.getUTCDate() === 1 && column < columns) months.push({ label: MONTHS[date.getUTCMonth()], column });
  });
  return { firstRow, columns, months };
}
