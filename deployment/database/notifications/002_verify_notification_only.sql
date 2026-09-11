-- Read-only verification. Safe to run before or after starting the worker.

SELECT
  table_name,
  engine,
  table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('browser_notification_state', 'browser_message_notifications')
ORDER BY table_name;

SELECT
  platform,
  COUNT(*) AS tracked_threads,
  MAX(last_seen_at) AS latest_poll_observation
FROM browser_notification_state
GROUP BY platform
ORDER BY platform;

SELECT
  platform,
  COUNT(*) AS notification_events,
  MAX(detected_at) AS latest_notification
FROM browser_message_notifications
GROUP BY platform
ORDER BY platform;

SELECT
  id,
  platform,
  last_connected_at,
  last_poll_at,
  poll_error
FROM browser_accounts
WHERE is_active = 1
  AND platform IN ('airbnb', 'gathern')
ORDER BY platform, id;
