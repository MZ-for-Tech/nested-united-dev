// ============================================================
// CRM Pipeline & Deal Analytics Queries
// ============================================================
import { query, queryOne } from "@/lib/db";

/**
 * Build a CRM SQL filter for linking deals to platform accounts via units.
 * NOTE: CRM uses direct unit_id linking, so we filter on units.platform_account_id.
 */
function buildCrmAccountFilter(account: string): { filter: string; params: unknown[] } {
  const params: unknown[] = [];
  let filter = "";
  if (account !== "all") {
    const ids = account.split(",");
    const placeholders = ids.map(() => "?").join(",");
    filter = ` AND c.unit_id IN (
      SELECT uc.unit_id FROM unit_calendars uc WHERE uc.platform_account_id IN (${placeholders})
      UNION
      SELECT u.id FROM units u WHERE u.platform_account_id IN (${placeholders})
    ) `;
    params.push(...ids, ...ids);
  }
  return { filter, params };
}

/** Fetch CRM KPIs and status distribution */
export async function fetchCrmKPIs(
  startDateStr: string,
  endDateStr: string,
  account: string
) {
  const { filter: crmAccountFilter, params: filterParams } = buildCrmAccountFilter(account);
  const paramsCrm: unknown[] = [
    startDateStr + " 00:00:00",
    endDateStr + " 23:59:59",
    ...filterParams,
  ];

  const [crmStats, totalCustomersRes] = await Promise.all([
    queryOne<any>(
      `SELECT 
         COUNT(*) as total_deals,
         SUM(CASE WHEN c.status = 'open' THEN 1 ELSE 0 END) as open_count,
         COALESCE(SUM(CASE WHEN c.status = 'open' THEN c.value ELSE 0 END), 0) as open_value,
         SUM(CASE WHEN c.status = 'closed' AND c.stage IN ('completed', 'management') THEN 1 ELSE 0 END) as won_count,
         COALESCE(SUM(CASE WHEN c.status = 'closed' AND c.stage IN ('completed', 'management') THEN c.value ELSE 0 END), 0) as won_value,
         SUM(CASE WHEN c.stage = 'lost' THEN 1 ELSE 0 END) as lost_count,
         COALESCE(AVG(CASE WHEN c.value > 0 THEN c.value ELSE NULL END), 0) as avg_value
       FROM crm_deals c
       WHERE c.created_at >= ? AND c.created_at <= ? ${crmAccountFilter}`,
      paramsCrm
    ),
    queryOne<any>("SELECT COUNT(*) as count FROM customers"),
  ]);

  const totalCustomersCount = Number(totalCustomersRes?.count || 0);
  const totalResolved = Number(crmStats?.won_count || 0) + Number(crmStats?.lost_count || 0);

  const crmKPIs = {
    pipelineValue: `${Number(crmStats?.open_value || 0).toLocaleString("en-US")} ر.س`,
    wonValue: `${Number(crmStats?.won_value || 0).toLocaleString("en-US")} ر.س`,
    avgDealValue: `${Math.round(Number(crmStats?.avg_value || 0)).toLocaleString("en-US")} ر.س`,
    conversionRate:
      totalResolved > 0
        ? `${((Number(crmStats?.won_count || 0) / totalResolved) * 100).toFixed(1)}%`
        : "0.0%",
    totalCustomers: totalCustomersCount.toLocaleString("en-US"),
    openCount: Number(crmStats?.open_count || 0),
    wonCount: Number(crmStats?.won_count || 0),
    lostCount: Number(crmStats?.lost_count || 0),
  };

  const crmStatusDistribution = [
    { name: "صفقات نشطة", value: Number(crmStats?.open_count || 0), color: "#3b82f6" },
    { name: "صفقات مؤكدة", value: Number(crmStats?.won_count || 0), color: "#10b981" },
    { name: "صفقات خاسرة", value: Number(crmStats?.lost_count || 0), color: "#ef4444" },
  ].filter((item) => item.value > 0);

  return { crmKPIs, crmStatusDistribution, paramsCrm, crmAccountFilter };
}

/** Fetch CRM pipeline stages breakdown */
export async function fetchCrmPipeline(paramsCrm: unknown[], crmAccountFilter: string) {
  const crmPipelineList = await query<any>(
    `SELECT c.stage, COUNT(*) as count, SUM(c.value) as val 
     FROM crm_deals c 
     WHERE c.status = 'open' AND c.created_at >= ? AND c.created_at <= ? ${crmAccountFilter}
     GROUP BY c.stage`,
    paramsCrm
  );

  const stagesMapping: Record<string, { label: string; percent: string; bg: string }> = {
    negotiation: { label: "مفاوضات وبانتظار الدفع", percent: "30%", bg: "bg-blue-500" },
    partial_payment: { label: "تم دفع عربون / دفعة جزئية", percent: "60%", bg: "bg-amber-500" },
    completed: { label: "صفقات مكتملة ومؤكدة", percent: "90%", bg: "bg-emerald-500" },
    management: { label: "تحت التشغيل والإدارة", percent: "100%", bg: "bg-indigo-500" },
  };

  return Object.entries(stagesMapping).map(([key, meta]) => {
    const found = crmPipelineList.find((item: any) => item.stage === key);
    const count = found ? found.count : 0;
    const value = found ? Number(found.val) : 0;
    return {
      stage: meta.label,
      count: count === 1 ? "1 صفقة" : count > 1 ? `${count} صفقات` : "0 صفقة",
      value: `${value.toLocaleString("en-US")} ر.س`,
      rawValue: value,
      rawCount: count,
      percent: meta.percent,
      bg: meta.bg,
    };
  });
}

/** Fetch recent deals list */
export async function fetchRecentDeals(paramsCrm: unknown[], crmAccountFilter: string) {
  const list = await query<any>(
    `SELECT c.id, c.title, c.value, c.stage, c.priority, c.expected_close_date, cust.full_name as customer_name
     FROM crm_deals c
     LEFT JOIN customers cust ON c.customer_id = cust.id
     WHERE c.created_at >= ? AND c.created_at <= ? ${crmAccountFilter}
     ORDER BY c.created_at DESC`,
    paramsCrm
  );

  return list.map((deal: any) => {
    let status = "تفاوض نشط";
    if (deal.stage === "completed" || deal.stage === "management") status = "تم التأكيد";
    else if (deal.stage === "negotiation") status = "بانتظار الدفع";
    else if (deal.stage === "partial_payment") status = "دفعة جزئية";

    return {
      id: deal.id,
      title: deal.title || "صفقة جديدة",
      customer: deal.customer_name || "عميل عام",
      value: Number(deal.value),
      price: `${Number(deal.value).toLocaleString("en-US")} ر.س`,
      stage: deal.stage,
      priority: deal.priority || "medium",
      expectedClose: deal.expected_close_date
        ? deal.expected_close_date.toString().slice(0, 10)
        : "غير محدد",
      status,
    };
  });
}
