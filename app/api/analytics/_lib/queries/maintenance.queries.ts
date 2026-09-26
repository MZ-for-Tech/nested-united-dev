// ============================================================
// Maintenance & Invoice Analytics Queries
// ============================================================
import { query } from "@/lib/db";

const ARABIC_STATES: Record<string, string> = {
  draft: "مسودة",
  posted: "مرحلة",
  confirmed: "مؤكدة",
  paid: "مدفوعة",
  cancelled: "ملغاة",
};

/** Maintenance ticket count (resolved) for expense calculations */
export async function fetchMaintenanceCount(
  startDateStr: string,
  endDateStr: string,
  accountFilterUnits: string,
  paramsUnits: unknown[]
): Promise<number> {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM maintenance_tickets mt
     INNER JOIN units u ON mt.unit_id = u.id
     WHERE mt.status = 'resolved' 
       AND mt.created_at >= ? AND mt.created_at <= ?
       ${accountFilterUnits}`,
    [startDateStr, endDateStr, ...paramsUnits]
  );
  return Number(result[0]?.count || 0);
}

/** Maintenance status distribution + top units by ticket count */
export async function fetchMaintenanceAnalytics(
  startDateStr: string,
  endDateStr: string,
  accountFilterUnits: string,
  paramsUnits: unknown[]
) {
  const baseParams = [
    startDateStr + " 00:00:00",
    endDateStr + " 23:59:59",
    ...paramsUnits,
  ];

  const [mtStatusList, mtTopUnitsList] = await Promise.all([
    query<any>(
      `SELECT mt.status, COUNT(*) as count 
       FROM maintenance_tickets mt
       INNER JOIN units u ON mt.unit_id = u.id
       WHERE mt.created_at >= ? AND mt.created_at <= ? ${accountFilterUnits}
       GROUP BY mt.status`,
      baseParams
    ),
    query<any>(
      `SELECT u.unit_name as name, COUNT(mt.id) as count 
       FROM maintenance_tickets mt
       INNER JOIN units u ON mt.unit_id = u.id
       WHERE mt.created_at >= ? AND mt.created_at <= ? ${accountFilterUnits}
       GROUP BY u.id, u.unit_name
       ORDER BY count DESC LIMIT 5`,
      baseParams
    ),
  ]);

  return {
    statusDist: mtStatusList.map((r: any) => ({
      status:
        r.status === "resolved"
          ? "محلولة"
          : r.status === "in_progress"
          ? "قيد المعالجة"
          : "مفتوحة",
      count: Number(r.count || 0),
    })),
    topUnits: mtTopUnitsList.map((r: any) => ({
      name: r.name,
      count: Number(r.count || 0),
    })),
  };
}

/** Invoice state distribution (draft, posted, confirmed, paid, cancelled) */
export async function fetchInvoiceAnalytics(startDateStr: string, endDateStr: string) {
  const list = await query<any>(
    `SELECT state, COUNT(*) as count, SUM(total_amount) as total 
     FROM accounting_invoices 
     WHERE deleted_at IS NULL
       AND invoice_date >= ? AND invoice_date <= ?
     GROUP BY state`,
    [startDateStr, endDateStr]
  );

  return list.map((r: any) => ({
    state: ARABIC_STATES[r.state] || r.state,
    count: Number(r.count || 0),
    total: Number(r.total || 0),
  }));
}
