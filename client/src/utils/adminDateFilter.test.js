import { describe, expect, it } from "vitest";
import { filterRecordsByDate } from "./adminDateFilter.js";

describe("filterRecordsByDate", () => {
  const records = [
    { id: "today-start", createdAt: "2026-11-07T00:00:00" },
    { id: "today-end", createdAt: "2026-11-07T23:59:59.999" },
    { id: "yesterday", createdAt: "2026-11-06T23:59:59.999" },
    { id: "week-start", createdAt: "2026-11-02T00:00:00" },
    { id: "month-start", createdAt: "2026-11-01T00:00:00" },
  ];

  it("filters today and the current week inclusively using local calendar dates", () => {
    const now = new Date(2026, 10, 7, 12);
    expect(filterRecordsByDate(records, { period: "today" }, now).map(({ id }) => id))
      .toEqual(["today-start", "today-end"]);
    expect(filterRecordsByDate(records, { period: "this_week" }, now).map(({ id }) => id))
      .toEqual(["today-start", "today-end", "yesterday", "week-start"]);
  });

  it("applies custom date bounds to the displayed records", () => {
    expect(filterRecordsByDate(records, {
      period: "custom",
      start: "2026-11-06",
      end: "2026-11-07",
    }).map(({ id }) => id)).toEqual(["today-start", "today-end", "yesterday"]);
  });

  it("returns an empty result for a reversed custom date range", () => {
    expect(filterRecordsByDate(records, {
      period: "custom",
      start: "2026-11-08",
      end: "2026-11-06",
    })).toEqual([]);
  });
});
