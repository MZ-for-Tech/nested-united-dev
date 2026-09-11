import * as fs from "fs";
import * as path from "path";
import mysql, { type Pool } from "mysql2/promise";
import {
  BrowserAccountForNotifications,
  extractAirbnbCandidates,
  extractGathernCandidates,
  recordCandidate,
} from "../src/notifications/notification-worker-core";

function loadEnvFile(): Record<string, string> {
  const values: Record<string, string> = {};
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return values;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

const fileEnv = loadEnvFile();
const env = (name: string, fallback = "") => process.env[name] || fileEnv[name] || fallback;
const pollIntervalMs = Math.max(5_000, Number(env("NOTIFICATION_POLL_INTERVAL_MS", "15000")) || 15_000);
const requestTimeoutMs = Math.max(5_000, Number(env("NOTIFICATION_HTTP_TIMEOUT_MS", "20000")) || 20_000);
const defaultAirbnbApiKey = "d306zoyjsyarp7ifhu67rjxn52tv0t20";

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(requestTimeoutMs);
}

async function fetchAirbnb(account: BrowserAccountForNotifications): Promise<unknown> {
  const hash = account.airbnb_inbox_hash;
  if (!account.cookies_json) throw new Error("missing_session");
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) throw new Error("missing_inbox_hash");

  const variables: Record<string, unknown> = {
    getParticipants: true,
    numRequestedThreads: 20,
    numPriorityThreads: 20,
    getPriorityInbox: false,
    useUserThreadTag: true,
    originType: "USER_INBOX",
    threadVisibility: "UNARCHIVED",
    threadTagFilters: [],
    priorityThreadTagFilters: [{ userThreadTagName: "priority" }],
    query: null,
    getLastReads: false,
    getThreadState: true,
    getInboxFields: true,
    getInboxOnlyFields: true,
    getMessageFields: false,
    getThreadOnlyFields: true,
    skipOldMessagePreviewFields: false,
  };
  if (account.platform_user_id) {
    variables.userId = Buffer.from(`Viewer:${account.platform_user_id}`).toString("base64");
  }

  const response = await fetch(`https://www.airbnb.com/api/v3/ViaductInboxData/${hash}`, {
    method: "POST",
    signal: timeoutSignal(),
    headers: {
      cookie: account.cookies_json,
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
      "x-airbnb-api-key": account.api_key_cache || defaultAirbnbApiKey,
      "x-csrf-without-token": "1",
      "x-airbnb-graphql-platform-client": "minimalist-niobe",
      "x-airbnb-graphql-platform": "web",
      "x-niobe-short-circuited": "true",
    },
    body: JSON.stringify({
      operationName: "ViaductInboxData",
      variables,
      extensions: { persistedQuery: { version: 1, sha256Hash: hash } },
    }),
  });
  if (!response.ok) throw new Error(`http_${response.status}`);
  const json = await response.json() as any;
  if (Array.isArray(json?.errors) && json.errors.length) throw new Error("graphql_error");
  return json;
}

async function fetchGathern(account: BrowserAccountForNotifications): Promise<unknown> {
  if (!account.chat_auth_token) throw new Error("missing_session");
  const response = await fetch("https://chatapi-prod.gathern.co/api/v2/user_chat/chats", {
    method: "POST",
    signal: timeoutSignal(),
    headers: {
      authorization: `Bearer ${account.chat_auth_token}`,
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
    },
    body: JSON.stringify({ chat_type: "2", page: "1" }),
  });
  if (!response.ok) throw new Error(`http_${response.status}`);
  return response.json();
}

async function setHealth(pool: Pool, accountId: string, error: string | null): Promise<void> {
  await pool.execute(
    `UPDATE browser_accounts
     SET last_poll_at = CURRENT_TIMESTAMP(), poll_error = ?
     WHERE id = ?`,
    [error ? `notification-worker:${error}`.slice(0, 500) : null, accountId]
  );
}

async function pollAccount(pool: Pool, account: BrowserAccountForNotifications): Promise<void> {
  try {
    const payload = account.platform === "airbnb"
      ? await fetchAirbnb(account)
      : await fetchGathern(account);
    const candidates = account.platform === "airbnb"
      ? extractAirbnbCandidates(payload, account)
      : extractGathernCandidates(payload, account);

    let notifications = 0;
    for (const candidate of candidates) {
      if (await recordCandidate(pool, candidate) === "notified") notifications++;
    }
    await setHealth(pool, account.id, null);
    if (notifications) {
      await pool.execute(
        "UPDATE browser_accounts SET last_notification_at = CURRENT_TIMESTAMP(), has_unread_notifications = 1 WHERE id = ?",
        [account.id]
      );
      console.log(`[NotificationWorker] ${account.platform}/${account.id.slice(0, 8)}: ${notifications} new notification(s)`);
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown_error";
    await setHealth(pool, account.id, code).catch(() => undefined);
    console.error(`[NotificationWorker] ${account.platform}/${account.id.slice(0, 8)} failed: ${code}`);
  }
}

async function assertSchema(pool: Pool): Promise<void> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS table_count
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name IN ('browser_notification_state', 'browser_message_notifications')`
  ) as any;
  if (Number(rows?.[0]?.table_count) !== 2) {
    throw new Error("Notification tables are missing. Run deployment/database/notifications/001_notification_only.sql first.");
  }
}

async function main(): Promise<void> {
  const pool = mysql.createPool({
    host: env("DB_HOST", "127.0.0.1"),
    port: Number(env("DB_PORT", "3306")),
    user: env("DB_USER", "root"),
    password: env("DB_PASSWORD"),
    database: env("DB_NAME", "rentals_dashboard"),
    waitForConnections: true,
    connectionLimit: 5,
  });

  await assertSchema(pool);
  console.log(`[NotificationWorker] Started; interval=${pollIntervalMs}ms`);
  let running = false;
  const runPoll = async () => {
    if (running) return;
    running = true;
    try {
      const [accounts] = await pool.query(
        `SELECT id, platform, cookies_json, chat_auth_token, platform_user_id, airbnb_inbox_hash, api_key_cache
         FROM browser_accounts
         WHERE is_active = 1 AND platform IN ('airbnb', 'gathern')`
      ) as any;
      for (const account of accounts as BrowserAccountForNotifications[]) {
        await pollAccount(pool, account);
      }
    } catch (error) {
      console.error("[NotificationWorker] Poll cycle failed:", error instanceof Error ? error.message : "unknown_error");
    } finally {
      running = false;
    }
  };

  await runPoll();
  const interval = setInterval(() => void runPoll(), pollIntervalMs);
  const shutdown = async (signal: string) => {
    console.log(`[NotificationWorker] ${signal}; shutting down`);
    clearInterval(interval);
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[NotificationWorker] Fatal:", error instanceof Error ? error.message : "unknown_error");
  process.exit(1);
});
