import { describe, expect, it, vi } from "vitest";
import type { Pool } from "mysql2/promise";
import {
  BrowserAccountForNotifications,
  candidateFingerprint,
  extractAirbnbCandidates,
  extractGathernCandidates,
  recordCandidate,
} from "@/src/notifications/notification-worker-core";

const airbnbAccount: BrowserAccountForNotifications = {
  id: "account-airbnb",
  platform: "airbnb",
  cookies_json: "redacted",
  chat_auth_token: null,
  platform_user_id: "host-1",
  airbnb_inbox_hash: "a".repeat(64),
  api_key_cache: null,
};

const gathernAccount: BrowserAccountForNotifications = {
  ...airbnbAccount,
  id: "account-gathern",
  platform: "gathern",
  cookies_json: null,
  chat_auth_token: "redacted",
};

describe("notification-only connector parsing", () => {
  it("extracts an incoming Airbnb latest message", () => {
    const result = extractAirbnbCandidates({
      data: {
        presentation: {
          inbox: {
            threads: [{
              threadId: "thread-100",
              users: [{ type: "GUEST", name: "Guest A" }],
              latestMessage: {
                id: "message-100",
                senderType: "GUEST",
                text: { accessibilityText: "Hello from Airbnb" },
                createdAt: "2026-09-12T01:00:00.000Z",
              },
            }],
          },
        },
      },
    }, airbnbAccount);

    expect(result).toEqual([expect.objectContaining({
      platform: "airbnb",
      threadId: "thread-100",
      messageId: "message-100",
      guestName: "Guest A",
      preview: "Hello from Airbnb",
      isFromHost: false,
    })]);
  });

  it("recognizes an outgoing Airbnb latest message", () => {
    const [candidate] = extractAirbnbCandidates({
      threads: [{
        threadId: "thread-101",
        latestMessage: { id: "message-101", senderType: "HOST", text: "Host reply" },
      }],
    }, airbnbAccount);
    expect(candidate.isFromHost).toBe(true);
  });

  it("extracts an incoming Gathern latest message", () => {
    const result = extractGathernCandidates({
      contact_list: [{
        chat_uid: "chat-200",
        name_verified: "Guest B",
        last_message: {
          id: "message-200",
          type: "guest_text",
          content: "Hello from Gathern",
          created_at: "2026-09-12 01:02:00",
        },
      }],
    }, gathernAccount);

    expect(result).toEqual([expect.objectContaining({
      platform: "gathern",
      threadId: "chat-200",
      messageId: "message-200",
      guestName: "Guest B",
      preview: "Hello from Gathern",
      isFromHost: false,
    })]);
  });

  it("generates stable fingerprints without including secrets", () => {
    const [candidate] = extractGathernCandidates({
      contact_list: [{ chat_uid: "chat-1", last_message: { id: "message-1", content: "Hi" } }],
    }, gathernAccount);
    expect(candidateFingerprint(candidate)).toMatch(/^[a-f0-9]{64}$/);
    expect(candidateFingerprint(candidate)).toBe(candidateFingerprint(candidate));
  });
});

describe("notification-only deduplication", () => {
  function mockPool(existingFingerprint?: string) {
    const execute = vi.fn()
      .mockResolvedValueOnce([existingFingerprint
        ? [{ last_message_fingerprint: existingFingerprint }]
        : [], []])
      .mockResolvedValue([{ affectedRows: 1 }, []]);
    const connection = {
      beginTransaction: vi.fn().mockResolvedValue(undefined),
      execute,
      commit: vi.fn().mockResolvedValue(undefined),
      rollback: vi.fn().mockResolvedValue(undefined),
      release: vi.fn(),
    };
    const pool = { getConnection: vi.fn().mockResolvedValue(connection) } as unknown as Pool;
    return { pool, connection, execute };
  }

  const candidate = {
    platform: "airbnb" as const,
    browserAccountId: "account-1",
    threadId: "thread-1",
    messageId: "message-new",
    guestName: "Guest",
    preview: "New message",
    sentAt: new Date("2026-09-12T01:00:00.000Z"),
    isFromHost: false,
  };

  it("creates a silent baseline for the first observed message", async () => {
    const { pool, execute, connection } = mockPool();
    await expect(recordCandidate(pool, candidate)).resolves.toBe("baseline");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1][0]).toContain("INSERT INTO browser_notification_state");
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it("creates a notification when the fingerprint changes to an incoming message", async () => {
    const { pool, execute } = mockPool("old-fingerprint");
    await expect(recordCandidate(pool, candidate)).resolves.toBe("notified");
    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls[2][0]).toContain("INSERT IGNORE INTO browser_message_notifications");
  });

  it("updates state but does not notify for an outgoing message", async () => {
    const { pool, execute } = mockPool("old-fingerprint");
    await expect(recordCandidate(pool, { ...candidate, isFromHost: true })).resolves.toBe("outgoing");
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.some(([sql]) => String(sql).includes("browser_message_notifications"))).toBe(false);
  });
});
