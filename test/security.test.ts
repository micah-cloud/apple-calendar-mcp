// Verifies Apple-only outbound URLs, opaque DAV IDs, and secret redaction inside workerd.

import { describe, expect, it, vi } from "vitest";
import { assertAppleCalDavUrl, createAppleFetch, decodeDavId, encodeDavId, normalizeConfiguredHostname, publicError } from "../src/security";

describe("configured MCP hostname", () => {
  it("normalizes an exact DNS hostname", () => {
    expect(normalizeConfiguredHostname(" Calendar.Example.COM. ")).toBe("calendar.example.com");
    expect(normalizeConfiguredHostname()).toBeUndefined();
    expect(normalizeConfiguredHostname("  ")).toBeUndefined();
  });

  it.each([
    "https://calendar.example.com",
    "calendar.example.com/mcp",
    "calendar.example.com?mode=test",
    "calendar.example.com#fragment",
    "user@calendar.example.com",
    "calendar.example.com:443",
    "localhost",
  ])("rejects a non-hostname value: %s", (value) => {
    expect(() => normalizeConfiguredHostname(value)).toThrow("must be a hostname");
  });
});

describe("CalDAV security boundary", () => {
  it("allows the fixed iCloud discovery hosts", () => {
    expect(assertAppleCalDavUrl("https://caldav.icloud.com/.well-known/caldav").hostname).toBe("caldav.icloud.com");
    expect(assertAppleCalDavUrl("https://p123-caldav-current.icloud.com/123/calendars/").hostname).toBe("p123-caldav-current.icloud.com");
  });

  it("rejects non-Apple, HTTP, and credential-bearing URLs before fetch", async () => {
    const upstream = vi.fn<typeof fetch>();
    const guardedFetch = createAppleFetch(upstream);
    await expect(guardedFetch("https://example.com/calendar")).rejects.toThrow("outside the approved Apple hosts");
    await expect(guardedFetch("http://caldav.icloud.com/calendar")).rejects.toThrow("outside the approved Apple hosts");
    await expect(guardedFetch("https://user:pass@caldav.icloud.com/calendar")).rejects.toThrow("must not contain credentials");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("round-trips DAV URLs as opaque identifiers", () => {
    const url = "https://p12-caldav.icloud.com/123/calendars/work/event%20one.ics";
    expect(decodeDavId(encodeDavId(url))).toBe(url);
  });

  it("redacts authorization values", () => {
    expect(publicError(new Error("upstream Basic dXNlcjpwYXNz failed"))).toBe("upstream Basic [REDACTED] failed");
  });
});
