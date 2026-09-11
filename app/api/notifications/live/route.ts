import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { checkUserPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

interface ClockRow {
  cursor: string;
}

interface LiveNotificationRow {
  id: string;
  kind: "message" | "system";
  title: string;
  body: string;
  createdAt: string;
  href: string;
}

const MYSQL_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;

function audiencesForRole(role: string): string[] {
  const audiences = ["all_users"];

  if (role === "admin") audiences.push("all_admins");
  if (role === "super_admin") audiences.push("all_admins", "all_super_admins");
  if (role === "maintenance_worker") audiences.push("maintenance_workers");

  return audiences;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clock = await queryOne<ClockRow>(
    "SELECT DATE_FORMAT(CURRENT_TIMESTAMP(3), '%Y-%m-%d %H:%i:%s.%f') AS cursor"
  );
  if (!clock?.cursor) {
    return NextResponse.json({ error: "Database clock unavailable" }, { status: 503 });
  }

  const since = request.nextUrl.searchParams.get("since");

  // The first request establishes a database-side cursor. It deliberately does
  // not replay old records, preventing a notification storm after deployment.
  if (!since) {
    return NextResponse.json({ events: [], cursor: clock.cursor });
  }

  if (!MYSQL_DATETIME.test(since)) {
    return NextResponse.json({ error: "Invalid notification cursor" }, { status: 400 });
  }

  const audiences = audiencesForRole(user.role);
  const audiencePlaceholders = audiences.map(() => "?").join(", ");

  const systemEvents = await query<LiveNotificationRow>(
    `SELECT
       CONCAT('notification:', n.id) AS id,
       'system' AS kind,
       n.title AS title,
       n.body AS body,
       DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i:%s.%f') AS createdAt,
       CASE
         WHEN n.maintenance_ticket_id IS NOT NULL
           THEN CONCAT('/dashboard/maintenance/', n.maintenance_ticket_id)
         WHEN n.unit_id IS NOT NULL
           THEN CONCAT('/dashboard/units/', n.unit_id)
         ELSE '/dashboard/notifications'
       END AS href
     FROM notifications n
     WHERE n.is_read = 0
       AND n.created_at >= DATE_SUB(?, INTERVAL 3 SECOND)
       AND n.created_at <= ?
       AND (
         n.recipient_user_id = ?
         OR (n.recipient_user_id IS NULL AND n.audience IN (${audiencePlaceholders}))
       )
     ORDER BY n.created_at ASC, n.id ASC
     LIMIT 50`,
    [since, clock.cursor, user.id, ...audiences]
  );

  const canViewInbox = await checkUserPermission(user.id, "/dashboard/inbox", "view");
  const messageEvents = canViewInbox
    ? await query<LiveNotificationRow>(
        `SELECT
           CONCAT('message:', pm.id) AS id,
           'message' AS kind,
           CONCAT(
             'رسالة جديدة من ',
             COALESCE(NULLIF(pm.guest_name, ''), 'ضيف'),
             ' — ',
             CASE WHEN pm.platform = 'airbnb' THEN 'Airbnb' ELSE 'Gathern' END
           ) AS title,
           COALESCE(NULLIF(pm.message_text, ''), 'رسالة جديدة') AS body,
           DATE_FORMAT(pm.created_at, '%Y-%m-%d %H:%i:%s.%f') AS createdAt,
           CONCAT('/dashboard/inbox?threadId=',
             REPLACE(REPLACE(pm.thread_id, '%', '%25'), ' ', '%20')) AS href
         FROM platform_messages pm
         WHERE pm.is_from_me = 0
           AND pm.platform IN ('airbnb', 'gathern')
           AND pm.created_at >= DATE_SUB(?, INTERVAL 3 SECOND)
           AND pm.created_at <= ?
         ORDER BY pm.created_at ASC, pm.id ASC
         LIMIT 50`,
        [since, clock.cursor]
      )
    : [];

  const events = [...systemEvents, ...messageEvents]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .slice(-50)
    .map((event) => ({
      ...event,
      // Keep Windows toasts useful without exposing very large message bodies.
      body: event.body.length > 240 ? `${event.body.slice(0, 237)}...` : event.body,
    }));

  return NextResponse.json(
    { events, cursor: clock.cursor },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
