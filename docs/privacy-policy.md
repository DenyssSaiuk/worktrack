# WorkTrack — Privacy policy template

> **Adapt before publishing.** Replace `[Organization]` and `[contact email]`,
> add your jurisdiction-specific text (Ukrainian Law on Personal Data
> Protection, GDPR, CCPA…) reviewed by counsel, and link the deployed copy
> from the agent enrollment screen and dashboard footer.

## What is collected

While you are signed in to the WorkTrack desktop agent and your scheduled
work hours are active, the agent records the following metadata:

- The name of the foreground application and the title of its current window
- The active browser tab's domain (and, if your organization opts in, the
  path component — never the query string or fragment)
- Idle / active state derived from system input timing (no keystrokes or
  clipboard contents are recorded — ever)
- Your private-session boundaries (start and stop only, never any data
  captured during a private session)

If your organization has opted in to **manager-requested screenshots**, a
single screenshot may be captured when your manager explicitly requests one.
Screenshots are never collected on a fixed schedule and never automatically
in response to activity. They are encrypted at rest with a key derived
per-organization and only managers / admins of your organization can review
them. WorkTrack does not analyse screenshots with any AI or third-party
service.

## What is **not** collected

- Keystrokes, clipboard contents, file contents, microphone or camera input
- Anything outside your scheduled work hours
- Anything during a private session — the only events recorded are the start
  and end timestamps of the private session itself
- Your home network traffic when you are not signed in to the agent

## How long it is kept

Raw activity events are retained for `[retention period — default 90 days]`
after which they are automatically deleted. Daily aggregated summaries are
retained indefinitely for trend analysis but contain no per-event detail.

## Your rights

You may at any time:

- **Export your data**: `GET /api/v1/me/data-export` (also exposed in the
  dashboard's Account page) returns a downloadable archive of every event
  associated with your account
- **Request erasure**: contact `[contact email]` — your account is suspended
  immediately, and after a `[grace period]` your raw events and PII are
  permanently deleted (audit-log entries are retained as required by
  applicable law, with PII redacted)
- **Withdraw consent**: end your current workday, sign out of the agent, and
  notify your manager. You will not be able to perform work that requires
  WorkTrack until consent is re-given.

## Who has access

- **You**: full access to your own data via the agent and dashboard
- **Your manager**: aggregated and per-day summaries, plus screenshot review
  queue if enabled
- **`[Organization]` admins**: configuration of rules, retention, and
  enrolment; full audit trail of administrative actions
- **`[Organization]` security team**: access to audit logs only
- **No third party** receives your data. WorkTrack runs on
  `[Organization]`-controlled infrastructure with no outbound integrations.

## Contact

`[contact email]`
