# Notification-only server deployment

This release detects new Airbnb and Gathern messages independently of the Unified Inbox UI. It uses the browser sessions already synchronized by the installed Electron 3.0.1 clients. It does not monitor or store WhatsApp messages and does not require a new employee installer.

## What is deployed

- Authenticated web notification feed: `/api/notifications/live`.
- Global in-app toast, Windows Web Notification, and an audible alert.
- A single-instance PM2 worker that checks the first inbox page every 15 seconds.
- Two additive MariaDB tables for durable per-thread baselines and deduplication.
- Existing `notifications` rows continue to provide maintenance and system alerts.

The first successful worker cycle establishes a silent baseline. Existing messages do not generate a notification storm. Later incoming messages generate one durable event. Host/owner replies update the baseline without notifying.

## Before deployment

1. Merge `codex/notification-hotfix` into the production branch through the repository review flow.
2. Make a restorable database backup.
3. Confirm the application directory. The supplied PM2 file assumes `C:\inetpub\wwwroot\nested-united`; edit `cwd` in `pm2.notifications.config.js` if the production checkout is elsewhere.
4. Record the current production commit and PM2 state:

   ```powershell
   git rev-parse HEAD
   pm2 list
   pm2 save
   ```

## Pull and install

Run these commands from an elevated PowerShell session on the Windows Server. Replace `<production-branch>` with the branch actually deployed (for example `main` or `production`).

```powershell
Set-Location -LiteralPath 'C:\inetpub\wwwroot\nested-united'
git status --short
git fetch origin
git pull --ff-only origin <production-branch>
npm ci
```

Stop if `git status --short` shows server-only edits that must be preserved. Do not reset or overwrite them.

## Apply the database migration manually

The migration is additive and does not alter existing inbox tables. Execute this file against the production `rentals_dashboard` database before restarting the website:

`deployment\database\notifications\001_notification_only.sql`

With the MariaDB/MySQL command-line client from `cmd.exe`:

```bat
mysql.exe -h 127.0.0.1 -u YOUR_DB_USER -p rentals_dashboard < C:\inetpub\wwwroot\nested-united\deployment\database\notifications\001_notification_only.sql
```

Alternatively, use the Import tab in HeidiSQL/phpMyAdmin and upload the SQL file itself. Do not copy it from rendered chat text. The file explicitly selects `rentals_dashboard`; a successful result lists both new tables. Never put the database password directly in command history.

Then run the read-only verification file:

`deployment\database\notifications\002_verify_notification_only.sql`

The first result must list exactly:

- `browser_message_notifications`
- `browser_notification_state`

## Build and start

```powershell
npm run build
pm2 list
```

Restart the existing Next.js web process using its exact name from `pm2 list`. Do not guess its name:

```powershell
pm2 restart <existing-web-process-name> --update-env
pm2 startOrReload pm2.notifications.config.js --update-env
pm2 save
pm2 status browser-notifications
pm2 logs browser-notifications --lines 100
```

Expected startup log:

```text
[NotificationWorker] Started; interval=15000ms
```

The first cycle normally reports no new notifications because it creates the baseline.

## Employee activation

No installer is required.

1. Ask employees to close and reopen NestedUnited after the server deployment, or refresh its main system page.
2. Each Windows/user profile clicks `تفعيل الصوت وإشعارات ويندوز` once.
3. Windows notification permission for NestedUnited/the site must remain enabled.
4. Airbnb and Gathern account windows should be opened after login changes so Electron refreshes the server-side session. Version 3.0.1 also refreshes open account cookies periodically.

## End-to-end acceptance test

Perform one platform at a time:

1. Keep an authorized employee on any dashboard or employee-portal page.
2. Open the relevant Airbnb/Gathern browser account once and confirm it is logged in.
3. Wait for one successful worker cycle and confirm `poll_error` is `NULL` using the verification SQL.
4. Send a new guest message from a different account/device. Do not send it as the host.
5. Allow up to 20 seconds: worker interval is 15 seconds and browser feed interval is 5 seconds.
6. Confirm all three results: in-app toast, Windows notification, and sound.
7. Confirm exactly one new row appears in `browser_message_notifications` and repeated polls do not create another row.
8. Send a host reply and confirm it does not produce a “new guest message” notification.

## Troubleshooting

- `notification-worker:missing_session`: open/login to that platform account in an installed Electron client, reload the account window, then wait up to five minutes for session refresh.
- `notification-worker:missing_inbox_hash`: open the Airbnb inbox window and reload it so the current persisted-query hash is captured.
- `notification-worker:http_401` or `http_403`: the saved session expired; log in again in the account browser window.
- `notification-worker:http_429`: stop the worker temporarily and increase `NOTIFICATION_POLL_INTERVAL_MS` in the PM2 config before restarting.
- `notification-worker:graphql_error`: Airbnb changed the inbox operation/shape; keep the worker running only after a fresh account window supplies the current hash and the parser is verified.
- Toast works but sound does not: click the activation button once and check Windows Volume Mixer/notification settings.
- Maintenance works but messages do not: check `pm2 logs browser-notifications`, then run `002_verify_notification_only.sql` and inspect `last_poll_at`/`poll_error` without viewing or copying session fields.

## Safe rollback

Stop only the notification worker:

```powershell
pm2 stop browser-notifications
pm2 save
```

Revert the notification commits through Git and rebuild/restart the existing web process. The two additive tables can remain; they are inert while the worker and new web route are absent. Do not drop them during an incident, because retaining their state prevents duplicate alerts if the release is re-enabled.

## Operational notes

- Run exactly one `browser-notifications` PM2 instance.
- Do not run very aggressive polling; 15 seconds is the tested default and 5 seconds is the enforced minimum.
- The worker never logs cookies, authorization tokens, or message text.
- The platforms remain the source of truth. This connector uses undocumented web endpoints and can require maintenance after upstream changes.
- Rotate platform sessions if a database dump containing session fields was shared outside the trusted administration boundary.
