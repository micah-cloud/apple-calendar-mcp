# Apple Calendar MCP

This repository provides single-account iCloud Calendar access through a stateless MCP server on Cloudflare Workers.

## Boundaries

- Keep the Worker single-owner and stateless. OAuth state belongs in the `OAUTH_KV` binding.
- Keep Apple credentials in the Worker secrets `ICLOUD_USERNAME` and `ICLOUD_APP_PASSWORD`. Logs, errors, fixtures, and documentation must contain no credential values.
- Send authenticated CalDAV requests only to discovered HTTPS Apple hosts. Tool arguments never select an upstream host.
- Treat calendar and event hrefs as opaque identifiers. Mutations must use the latest ETag and surface conflicts.
- Expose mutation tools only when the OAuth grant contains `calendar:write`.
- Preserve unsupported iCalendar properties during unrelated updates.
- Keep account-specific routes, identifiers, and operational notes outside this repository.

## Checks

Run these checks serially before committing:

```bash
bun run test
bun run typecheck
bun run cloudflare:check
```

The change is complete when the checks pass and tracked files contain no account-specific hostname, Cloudflare account or binding ID, Apple email address, secret value, or private repository link.

## Documentation

Keep setup steps in the README. Keep the copyable agent procedure in `docs/agent-setup-prompt.md`. Update both when a deployment or authorization step changes.
