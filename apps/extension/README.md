# WorkTrack browser extension

Manifest V3 extension that observes active-tab focus and POSTs `tab_focus`
events **directly to the WorkTrack backend** on behalf of the signed-in
worker. There is no desktop agent — the popup hosts a login form, the
service worker stores the JWT in `chrome.storage.local` and refreshes it
on demand, and events are buffered locally when the network is down.

## Build

```bash
pnpm install
pnpm --filter @worktrack/extension build         # both targets
pnpm --filter @worktrack/extension build:chrome  # → dist-chrome/
pnpm --filter @worktrack/extension build:firefox # → dist-firefox/
```

For Chromium: load `dist-chrome/` via `chrome://extensions` → Developer
mode → Load unpacked. Once you have a stable extension id, package via
`zip -r worktrack-chrome.zip dist-chrome/*`.

For Firefox: `web-ext build --source-dir dist-firefox` produces an `.xpi`.

## First-run flow

1. Worker clicks the extension toolbar icon → popup opens.
2. Popup shows three fields — **email**, **password**, and **server URL**
   (defaults to `http://localhost:7340`; change for your deployment).
3. On successful sign-in the popup switches to the workday view with a
   **Start Workday** button. Clicking it creates a session via
   `POST /api/v1/me/workday/start`. From that point on, every focused tab
   that isn't a `chrome://` page produces a `tab_focus` event posted to
   `POST /api/v1/me/events`.
4. **Stop Workday** closes the session immediately. The extension stops
   sending events but stays signed in.

Sign-out clears the JWT and the buffered queue.

## Permissions

| Permission                         | Why                                                |
| ---------------------------------- | -------------------------------------------------- |
| `tabs`                             | Read URL + title of the active tab                 |
| `storage`                          | Persist auth, settings, offline queue              |
| `alarms`                           | 30-second flush + heartbeat loop                   |
| `host_permissions: https://*/*` and `http://localhost:7340/*` | CORS for the backend host                          |

There is **no** `nativeMessaging` permission anymore — the v0.1 native
host manifest was removed when the desktop agent was retired for the
web-only deployment.

## Privacy controls

- `domainOnly` (default **true**): only the hostname is sent, never the
  full URL. Disable in settings to record `https://host/path`.
- `paused`: pause button in the popup; no events are sent until you
  resume.
- All events are gated by the user's workday — nothing is sent while
  `/api/v1/me/workday` reports `active: false`.

## Force install

Group Policy / MDM templates remain in `docs/policies/`:

- Windows / Chromium: `docs/policies/chrome-managed-windows.json`
- Firefox: `docs/policies/firefox-policies.json`

## Development tips

- The popup talks to the background via `chrome.runtime.sendMessage` —
  inspect it in the service-worker DevTools (`chrome://extensions` →
  "Inspect views: service worker").
- During offline development events queue in `chrome.storage.local`
  (capped at 5,000 entries) and flush every 30 s when the backend is
  reachable and a workday is active.
