import { describe, expect, it } from "vitest";

import { heatmapLayout, isStrip, timeAgo, weekdayName, windowLabel } from "@/lib/practice";

describe("the calendar heading", () => {
  /* The heading is the plan's number, never a fixed word, so it cannot
     name one window while the grid draws another. */
  it("names the plan's window and says a year for a year", () => {
    expect(windowLabel(5)).toBe("Last 5 days");
    expect(windowLabel(30)).toBe("Last 30 days");
    expect(windowLabel(365)).toBe("Last year");
  });

  it("draws a week or less as a strip and anything longer as the heatmap", () => {
    expect(isStrip(5)).toBe(true);
    expect(isStrip(7)).toBe(true);
    expect(isStrip(30)).toBe(false);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-09-07T12:00:00Z");

  it("says minutes, then hours, then days, and never zero", () => {
    expect(timeAgo("2026-09-07T11:59:50Z", now)).toBe("1m ago");
    expect(timeAgo("2026-09-07T11:20:00Z", now)).toBe("40m ago");
    expect(timeAgo("2026-09-07T09:00:00Z", now)).toBe("3h ago");
    expect(timeAgo("2026-09-05T12:00:00Z", now)).toBe("2d ago");
  });
});

describe("the heatmap layout", () => {
  const range = (from: string, days: number) =>
    Array.from({ length: days }, (_, n) => {
      const date = new Date(`${from}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + n);
      return date.toISOString().slice(0, 10);
    });

  it("puts the first day on its own weekday row, Monday being row one", () => {
    expect(weekdayName("2026-09-07")).toBe("Mon");
    expect(heatmapLayout(["2026-09-07"]).firstRow).toBe(1);
    expect(heatmapLayout(["2026-09-13"]).firstRow).toBe(7);
  });

  it("counts a week per column, the part week at the start included", () => {
    /* Wednesday to the Tuesday two weeks on: three columns, not two. */
    expect(heatmapLayout(range("2026-09-09", 14)).columns).toBe(3);
    expect(heatmapLayout(range("2026-09-07", 14)).columns).toBe(2);
  });

  it("names a month over the column its first day lands in, and not in the last column", () => {
    /* Thursday 20 August to Saturday 3 October: seven columns, September's
       first over the third, October's first in the seventh and last. */
    const layout = heatmapLayout(range("2026-08-20", 45));
    expect(layout.columns).toBe(7);
    expect(layout.months).toEqual([{ label: "Sep", column: 3 }]);
    /* A window ending on the first of a month: that month has no columns to
       its right, so it goes unnamed. */
    const ending = heatmapLayout(range("2026-09-04", 28));
    expect(ending.months).toEqual([]);
  });

  it("is empty for nothing", () => {
    expect(heatmapLayout([])).toEqual({ firstRow: 1, columns: 0, months: [] });
  });
});
