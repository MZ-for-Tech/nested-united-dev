import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const sqlDir = path.join(process.cwd(), "deployment", "database", "notifications");

function readSql(name: string): string {
  return fs.readFileSync(path.join(sqlDir, name), "utf8");
}

function withoutComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*--.*$/gm, "");
}

describe("notification-only database scripts", () => {
  it("uses additive idempotent tables and excludes WhatsApp", () => {
    const migration = withoutComments(readSql("001_notification_only.sql"));
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS browser_notification_state");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS browser_message_notifications");
    expect(migration).not.toMatch(/(?:^|;)\s*(?:DROP|TRUNCATE|DELETE|ALTER)\b/im);
    expect(migration).not.toMatch(/whatsapp/i);
  });

  it("keeps the verification script read-only", () => {
    const verification = withoutComments(readSql("002_verify_notification_only.sql"));
    expect(verification).toMatch(/^\s*SELECT/i);
    expect(verification).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|REPLACE)\b/i);
  });
});
