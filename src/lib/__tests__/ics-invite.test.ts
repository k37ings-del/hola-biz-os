import { describe, it, expect } from "vitest";
import { buildIcsInvite, zonedWallTimeToUTC } from "@/lib/ics-invite";

function extract(field: string, ics: string): string {
  const line = ics.split(/\r\n/).find((l) => l.startsWith(field + ":"));
  if (!line) throw new Error(`Missing ${field} in ICS`);
  return line.slice(field.length + 1);
}

function makeIcs(startISO: string, endISO: string, tz?: string) {
  return buildIcsInvite({
    uid: "test-uid@holaweb",
    startsAt: startISO,
    endsAt: endISO,
    summary: "Test appointment",
    description: "Timezone / DST assertion",
    organizerName: "HolaWeb",
    organizerEmail: "orga@holaweb.africa",
    attendeeName: "Staff Member",
    attendeeEmail: "staff@example.com",
    status: "CONFIRMED",
    tenantTimezone: tz,
  });
}

describe("buildIcsInvite — timezone & DST correctness", () => {
  it("Africa/Lagos (no DST): a 09:00 local booking is 08:00 UTC year-round", () => {
    const jan = zonedWallTimeToUTC(2026, 1, 15, 9, 0, "Africa/Lagos");
    const jul = zonedWallTimeToUTC(2026, 7, 15, 9, 0, "Africa/Lagos");
    expect(jan).toBe("2026-01-15T08:00:00.000Z");
    expect(jul).toBe("2026-07-15T08:00:00.000Z");
    const ics = makeIcs(jan, new Date(new Date(jan).getTime() + 3600_000).toISOString(), "Africa/Lagos");
    expect(extract("DTSTART", ics)).toBe("20260115T080000Z");
    expect(extract("DTEND", ics)).toBe("20260115T090000Z");
    expect(ics).toContain("X-WR-TIMEZONE:Africa/Lagos");
  });

  it("Europe/London: 10:00 local before BST (Jan) is 10:00 UTC, after BST start (April) is 09:00 UTC", () => {
    const winter = zonedWallTimeToUTC(2026, 1, 15, 10, 0, "Europe/London");
    const summer = zonedWallTimeToUTC(2026, 4, 15, 10, 0, "Europe/London");
    expect(winter).toBe("2026-01-15T10:00:00.000Z");
    expect(summer).toBe("2026-04-15T09:00:00.000Z");
    const icsSummer = makeIcs(summer, new Date(new Date(summer).getTime() + 3600_000).toISOString(), "Europe/London");
    expect(extract("DTSTART", icsSummer)).toBe("20260415T090000Z");
  });

  it("Europe/London: BST start (2026-03-29) — 09:30 local is 08:30 UTC", () => {
    // BST begins 2026-03-29 at 01:00 UTC (clocks jump to 02:00 local).
    const afterSpring = zonedWallTimeToUTC(2026, 3, 29, 9, 30, "Europe/London");
    expect(afterSpring).toBe("2026-03-29T08:30:00.000Z");
    const ics = makeIcs(afterSpring, new Date(new Date(afterSpring).getTime() + 1800_000).toISOString(), "Europe/London");
    expect(extract("DTSTART", ics)).toBe("20260329T083000Z");
    expect(extract("DTEND", ics)).toBe("20260329T090000Z");
  });

  it("Europe/London: BST end (2026-10-25) — 09:30 local reverts to 09:30 UTC", () => {
    // BST ends 2026-10-25 at 01:00 UTC. After that, local == UTC again.
    const afterFall = zonedWallTimeToUTC(2026, 10, 25, 9, 30, "Europe/London");
    expect(afterFall).toBe("2026-10-25T09:30:00.000Z");
  });

  it("America/New_York: EST winter (Jan) vs EDT summer (July) — 14:00 local", () => {
    const winter = zonedWallTimeToUTC(2026, 1, 15, 14, 0, "America/New_York"); // UTC-5
    const summer = zonedWallTimeToUTC(2026, 7, 15, 14, 0, "America/New_York"); // UTC-4
    expect(winter).toBe("2026-01-15T19:00:00.000Z");
    expect(summer).toBe("2026-07-15T18:00:00.000Z");
  });

  it("America/New_York: DST spring-forward (2026-03-08) — 09:00 local is 13:00 UTC", () => {
    const afterSpring = zonedWallTimeToUTC(2026, 3, 8, 9, 0, "America/New_York");
    expect(afterSpring).toBe("2026-03-08T13:00:00.000Z");
    const ics = makeIcs(afterSpring, new Date(new Date(afterSpring).getTime() + 3600_000).toISOString(), "America/New_York");
    expect(extract("DTSTART", ics)).toBe("20260308T130000Z");
  });

  it("America/New_York: DST fall-back (2026-11-01) — 09:00 local reverts to 14:00 UTC", () => {
    const afterFall = zonedWallTimeToUTC(2026, 11, 1, 9, 0, "America/New_York");
    expect(afterFall).toBe("2026-11-01T14:00:00.000Z");
  });

  it("emits DTSTAMP, METHOD:REQUEST and correct UID/status", () => {
    const start = "2026-05-10T12:00:00.000Z";
    const end = "2026-05-10T13:00:00.000Z";
    const ics = makeIcs(start, end);
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(extract("UID", ics)).toBe("test-uid@holaweb");
    expect(extract("STATUS", ics)).toBe("CONFIRMED");
    expect(extract("DTSTART", ics)).toBe("20260510T120000Z");
    expect(extract("DTEND", ics)).toBe("20260510T130000Z");
  });
});
