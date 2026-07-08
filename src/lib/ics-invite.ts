/**
 * Builds an RFC 5545 VCALENDAR/VEVENT invite (METHOD:REQUEST) suitable for
 * Gmail / Outlook / Apple Mail auto-add.
 *
 * DTSTART / DTEND are emitted as absolute UTC instants (Z-suffix). Because
 * timestamptz values are absolute instants, UTC is unambiguous across DST
 * transitions — every calendar client renders each instant in the recipient's
 * local zone. X-WR-TIMEZONE is a display hint only; it never shifts the event.
 */
export function buildIcsInvite(opts: {
  uid: string;
  startsAt: string; // ISO 8601 (timestamptz)
  endsAt: string;
  summary: string;
  description: string;
  organizerName: string;
  organizerEmail?: string;
  attendeeName?: string;
  attendeeEmail: string;
  status: "CONFIRMED" | "CANCELLED";
  tenantTimezone?: string;
}): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const z = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}T${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}Z`;
  };
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const organizer = opts.organizerEmail
    ? `ORGANIZER;CN=${esc(opts.organizerName)}:mailto:${opts.organizerEmail}`
    : `ORGANIZER;CN=${esc(opts.organizerName)}:mailto:noreply@holaweb.africa`;
  const attendee = `ATTENDEE;CN=${esc(opts.attendeeName ?? opts.attendeeEmail)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION;ROLE=REQ-PARTICIPANT:mailto:${opts.attendeeEmail}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HolaWeb//Business OS//EN",
    "METHOD:REQUEST",
    "CALSCALE:GREGORIAN",
  ];
  if (opts.tenantTimezone) lines.push(`X-WR-TIMEZONE:${esc(opts.tenantTimezone)}`);
  lines.push(
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(opts.startsAt)}`,
    `DTEND:${fmt(opts.endsAt)}`,
    `SUMMARY:${esc(opts.summary)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    organizer,
    attendee,
    `STATUS:${opts.status}`,
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return lines.join("\r\n");
}

/**
 * Convert a wall-clock time in a given IANA timezone to its UTC ISO instant.
 * Used both in tests and in tools that need to convert a tenant-local booking
 * time back to a UTC timestamptz.
 *
 * Works across DST boundaries by measuring the observed offset for the target
 * instant using `Intl.DateTimeFormat` in the given zone.
 */
export function zonedWallTimeToUTC(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  // First guess: treat the wall time as if it were UTC.
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Then compute the zone's offset at that instant and correct.
  const offsetMinutes = tzOffsetMinutes(new Date(guess), timeZone);
  const utc = guess - offsetMinutes * 60_000;
  return new Date(utc).toISOString();
}

function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUTC - date.getTime()) / 60_000);
}
