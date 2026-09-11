import crypto from "crypto";
import type { Pool } from "mysql2/promise";

export type NotificationPlatform = "airbnb" | "gathern";

export interface BrowserAccountForNotifications {
  id: string;
  platform: NotificationPlatform;
  cookies_json: string | null;
  chat_auth_token: string | null;
  platform_user_id: string | null;
  airbnb_inbox_hash: string | null;
  api_key_cache: string | null;
}

export interface MessageNotificationCandidate {
  platform: NotificationPlatform;
  browserAccountId: string;
  threadId: string;
  messageId: string | null;
  guestName: string;
  preview: string;
  sentAt: Date | null;
  isFromHost: boolean;
}

const HOST_SENDER_TYPES = new Set(["HOST", "COHOST", "OWNER", "PROVIDER"]);

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function textValue(value: unknown, depth = 0): string {
  if (depth > 4 || value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) {
    return value.map((item) => textValue(item, depth + 1)).filter(Boolean).join(" ").trim();
  }
  if (typeof value !== "object") return "";

  const obj = value as Record<string, unknown>;
  for (const key of ["accessibilityText", "text", "body", "content", "preview", "value"]) {
    const text = textValue(obj[key], depth + 1);
    if (text) return text;
  }
  if (obj.components) return textValue(obj.components, depth + 1);
  return "";
}

function safeDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric > 1e12 ? numeric : numeric * 1000)
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function unwrapThread(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  return obj.node && typeof obj.node === "object" ? obj.node as Record<string, unknown> : obj;
}

function looksLikeThread(value: unknown): boolean {
  const thread = unwrapThread(value);
  return !!thread && !!(thread.threadId ?? thread.thread_id ?? thread.chat_uid ?? thread.id)
    && !!(thread.latestMessage ?? thread.lastMessage ?? thread.last_message ?? thread.latestMessageId);
}

function findThreadArray(value: unknown, depth = 0): unknown[] {
  if (depth > 8 || value == null) return [];
  if (Array.isArray(value)) {
    if (value.some(looksLikeThread)) return value;
    for (const child of value) {
      const found = findThreadArray(child, depth + 1);
      if (found.length) return found;
    }
    return [];
  }
  if (typeof value !== "object") return [];
  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = findThreadArray(child, depth + 1);
    if (found.length) return found;
  }
  return [];
}

function decodeAirbnbThreadId(value: unknown): string {
  const raw = stringValue(value);
  if (!raw) return "";
  if (!/^[A-Za-z0-9+/=]+$/.test(raw) || raw.length <= 20) return raw;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return decoded.startsWith("MessageThread:") ? decoded.slice("MessageThread:".length) : raw;
  } catch {
    return raw;
  }
}

function airbnbGuestName(thread: Record<string, unknown>): string {
  if (Array.isArray(thread.users)) {
    const guest = (thread.users as Array<Record<string, unknown>>)
      .find((user) => ["GUEST", "TRAVELER"].includes(stringValue(user.type ?? user.role).toUpperCase()));
    const name = stringValue(guest?.name ?? guest?.firstName);
    if (name) return name;
  }
  const otherUser = thread.otherUser as Record<string, unknown> | undefined;
  return stringValue(otherUser?.firstName ?? otherUser?.name)
    || textValue(thread.inboxTitle)
    || "ضيف";
}

export function extractAirbnbCandidates(
  response: unknown,
  account: BrowserAccountForNotifications
): MessageNotificationCandidate[] {
  const candidates: MessageNotificationCandidate[] = [];
  for (const raw of findThreadArray(response)) {
    const thread = unwrapThread(raw);
    if (!thread) continue;
    const threadId = decodeAirbnbThreadId(thread.threadId ?? thread.thread_id ?? thread.id);
    const message = unwrapThread(thread.latestMessage ?? thread.lastMessage ?? thread.last_message);
    const messageId = stringValue(message?.id ?? message?.messageId ?? thread.latestMessageId) || null;
    if (!threadId || !messageId) continue;

    const senderType = stringValue(message?.senderType ?? message?.role).toUpperCase();
    const sender = message?.sender as Record<string, unknown> | undefined;
    const senderId = stringValue(message?.senderId ?? sender?.id);
    const isFromHost = HOST_SENDER_TYPES.has(senderType)
      || (!!senderId && !!account.platform_user_id && senderId === account.platform_user_id);

    candidates.push({
      platform: "airbnb",
      browserAccountId: account.id,
      threadId,
      messageId,
      guestName: airbnbGuestName(thread),
      preview: textValue(message) || textValue(thread.contentPreview) || "رسالة جديدة",
      sentAt: safeDate(message?.createdAt ?? message?.sentAt ?? message?.timestamp),
      isFromHost,
    });
  }
  return candidates;
}

function findGathernChats(response: unknown): unknown[] {
  if (!response || typeof response !== "object") return [];
  const obj = response as Record<string, any>;
  if (Array.isArray(obj.contact_list)) return obj.contact_list;
  if (Array.isArray(obj.data?.data)) return obj.data.data;
  if (Array.isArray(obj.data)) return obj.data;
  return findThreadArray(response);
}

export function extractGathernCandidates(
  response: unknown,
  account: BrowserAccountForNotifications
): MessageNotificationCandidate[] {
  const candidates: MessageNotificationCandidate[] = [];
  for (const raw of findGathernChats(response)) {
    const chat = unwrapThread(raw);
    if (!chat) continue;
    const message = unwrapThread(chat.last_message ?? chat.latestMessage ?? chat.lastMessage);
    const threadId = stringValue(chat.chat_uid ?? chat.id);
    const messageId = stringValue(message?.id ?? message?.message_id) || null;
    if (!threadId || !messageId) continue;

    const type = stringValue(message?.type ?? message?.sender_type).toUpperCase();
    const senderId = stringValue(message?.sender_id ?? message?.senderId);
    const isFromHost = message?.is_provider === true
      || Number(message?.is_provider) === 1
      || ["OWNER_TEXT", "PROVIDER_TEXT", "OWNER", "PROVIDER"].includes(type)
      || (!!senderId && !!account.platform_user_id && senderId === account.platform_user_id);

    candidates.push({
      platform: "gathern",
      browserAccountId: account.id,
      threadId,
      messageId,
      guestName: stringValue(chat.name ?? chat.name_verified ?? (chat.guest as any)?.name ?? chat.guest_name) || "ضيف",
      preview: textValue(message) || "رسالة جديدة",
      sentAt: safeDate(message?.created_at ?? message?.sent_at ?? message?.timestamp),
      isFromHost,
    });
  }
  return candidates;
}

export function candidateFingerprint(candidate: MessageNotificationCandidate): string {
  const stableMessagePart = candidate.messageId
    || `${candidate.sentAt?.toISOString() ?? "unknown-time"}:${candidate.preview}`;
  return crypto.createHash("sha256").update([
    candidate.browserAccountId,
    candidate.platform,
    candidate.threadId,
    stableMessagePart,
  ].join(":"), "utf8").digest("hex");
}

export async function recordCandidate(
  pool: Pool,
  candidate: MessageNotificationCandidate
): Promise<"baseline" | "unchanged" | "outgoing" | "notified"> {
  const fingerprint = candidateFingerprint(candidate);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT last_message_fingerprint
       FROM browser_notification_state
       WHERE browser_account_id = ? AND platform = ? AND thread_id = ?
       FOR UPDATE`,
      [candidate.browserAccountId, candidate.platform, candidate.threadId]
    ) as any;

    if (!rows.length) {
      await connection.execute(
        `INSERT INTO browser_notification_state
          (browser_account_id, platform, thread_id, last_message_fingerprint, last_message_id, last_message_sent_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [candidate.browserAccountId, candidate.platform, candidate.threadId, fingerprint, candidate.messageId, candidate.sentAt]
      );
      await connection.commit();
      return "baseline";
    }

    if (rows[0].last_message_fingerprint === fingerprint) {
      await connection.execute(
        `UPDATE browser_notification_state SET last_seen_at = CURRENT_TIMESTAMP(3)
         WHERE browser_account_id = ? AND platform = ? AND thread_id = ?`,
        [candidate.browserAccountId, candidate.platform, candidate.threadId]
      );
      await connection.commit();
      return "unchanged";
    }

    await connection.execute(
      `UPDATE browser_notification_state
       SET last_message_fingerprint = ?, last_message_id = ?, last_message_sent_at = ?, last_seen_at = CURRENT_TIMESTAMP(3)
       WHERE browser_account_id = ? AND platform = ? AND thread_id = ?`,
      [fingerprint, candidate.messageId, candidate.sentAt, candidate.browserAccountId, candidate.platform, candidate.threadId]
    );

    if (!candidate.isFromHost) {
      await connection.execute(
        `INSERT IGNORE INTO browser_message_notifications
          (event_id, browser_account_id, platform, thread_id, platform_msg_id, guest_name, message_preview, source_sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fingerprint,
          candidate.browserAccountId,
          candidate.platform,
          candidate.threadId,
          candidate.messageId,
          candidate.guestName.slice(0, 255),
          candidate.preview.slice(0, 1000),
          candidate.sentAt,
        ]
      );
    }

    await connection.commit();
    return candidate.isFromHost ? "outgoing" : "notified";
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
