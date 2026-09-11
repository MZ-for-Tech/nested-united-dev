-- Notification-only migration for MariaDB 10.4+
-- Additive and idempotent: it does not alter or delete existing inbox data.

CREATE TABLE IF NOT EXISTS browser_notification_state (
  browser_account_id CHAR(36) NOT NULL,
  platform ENUM('airbnb', 'gathern') NOT NULL,
  thread_id VARCHAR(255) NOT NULL,
  last_message_fingerprint CHAR(64) NOT NULL,
  last_message_id VARCHAR(255) DEFAULT NULL,
  last_message_sent_at DATETIME(3) DEFAULT NULL,
  initialized_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (browser_account_id, platform, thread_id),
  KEY idx_browser_notification_state_seen (last_seen_at),
  CONSTRAINT fk_browser_notification_state_account
    FOREIGN KEY (browser_account_id) REFERENCES browser_accounts(id)
    ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS browser_message_notifications (
  event_id CHAR(64) NOT NULL,
  browser_account_id CHAR(36) NOT NULL,
  platform ENUM('airbnb', 'gathern') NOT NULL,
  thread_id VARCHAR(255) NOT NULL,
  platform_msg_id VARCHAR(255) DEFAULT NULL,
  guest_name VARCHAR(255) NOT NULL DEFAULT 'Guest',
  message_preview VARCHAR(1000) NOT NULL,
  source_sent_at DATETIME(3) DEFAULT NULL,
  detected_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (event_id),
  KEY idx_browser_message_notifications_feed (detected_at, event_id),
  KEY idx_browser_message_notifications_account (browser_account_id, detected_at),
  CONSTRAINT fk_browser_message_notifications_account
    FOREIGN KEY (browser_account_id) REFERENCES browser_accounts(id)
    ON UPDATE RESTRICT ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT
  table_name,
  engine,
  table_rows
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('browser_notification_state', 'browser_message_notifications')
ORDER BY table_name;
