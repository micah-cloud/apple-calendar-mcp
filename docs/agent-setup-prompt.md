# Set up Apple Calendar MCP with an agent

Copy the prompt below into an agent that can inspect your Cloudflare deployment and MCP client. Complete password entry yourself in the Apple and Cloudflare pages.

```text
Help me set up Apple Calendar MCP by following the repository README for current UI details.

1. Guide me through the README's deployment steps. Have me enter the secrets directly in Cloudflare, set my IANA time zone, and turn off the deployment form's **Protect with Cloudflare Access** switch. You can verify setup without knowing my passwords.
2. Wait for me to confirm that the form is configured. Inspect the deployment, check that its endpoint responds, and return the exact HTTPS URL ending in `/mcp`.
3. Guide me through adding that URL to my MCP client. Wait while I review the client name and choose read-only or read/write permission.
4. Refresh the client's tools. Run `calendar_get_profile` and `calendar_list_calendars`; confirm the account, time zone, and expected calendars. Only a successful calendar read verifies the Apple credential.
5. If I want to test writes, explain the README's temporary-calendar test and get my confirmation before creating an event. Use only that calendar, read the latest ETag before each change, and confirm that the test event is gone afterward. If cleanup fails, give me its calendar, title, and time.
6. If iCloud rejects the credential, guide me to replace the app-specific password in Apple and Cloudflare. If tools are missing, refresh them, then reconnect with the intended permission if necessary.

Finish with the endpoint, approved permission, read-check result, write-test result if requested, and any cleanup still required. State any incomplete setup step directly.
```
