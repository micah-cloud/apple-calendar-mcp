import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), objects: vi.fn(), calendars: vi.fn() }));
vi.mock("tsdav", () => ({ createDAVClient: mocks.create }));
import { eventOverlapsRange, getEvent, searchEvents, getAvailability } from "../src/calendar";
import { encodeDavId } from "../src/security";
import { parseIcsEvents } from "../src/ical";
const calendarUrl = "https://caldav.icloud.com/123/calendars/home/";
const objectUrl = calendarUrl + "soccer.ics";
const calendarId = encodeDavId(calendarUrl), eventId = encodeDavId(objectUrl);
const credentials = { username: "owner@example.com", password: "fake-test-only", defaultTimeZone: "America/New_York" };
const master = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:soccer\r\nDTSTART;TZID=America/New_York:20261026T180000\r\nDTEND;TZID=America/New_York:20261026T190000\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nSUMMARY:Soccer\r\nEND:VEVENT\r\nEND:VCALENDAR";
const expanded = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:soccer\r\nRECURRENCE-ID:20261102T230000Z\r\nDTSTART:20261102T230000Z\r\nDTEND:20261103T000000Z\r\nSUMMARY:Soccer\r\nEND:VEVENT\r\nEND:VCALENDAR";
const context = { calendarId, eventId, selfEmail: credentials.username, defaultTimeZone: credentials.defaultTimeZone };
const range = { start: "2026-11-02T05:00:00Z", end: "2026-11-09T05:00:00Z" };
function event(start: string, end: string, allDay = false) { return { ...parseIcsEvents(expanded, context)[0]!, start, end, allDay }; }
beforeEach(() => {
  mocks.create.mockResolvedValue({ fetchCalendars: mocks.calendars, fetchCalendarObjects: mocks.objects });
  mocks.calendars.mockResolvedValue([{ url: calendarUrl, displayName: "Personal", components: ["VEVENT"] }]);
  mocks.objects.mockImplementation(async (args: { expand?: boolean }) => [{ url: objectUrl, data: args.expand ? expanded : master, etag: '"same"' }]);
});
describe("bounded calendar windows", () => {
  it("excludes out-of-range timed and all-day events and exclusive boundaries", () => {
    expect(eventOverlapsRange(event("2026-10-31", "2026-11-01", true), range, "America/New_York")).toBe(false);
    expect(eventOverlapsRange(event("2026-11-01T23:00:00Z", range.start), range, "America/New_York")).toBe(false);
    expect(eventOverlapsRange(event(range.end, "2026-11-09T06:00:00Z"), range, "America/New_York")).toBe(false);
    expect(eventOverlapsRange(event("2026-11-01T23:00:00Z", "2026-11-02T06:00:00Z"), range, "America/New_York")).toBe(true);
    expect(eventOverlapsRange(event("2026-11-04", "2026-11-07", true), range, "America/New_York")).toBe(true);
    expect(eventOverlapsRange(event("2026-11-09", "2026-11-10", true), range, "America/New_York")).toBe(false);
  });
  it("handles all-day overlap in the calendar zone across DST and partial days", () => {
    const dst = { start: "2026-11-01T04:00:00Z", end: "2026-11-02T05:00:00Z" };
    expect(eventOverlapsRange(event("2026-11-01", "2026-11-02", true), dst, "America/New_York")).toBe(true);
    expect(eventOverlapsRange(event("2026-10-31", "2026-11-01", true), dst, "America/New_York")).toBe(false);
    expect(eventOverlapsRange(event("2026-11-02", "2026-11-03", true), { ...dst, end: "2026-11-02T05:00:01Z" }, "America/New_York")).toBe(true);
  });
  it("filters before search totals, pagination and availability", async () => {
    const halloween = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:old\r\nDTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101\r\nSUMMARY:Halloween\r\nEND:VEVENT\r\nEND:VCALENDAR";
    mocks.objects.mockResolvedValue([{ url: calendarUrl + "old.ics", data: halloween }]);
    const result = await searchEvents(credentials, { calendarIds: [calendarId], ...range, limit: 1, offset: 0 });
    expect(result).toMatchObject({ events: [], total: 0, hasMore: false });
    expect(await getAvailability(credentials, [calendarId], range.start, range.end)).toMatchObject({ calendars: [{ busy: [] }] });
  });
});
describe("recurring event detail", () => {
  it("expands an ordinary RRULE occurrence absent from the stored master", async () => {
    const result = await getEvent(credentials, calendarId, eventId, fetch, "2026-11-02T18:00:00-05:00");
    expect(result).toMatchObject({ id: eventId, recurrenceId: "2026-11-02T23:00:00.000Z", start: "2026-11-02T23:00:00.000Z", end: "2026-11-03T00:00:00.000Z", startLocal: "2026-11-02T18:00:00-05:00" });
  });
  it("does not return a different instance or another series for an absent occurrence", async () => {
    await expect(getEvent(credentials, calendarId, eventId, fetch, "2026-11-03T23:00:00Z")).rejects.toThrow("requested recurring occurrence was not found");
    mocks.objects.mockImplementation(async (args: { expand?: boolean }) => [{ url: args.expand ? calendarUrl + "other.ics" : objectUrl, data: args.expand ? expanded : master }]);
    await expect(getEvent(credentials, calendarId, eventId, fetch, "2026-11-02T23:00:00Z")).rejects.toThrow("requested recurring occurrence was not found");
  });
  it("reads an expanded all-day recurrence without converting dates to UTC", async () => {
    const allDayMaster = master.replace("DTSTART;TZID=America/New_York:20261026T180000", "DTSTART;VALUE=DATE:20261026").replace("DTEND;TZID=America/New_York:20261026T190000", "DTEND;VALUE=DATE:20261027");
    const allDayExpanded = expanded.replace("RECURRENCE-ID:20261102T230000Z", "RECURRENCE-ID;VALUE=DATE:20261102").replace("DTSTART:20261102T230000Z", "DTSTART;VALUE=DATE:20261102").replace("DTEND:20261103T000000Z", "DTEND;VALUE=DATE:20261103");
    mocks.objects.mockImplementation(async (args: { expand?: boolean }) => [{ url: objectUrl, data: args.expand ? allDayExpanded : allDayMaster }]);
    expect(await getEvent(credentials, calendarId, eventId, fetch, "2026-11-02")).toMatchObject({ allDay: true, start: "2026-11-02", end: "2026-11-03", recurrenceId: "2026-11-02" });
  });
  it("keeps detached moved exceptions and ordinary master reads unchanged", async () => {
    const moved = expanded.replace("DTSTART:20261102T230000Z", "DTSTART:20261103T000000Z").replace("DTEND:20261103T000000Z", "DTEND:20261103T010000Z");
    mocks.objects.mockResolvedValue([{ url: objectUrl, data: moved }]);
    expect(await getEvent(credentials, calendarId, eventId, fetch, "2026-11-02T23:00:00Z")).toMatchObject({ start: "2026-11-03T00:00:00.000Z" });
    mocks.objects.mockResolvedValue([{ url: objectUrl, data: master }]);
    expect(await getEvent(credentials, calendarId, eventId)).toMatchObject({ start: "2026-10-26T22:00:00.000Z" });
  });
});
