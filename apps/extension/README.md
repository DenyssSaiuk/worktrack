# WorkTrack browser extension

Manifest V3 extension that observes active-tab focus, drops the query string
by default, and forwards `tab_focus` events to the **WorkTrack desktop agent**
via [Native Messaging][nm]. The agent is the source of authentication and
offline buffering — the extension piggybacks on it.

[nm]: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging

## Build

```bash
pnpm install
pnpm --filter @worktrack/extension build         # both targets
pnpm --filter @worktrack/extension build:chrome  # → dist-chrome/
pnpm --filter @worktrack/extension build:firefox # → dist-firefox/
```

For Chromium: load `dist-chrome/` via `chrome://extensions` → Developer mode →
Load unpacked. Once you have a stable extension id, package via
`zip -r worktrack-chrome.zip dist-chrome/*`.

For Firefox: `web-ext build --source-dir dist-firefox` produces an `.xpi`.

## Native messaging host

The agent installer drops a host manifest in the right OS location:

| OS      | Path                                                                    |
| ------- | ----------------------------------------------------------------------- |
| Windows | `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.worktrack.agent.bridge` (default value = path to a JSON manifest) |
| macOS   | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.worktrack.agent.bridge.json` |
| Linux   | `~/.config/google-chrome/NativeMessagingHosts/com.worktrack.agent.bridge.json` |

The manifest template lives at `native-host/com.worktrack.agent.bridge.json`.
Replace `path` with the absolute path to the bridge binary (a small Rust
helper that connects to the agent's local IPC) and `allowed_origins` with the
deployed extension id.

## Force install

Group Policy / MDM templates:

- Windows / Chromium: `docs/policies/chrome-managed-windows.json` (translate
  to ADMX/ADML or apply via `Computer Configuration → Policies → Administrative
  Templates → Google → Google Chrome → Extensions`).
- Firefox: `docs/policies/firefox-policies.json` (drop into
  `<install dir>/distribution/policies.json` or push via MDM).

## Development tips

- The popup talks to the background via `chrome.runtime.sendMessage` —
  inspect it in the service-worker DevTools (`chrome://extensions` → "Inspect
  views: service worker").
- During offline development the bridge will not connect; events queue in
  `chrome.storage.local` (capped at 5,000 entries) and flush every 30s when
  the bridge reconnects.
