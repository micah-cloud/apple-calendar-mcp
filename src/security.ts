// Enforces the outbound Apple-only boundary and keeps opaque DAV identifiers reversible without storing calendar data.

const APPLE_CALDAV_HOST = /^(?:caldav|p\d+-caldav(?:-current)?)\.icloud\.com$/i;
const DNS_HOSTNAME = /^(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.?$/i;

export function normalizeConfiguredHostname(value?: string): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const candidate = value.trim();
  if (!DNS_HOSTNAME.test(candidate)) {
    throw new Error("MCP_HOSTNAME must be a hostname without a scheme, path, query, fragment, credentials, or port.");
  }
  return candidate.toLowerCase().replace(/\.$/, "");
}

export function assertAppleCalDavUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || !APPLE_CALDAV_HOST.test(url.hostname)) {
    throw new Error("Blocked a CalDAV request outside the approved Apple hosts.");
  }
  if (url.username || url.password) {
    throw new Error("CalDAV URLs must not contain credentials.");
  }
  return url;
}

export function createAppleFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, { ...init, redirect: "manual" });
    assertAppleCalDavUrl(request.url);
    return baseFetch(request);
  };
}

export function encodeDavId(url: string): string {
  assertAppleCalDavUrl(url);
  const bytes = new TextEncoder().encode(url);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeDavId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid DAV identifier.");
  const padded = id.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(id.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return assertAppleCalDavUrl(new TextDecoder().decode(bytes)).href;
}

export function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown calendar error.";
  return message
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]")
    .replace(/([?&](?:password|token|code)=)[^&\s]+/gi, "$1[REDACTED]");
}
