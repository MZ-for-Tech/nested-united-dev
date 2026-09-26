// ============================================================
// Profitability Queries — Unit P&L with CRM integration
// ============================================================
// NOTE: The profitability SQL query is complex enough to stay in route.ts
// as it uses dynamic accountFilterUnits from the context.
// This file provides the TypeScript types and the mapping function only.
// ============================================================
import { ProfitabilityRow } from "../types";

/**
 * Map raw SQL result rows from the profitability query to typed ProfitabilityRow objects.
 * Revenue = bookings (pro-rated) + CRM won/confirmed deals.
 * Cost = investor payout based on profit_share configuration.
 */
export function mapProfitabilityRow(unit: any, daysCount: number): ProfitabilityRow {
  const bookingRev = Number(unit.b_rev || 0);
  const crmWonValue = Number(unit.crm_won_value || 0);
  const crmPipelineValue = Number(unit.crm_pipeline_value || 0);
  const crmWonCount = Number(unit.crm_won_count || 0);

  // Total confirmed revenue = bookings (nightly) + CRM closed deals
  const uRev = bookingRev + crmWonValue;

  const bDays = Number(unit.b_days || 0);
  const rDays = Number(unit.r_days || 0);
  const occupiedDays = bDays + rDays;

  const occupancy = daysCount > 0 ? Math.min(100, Math.round((occupiedDays / daysCount) * 100)) : 0;
  // ADR & RevPAR based on booking days only (CRM deals don't have nightly rate concept)
  const adr = bDays > 0 ? Math.round(bookingRev / bDays) : 0;
  const revpar = daysCount > 0 ? Math.round(bookingRev / daysCount) : 0;

  // Profit share hierarchy: unit override → investor default → 100% (company keeps all)
  const profitShare =
    unit.profit_share !== null && unit.profit_share !== undefined
      ? Number(unit.profit_share)
      : unit.default_profit_share !== null && unit.default_profit_share !== undefined
      ? Number(unit.default_profit_share)
      : 100.0;

  const investorPct = Math.max(0, 100 - profitShare);
  const investorPayout = Math.round(uRev * (investorPct / 100));
  const netProfit = Math.round(uRev * (profitShare / 100));
  const margin = uRev > 0 ? ((netProfit / uRev) * 100).toFixed(1) : "0.0";

  return {
    name: unit.unit_name,
    platform: unit.platform
      ? unit.platform === "airbnb"
        ? "Airbnb"
        : "Gathern"
      : "حجز مباشر",
    revenueVal: uRev,
    bookingRevenueVal: bookingRev,
    crmRevenueVal: crmWonValue,
    crmPipelineVal: crmPipelineValue,
    crmWonCount,
    costVal: investorPayout,
    profitVal: netProfit,
    marginVal: Number(margin),
    occupancyVal: occupancy,
    adrVal: adr,
    revparVal: revpar,
    profitSharePct: profitShare,
    investorPct,
    revenue: `${uRev.toLocaleString("en-US")} ر.س`,
    bookingRevenue: `${bookingRev.toLocaleString("en-US")} ر.س`,
    crmRevenue: `${crmWonValue.toLocaleString("en-US")} ر.س`,
    crmPipeline: `${crmPipelineValue.toLocaleString("en-US")} ر.س`,
    cost: `${investorPayout.toLocaleString("en-US")} ر.س`,
    profit: `${netProfit.toLocaleString("en-US")} ر.س`,
    margin: `${margin}%`,
    occupancy: `${occupancy}%`,
    adr: `${adr.toLocaleString("en-US")} ر.س`,
    revpar: `${revpar.toLocaleString("en-US")} ر.س`,
    status: Number(margin) > 75 ? "high" : "normal",
  };
}
