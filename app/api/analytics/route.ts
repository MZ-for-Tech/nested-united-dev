// ============================================================
// Analytics API Route — Orchestrator
// All heavy query logic is delegated to _lib/queries/*.queries.ts
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getCacheKey, analyticsCache, CACHE_TTL, clearAnalyticsCache } from "@/lib/analytics-cache";

// Utilities
import { resolveDateRange, formatDate, getISOWeekNumber } from "./_lib/date-utils";
import { buildAccountFilters } from "./_lib/account-filter";

// Query modules
import { fetchRevenueKPIs, fetchPlatformShare, fetchBookingKPIs, getPeriodRevenue, getPeriodOccupiedDays } from "./_lib/queries/revenue.queries";
import { fetchEmployees, calculatePayrollForPeriod, fetchInvestorPayouts, fetchMainExpenses, getPeriodExpenses } from "./_lib/queries/expenses.queries";
import { fetchCrmKPIs, fetchCrmPipeline, fetchRecentDeals } from "./_lib/queries/crm.queries";
import { fetchHRPayroll, fetchAttendanceReport, fetchHRMiscData } from "./_lib/queries/hr.queries";
import { fetchMaintenanceCount, fetchMaintenanceAnalytics, fetchInvoiceAnalytics } from "./_lib/queries/maintenance.queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // ── 1. Auth ────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "غير مصرح بالدخول" }, { status: 401 });
    }

    // ── 2. Parse params ────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const account = searchParams.get("account") || "all";
    const range = searchParams.get("range") || "month";
    const customStartDate = searchParams.get("startDate") || "";
    const customEndDate = searchParams.get("endDate") || "";
    const bypass = searchParams.get("bypass") === "true";

    // ── 3. Cache check ─────────────────────────────────────
    const cacheKey = getCacheKey(account, range, customStartDate, customEndDate);
    if (bypass) {
      clearAnalyticsCache();
    } else {
      const cached = analyticsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json(cached.data);
      }
    }

    // ── 4. Resolve date range ──────────────────────────────
    const { startDateStr, endDateStr, daysCount } = await resolveDateRange(range, customStartDate, customEndDate);
    console.log("[Analytics] Dates:", { startDateStr, endDateStr, daysCount });

    // ── 5. Build account filters ───────────────────────────
    const filters = buildAccountFilters(account, startDateStr, endDateStr);
    const {
      accountFilterBookings, accountFilterReservations, accountFilterUnits,
      paramsBookings, paramsReservations, paramsOccupancyBookings, paramsOccupancyReservations,
      paramsUnits, accountIds,
    } = filters;

    // ── 6. Revenue KPIs ────────────────────────────────────
    const { totalRevenue, bookingsDays, reservationsDays, totalBookedDays, totalUnits } =
      await fetchRevenueKPIs(
        startDateStr, endDateStr,
        accountFilterBookings, accountFilterReservations, accountFilterUnits,
        paramsOccupancyBookings, paramsOccupancyReservations, paramsUnits
      );

    const totalAvailableDays = totalUnits * daysCount;
    const occupancyRate = Number(((totalBookedDays / totalAvailableDays) * 100).toFixed(1));
    const adr = bookingsDays > 0 ? Math.round(totalRevenue / bookingsDays) : 0;
    const revpar = Math.round(adr * (occupancyRate / 100));

    // ── 7. Platform share ──────────────────────────────────
    const platformShare = await fetchPlatformShare(totalRevenue, accountFilterBookings, paramsOccupancyBookings);

    // ── 8. Booking counts + repeat guest rate ──────────────
    const { totalBookingsCount, repeatGuestRate, paramsSimpleBookings } =
      await fetchBookingKPIs(endDateStr, startDateStr, accountIds, accountFilterBookings, accountFilterReservations);

    // ── 9. Employees (needed for payroll & expenses) ───────
    const employees = await fetchEmployees();
    const totalUnitsCountResult = await query<{ count: number }>("SELECT COUNT(*) as count FROM units WHERE status = 'active'");
    const totalUnitsCount = Number(totalUnitsCountResult[0]?.count || 24);

    // ── 10. Maintenance count (for expense calc) ───────────
    const maintenanceCount = await fetchMaintenanceCount(startDateStr, endDateStr, accountFilterUnits, paramsUnits);

    // ── 11. Expenses ───────────────────────────────────────
    const { totalExpenses } = await fetchMainExpenses({
      startDateStr, endDateStr,
      totalBookingsCount, maintenanceCount,
      totalUnits, totalUnitsCount,
      employees, accountIds, accountFilterBookings,
    });
    const netIncome = totalRevenue - totalExpenses;

    // ── 12. Cashflow & Occupancy Trend ─────────────────────
    const eDate = new Date(endDateStr);
    const monthlyData: { month: string; amount: number; expenses: number; occupancy: number; percentage: string }[] = [];

    const periodRevenueOpts = { accountIds, accountFilterBookings, accountFilterReservations };
    const periodExpensesOpts = {
      accountIds, accountFilterBookings, accountFilterReservations, accountFilterUnits,
      totalUnits, totalUnitsCount, employees,
    };

    if (range === "today") {
      const arabicDayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      for (let i = -3; i <= 3; i++) {
        const targetDay = new Date(eDate);
        targetDay.setDate(eDate.getDate() + i);
        const dayStr = formatDate(targetDay);
        const [dRevenue, dOccupied, dExpenses] = await Promise.all([
          getPeriodRevenue(dayStr, dayStr, accountIds, accountFilterBookings),
          getPeriodOccupiedDays(dayStr, dayStr, accountIds, accountFilterBookings, accountFilterReservations),
          getPeriodExpenses({ startStr: dayStr, endStr: dayStr, ...periodExpensesOpts }),
        ]);
        monthlyData.push({
          month: `${arabicDayNames[targetDay.getDay()]} ${targetDay.getDate()}/${targetDay.getMonth() + 1}`,
          amount: dRevenue,
          expenses: dExpenses,
          occupancy: Number(((dOccupied / totalUnits) * 100).toFixed(1)),
          percentage: `${Math.min(100, Math.max(10, Math.round((dRevenue / (totalRevenue || 1)) * 100)))}%`,
        });
      }
    } else if (range === "week") {
      const selectedMonday = new Date(eDate);
      const dayVal = eDate.getDay();
      selectedMonday.setDate(eDate.getDate() - (dayVal === 0 ? 6 : dayVal - 1));
      for (let i = -5; i <= 4; i++) {
        const monday = new Date(selectedMonday);
        monday.setDate(selectedMonday.getDate() + i * 7);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const startStr = formatDate(monday);
        const endStr = formatDate(sunday);
        const [wRevenue, wOccupied, wExpenses] = await Promise.all([
          getPeriodRevenue(startStr, endStr, accountIds, accountFilterBookings),
          getPeriodOccupiedDays(startStr, endStr, accountIds, accountFilterBookings, accountFilterReservations),
          getPeriodExpenses({ startStr, endStr, ...periodExpensesOpts }),
        ]);
        monthlyData.push({
          month: `أسبوع ${getISOWeekNumber(monday)}`,
          amount: wRevenue,
          expenses: wExpenses,
          occupancy: Number(((wOccupied / (totalUnits * 7)) * 100).toFixed(1)),
          percentage: `${Math.min(100, Math.max(10, Math.round((wRevenue / (totalRevenue || 1)) * 100)))}%`,
        });
      }
    } else {
      const targetYear = eDate.getFullYear();
      const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
      for (let m = 0; m < 12; m++) {
        const startOfMonthStr = `${targetYear}-${String(m + 1).padStart(2, "0")}-01`;
        const dateObj = new Date(targetYear, m + 1, 0);
        const endOfMonthStr = dateObj.toISOString().split("T")[0];
        const daysInMonth = dateObj.getDate();
        const [mRevenue, mOccupied, mExpenses] = await Promise.all([
          getPeriodRevenue(startOfMonthStr, endOfMonthStr, accountIds, accountFilterBookings),
          getPeriodOccupiedDays(startOfMonthStr, endOfMonthStr, accountIds, accountFilterBookings, accountFilterReservations),
          getPeriodExpenses({ startStr: startOfMonthStr, endStr: endOfMonthStr, ...periodExpensesOpts }),
        ]);
        monthlyData.push({
          month: monthNames[m],
          amount: mRevenue,
          expenses: mExpenses,
          occupancy: Number(((mOccupied / (totalUnits * daysInMonth)) * 100).toFixed(1)),
          percentage: `${Math.min(100, Math.max(10, Math.round((mRevenue / (totalRevenue || 1)) * 100)))}%`,
        });
      }
    }

    // ── 13. Live Operations (Unit Readiness) ───────────────
    const calNow = new Date();
    const todayStr = formatDate(calNow);
    const currentMonthStart = `${calNow.getFullYear()}-${String(calNow.getMonth() + 1).padStart(2, "0")}-01`;
    const calLastDay = new Date(calNow.getFullYear(), calNow.getMonth() + 1, 0).getDate();
    const currentMonthEnd = `${calNow.getFullYear()}-${String(calNow.getMonth() + 1).padStart(2, "0")}-${String(calLastDay).padStart(2, "0")}`;

    const [activeBookings, activeReservations, liveUnitsList] = await Promise.all([
      query<any>(
        `SELECT unit_id, checkin_date as start_date, checkout_date as end_date FROM bookings
         WHERE checkout_date >= ? AND checkin_date <= ?`,
        [currentMonthStart, currentMonthEnd]
      ),
      query<any>(
        `SELECT unit_id, start_date, end_date FROM reservations
         WHERE end_date >= ? AND start_date <= ?`,
        [currentMonthStart, currentMonthEnd]
      ),
      query<any>(
        `SELECT u.*,
                (SELECT b.guest_name FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date = ? LIMIT 1) as manual_checkin_guest,
                (SELECT r.summary FROM reservations r WHERE r.unit_id = u.id AND r.start_date = ? LIMIT 1) as ical_checkin_guest,
                (SELECT b.guest_name FROM bookings b WHERE b.unit_id = u.id AND b.checkout_date = ? LIMIT 1) as manual_checkout_guest,
                (SELECT r.summary FROM reservations r WHERE r.unit_id = u.id AND r.end_date = ? LIMIT 1) as ical_checkout_guest,
                (SELECT b.checkin_date FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date = ? LIMIT 1) as manual_checkin_date,
                (SELECT r.start_date FROM reservations r WHERE r.unit_id = u.id AND r.start_date = ? LIMIT 1) as ical_checkin_date,
                (SELECT b.checkout_date FROM bookings b WHERE b.unit_id = u.id AND b.checkout_date = ? LIMIT 1) as manual_checkout_date,
                (SELECT r.end_date FROM reservations r WHERE r.unit_id = u.id AND r.end_date = ? LIMIT 1) as ical_checkout_date,
                (SELECT b.guest_name FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date <= ? AND b.checkout_date >= ? ORDER BY b.checkin_date DESC LIMIT 1) as active_manual_guest,
                (SELECT r.summary FROM reservations r WHERE r.unit_id = u.id AND r.start_date <= ? AND r.end_date >= ? ORDER BY r.start_date DESC LIMIT 1) as active_ical_guest,
                (SELECT b.checkin_date FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date <= ? AND b.checkout_date >= ? ORDER BY b.checkin_date DESC LIMIT 1) as active_manual_checkin,
                (SELECT r.start_date FROM reservations r WHERE r.unit_id = u.id AND r.start_date <= ? AND r.end_date >= ? ORDER BY r.start_date DESC LIMIT 1) as active_ical_checkin,
                (SELECT b.checkout_date FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date <= ? AND b.checkout_date >= ? ORDER BY b.checkin_date DESC LIMIT 1) as active_manual_checkout,
                (SELECT r.end_date FROM reservations r WHERE r.unit_id = u.id AND r.start_date <= ? AND r.end_date >= ? ORDER BY r.start_date DESC LIMIT 1) as active_ical_checkout,
                (SELECT b.notes FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date <= ? AND b.checkout_date >= ? ORDER BY b.checkin_date DESC LIMIT 1) as active_manual_notes,
                (SELECT platform FROM reservations r WHERE r.unit_id = u.id AND r.start_date <= CURRENT_DATE() AND r.end_date >= CURRENT_DATE() LIMIT 1) as platform,
                COALESCE((SELECT SUM(amount) FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date >= ? AND b.checkin_date <= ?), 0) as total_revenue,
                (SELECT COUNT(*) FROM bookings b2 WHERE b2.unit_id = u.id AND b2.checkin_date >= ? AND b2.checkin_date <= ?) as bookings_count,
                (SELECT COUNT(*) FROM maintenance_tickets mt WHERE mt.unit_id = u.id AND mt.status != 'resolved') as active_maint_tickets
         FROM units u
         WHERE u.status = 'active' ${accountFilterUnits}
         ORDER BY u.unit_name ASC`,
        [
          todayStr, todayStr, todayStr, todayStr, todayStr, todayStr, todayStr, todayStr,
          todayStr, todayStr, todayStr, todayStr, todayStr, todayStr,
          todayStr, todayStr, todayStr, todayStr,
          todayStr, todayStr, todayStr, todayStr,
          startDateStr, endDateStr, startDateStr, endDateStr,
          ...paramsUnits,
        ]
      ),
    ]);

    // Fetch unit calendars
    const activeUnitIds = liveUnitsList.map((u: any) => u.id);
    let calendars: any[] = [];
    if (activeUnitIds.length > 0) {
      calendars = await query<any>(
        `SELECT id, unit_id, platform, is_primary FROM unit_calendars WHERE unit_id IN (${activeUnitIds.map(() => "?").join(",")})`,
        activeUnitIds
      );
    }

    // Enrich each unit with computed status and readiness data
    for (const unit of liveUnitsList) {
      unit.unit_calendars = calendars.filter((c: any) => c.unit_id === unit.id);

      const activeGuest = unit.active_manual_guest || unit.active_ical_guest;
      const activeCheckinDate = unit.active_manual_checkin || unit.active_ical_checkin;

      let readinessGuest = unit.readiness_guest_name;
      let readinessCheckin = unit.readiness_checkin_date;
      let readinessCheckout = unit.readiness_checkout_date;
      let readinessNotes = unit.readiness_notes;

      if (activeGuest) {
        const bookingStart = activeCheckinDate ? new Date(activeCheckinDate) : null;
        const lastManualUpdate = unit.readiness_updated_at ? new Date(unit.readiness_updated_at) : null;
        const staffOverrodeAfterBooking = lastManualUpdate && bookingStart && lastManualUpdate > bookingStart;
        if (!staffOverrodeAfterBooking) {
          readinessGuest = activeGuest;
          readinessCheckin = activeCheckinDate;
          readinessCheckout = unit.active_manual_checkout || unit.active_ical_checkout;
          readinessNotes = unit.active_manual_notes || unit.readiness_notes || (unit.active_ical_guest ? `iCal: ${unit.active_ical_guest}` : null);
        }
      }

      const hasCheckinToday = !!(unit.manual_checkin_date || unit.ical_checkin_date);
      const hasCheckoutToday = !!(unit.manual_checkout_date || unit.ical_checkout_date);
      const updatedAt = unit.readiness_updated_at ? new Date(unit.readiness_updated_at) : null;
      const wasUpdatedToday = updatedAt && formatDate(updatedAt) === todayStr;

      let computed = unit.readiness_status || "ready";
      if (!wasUpdatedToday || !unit.readiness_status) {
        if (hasCheckoutToday && (computed === "occupied" || !unit.readiness_status)) computed = "checkout_today";
        else if (hasCheckinToday && (computed === "ready" || computed === "booked" || !unit.readiness_status)) computed = "checkin_today";
      }

      unit._computed_status = computed;
      unit._has_checkin_today = hasCheckinToday;
      unit._has_checkout_today = hasCheckoutToday;
      unit._readinessGuest = readinessGuest;
      unit._readinessCheckin = readinessCheckin;
      unit._readinessCheckout = readinessCheckout;
      unit._readinessNotes = readinessNotes;
    }

    // Group and aggregate units
    const grouped = new Map<string, { primary: any; units: any[] }>();
    for (const unit of liveUnitsList) {
      const key = (unit.readiness_group_id as string | null) || (unit.unit_code as string | null) || (unit.unit_name as string | null) || (unit.id as string);
      const existing = grouped.get(key);
      if (!existing) grouped.set(key, { primary: unit, units: [unit] });
      else existing.units.push(unit);
    }

    const liveUnits = Array.from(grouped.values()).map(({ primary, units }) => {
      let totalRevLive = 0, totalBookingsLive = 0, totalMaint = 0;
      const bookedDays = new Set<number>();
      const platforms = new Set<string>();

      const calYear = calNow.getFullYear();
      const calMonthStr = String(calNow.getMonth() + 1).padStart(2, "0");

      const parseToYYYYMMDD = (val: any): string => {
        if (!val) return "";
        if (val instanceof Date) return formatDate(val);
        if (typeof val === "string") return val.split("T")[0];
        return "";
      };

      for (const u of units) {
        totalRevLive += Number(u.total_revenue || 0);
        totalBookingsLive += Number(u.bookings_count || 0);
        totalMaint += Number(u.active_maint_tickets || 0);
        (u.unit_calendars || []).forEach((cal: any) => { if (cal.platform) platforms.add(cal.platform.toLowerCase()); });

        const allIntervals = [
          ...activeBookings.filter((b: any) => b.unit_id === u.id).map((b: any) => ({ start: parseToYYYYMMDD(b.start_date), end: parseToYYYYMMDD(b.end_date) })),
          ...activeReservations.filter((r: any) => r.unit_id === u.id).map((r: any) => ({ start: parseToYYYYMMDD(r.start_date), end: parseToYYYYMMDD(r.end_date) })),
        ];

        for (let day = 1; day <= calLastDay; day++) {
          const checkDateStr = `${calYear}-${calMonthStr}-${String(day).padStart(2, "0")}`;
          for (const interval of allIntervals) {
            if (interval.start && interval.end && checkDateStr >= interval.start && checkDateStr <= interval.end) {
              bookedDays.add(day);
              break;
            }
          }
        }
      }

      const fmt = (v: any) => v ? (typeof v === "string" ? v.split("T")[0] : v.toISOString().split("T")[0]) : null;

      return {
        id: primary.id,
        title: primary.unit_name,
        unitCode: primary.unit_code || null,
        status: primary._computed_status,
        readinessStatus: primary._computed_status,
        guest: primary._readinessGuest || null,
        checkinDate: fmt(primary._readinessCheckin),
        checkoutDate: fmt(primary._readinessCheckout),
        notes: primary._readinessNotes || null,
        updatedAt: primary.readiness_updated_at ? (typeof primary.readiness_updated_at === "string" ? primary.readiness_updated_at : primary.readiness_updated_at.toISOString()) : null,
        revenue: totalRevLive,
        bookingsCount: totalBookingsLive,
        activeMaintTickets: totalMaint,
        bookedDays: Array.from(bookedDays),
        platforms: Array.from(platforms),
        unit_name: primary.unit_name,
        unit_code: primary.unit_code || null,
        readiness_status: primary.readiness_status,
        readiness_checkout_date: primary.readiness_checkout_date,
        readiness_checkin_date: primary.readiness_checkin_date,
        readiness_guest_name: primary.readiness_guest_name,
        readiness_notes: primary.readiness_notes,
        readiness_updated_at: primary.readiness_updated_at,
        readiness_updated_by: primary.readiness_updated_by,
        readiness_group_id: primary.readiness_group_id,
        active_manual_guest: primary.active_manual_guest,
        active_ical_guest: primary.active_ical_guest,
        active_manual_checkin: primary.active_manual_checkin,
        active_ical_checkin: primary.active_ical_checkin,
        active_manual_checkout: primary.active_manual_checkout,
        active_ical_checkout: primary.active_ical_checkout,
        active_manual_notes: primary.active_manual_notes,
        _has_checkin_today: primary._has_checkin_today,
        _has_checkout_today: primary._has_checkout_today,
        _merged_units: units,
      };
    });

    // ── 14. Unit Profitability (Bookings + CRM Won) ────────
    const profitabilityList = await query<any>(
      `SELECT * FROM (
        SELECT u.id, u.unit_name, u.profit_share, inv.default_profit_share,
                COALESCE(
                  (SELECT platform FROM bookings b WHERE b.unit_id = u.id ORDER BY b.checkin_date DESC LIMIT 1),
                  (SELECT platform FROM reservations r WHERE r.unit_id = u.id ORDER BY r.start_date DESC LIMIT 1)
                ) as platform,
                -- Booking revenue (pro-rated)
                COALESCE((SELECT SUM(
                     (b.amount / COALESCE(NULLIF(DATEDIFF(b.checkout_date, b.checkin_date), 0), 1)) *
                     GREATEST(0, DATEDIFF(LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?), GREATEST(b.checkin_date, ?)) + 1)
                   ) FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ?), 0) as b_rev,
                -- Booking occupied days
                COALESCE((SELECT SUM(GREATEST(0, DATEDIFF(LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?), GREATEST(b.checkin_date, ?)) + 1)) FROM bookings b WHERE b.unit_id = u.id AND b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ?), 0) as b_days,
                -- iCal occupied days
                COALESCE((SELECT SUM(GREATEST(0, DATEDIFF(LEAST(CASE WHEN r.end_date = r.start_date THEN r.end_date ELSE r.end_date - INTERVAL 1 DAY END, ?), GREATEST(r.start_date, ?)) + 1)) FROM reservations r WHERE r.unit_id = u.id AND r.start_date <= ? AND (CASE WHEN r.end_date = r.start_date THEN r.end_date ELSE r.end_date - INTERVAL 1 DAY END) >= ?), 0) as r_days,
                -- CRM Won deal value
                COALESCE((SELECT SUM(cd.value) FROM crm_deals cd WHERE cd.unit_id = u.id AND cd.stage IN ('completed', 'management') AND cd.created_at >= ? AND cd.created_at <= ?), 0) as crm_won_value,
                -- CRM Pipeline value
                COALESCE((SELECT SUM(cd.value) FROM crm_deals cd WHERE cd.unit_id = u.id AND cd.status = 'open' AND cd.created_at >= ? AND cd.created_at <= ?), 0) as crm_pipeline_value,
                -- CRM Won count
                (SELECT COUNT(*) FROM crm_deals cd WHERE cd.unit_id = u.id AND cd.stage IN ('completed', 'management') AND cd.created_at >= ? AND cd.created_at <= ?) as crm_won_count,
                (SELECT COUNT(*) FROM reservations r2 WHERE r2.unit_id = u.id AND r2.start_date <= ? AND (CASE WHEN r2.end_date = r2.start_date THEN r2.end_date ELSE r2.end_date - INTERVAL 1 DAY END) >= ?) as r_count,
                (SELECT COUNT(*) FROM bookings b2 WHERE b2.unit_id = u.id AND b2.checkin_date <= ? AND (CASE WHEN b2.checkout_date = b2.checkin_date THEN b2.checkout_date ELSE b2.checkout_date - INTERVAL 1 DAY END) >= ?) as b_count,
                (SELECT COUNT(*) FROM maintenance_tickets mt WHERE mt.unit_id = u.id AND mt.status = 'resolved' AND mt.created_at >= ? AND mt.created_at <= ?) as m_tickets
         FROM units u
         LEFT JOIN investors inv ON u.investor_id = inv.id
         WHERE u.status = 'active' ${accountFilterUnits}
         GROUP BY u.id, u.unit_name, u.profit_share, inv.default_profit_share
       ) as tmp
       ORDER BY (b_rev + crm_won_value) DESC`,
      [
        endDateStr, startDateStr, endDateStr, startDateStr, // b_rev
        endDateStr, startDateStr, endDateStr, startDateStr, // b_days
        endDateStr, startDateStr, endDateStr, startDateStr, // r_days
        startDateStr + " 00:00:00", endDateStr + " 23:59:59", // crm_won_value
        startDateStr + " 00:00:00", endDateStr + " 23:59:59", // crm_pipeline_value
        startDateStr + " 00:00:00", endDateStr + " 23:59:59", // crm_won_count
        endDateStr, startDateStr, // r_count
        endDateStr, startDateStr, // b_count
        startDateStr, endDateStr, // m_tickets
        ...paramsUnits,
      ]
    );

    const profitability = profitabilityList.map((unit: any) => {
      const bookingRev = Number(unit.b_rev || 0);
      const crmWonValue = Number(unit.crm_won_value || 0);
      const crmPipelineValue = Number(unit.crm_pipeline_value || 0);
      const crmWonCount = Number(unit.crm_won_count || 0);
      const uRev = bookingRev + crmWonValue;
      const bDays = Number(unit.b_days || 0);
      const rDays = Number(unit.r_days || 0);
      const occupiedDays = bDays + rDays;
      const occupancy = daysCount > 0 ? Math.min(100, Math.round((occupiedDays / daysCount) * 100)) : 0;
      const adrUnit = bDays > 0 ? Math.round(bookingRev / bDays) : 0;
      const revparUnit = daysCount > 0 ? Math.round(bookingRev / daysCount) : 0;

      const profitShare = unit.profit_share !== null && unit.profit_share !== undefined
        ? Number(unit.profit_share)
        : (unit.default_profit_share !== null && unit.default_profit_share !== undefined ? Number(unit.default_profit_share) : 100.00);

      const investorPct = Math.max(0, 100 - profitShare);
      const investorPayout = Math.round(uRev * (investorPct / 100));
      const netProfit = Math.round(uRev * (profitShare / 100));
      const margin = uRev > 0 ? ((netProfit / uRev) * 100).toFixed(1) : "0.0";

      return {
        name: unit.unit_name,
        platform: unit.platform ? (unit.platform === "airbnb" ? "Airbnb" : "Gathern") : "حجز مباشر",
        revenueVal: uRev, bookingRevenueVal: bookingRev, crmRevenueVal: crmWonValue,
        crmPipelineVal: crmPipelineValue, crmWonCount, costVal: investorPayout,
        profitVal: netProfit, marginVal: Number(margin), occupancyVal: occupancy,
        adrVal: adrUnit, revparVal: revparUnit, profitSharePct: profitShare, investorPct,
        revenue: `${uRev.toLocaleString("en-US")} ر.س`,
        bookingRevenue: `${bookingRev.toLocaleString("en-US")} ر.س`,
        crmRevenue: `${crmWonValue.toLocaleString("en-US")} ر.س`,
        crmPipeline: `${crmPipelineValue.toLocaleString("en-US")} ر.س`,
        cost: `${investorPayout.toLocaleString("en-US")} ر.س`,
        profit: `${netProfit.toLocaleString("en-US")} ر.س`,
        margin: `${margin}%`, occupancy: `${occupancy}%`,
        adr: `${adrUnit.toLocaleString("en-US")} ر.س`, revpar: `${revparUnit.toLocaleString("en-US")} ر.س`,
        status: Number(margin) > 75 ? "high" : "normal",
      };
    });

    // ── 15. CRM ────────────────────────────────────────────
    const { crmKPIs, crmStatusDistribution, paramsCrm, crmAccountFilter } =
      await fetchCrmKPIs(startDateStr, endDateStr, account);
    const [crmPipeline, recentDeals] = await Promise.all([
      fetchCrmPipeline(paramsCrm, crmAccountFilter),
      fetchRecentDeals(paramsCrm, crmAccountFilter),
    ]);

    // ── 16. HR ─────────────────────────────────────────────
    const [{ hrPayroll, hrPayrollDetails }, { employeeAttendance, attendanceStats }, { jobTitleStats, leaveRequests }] =
      await Promise.all([
        fetchHRPayroll(startDateStr, endDateStr),
        fetchAttendanceReport(startDateStr, endDateStr, range),
        fetchHRMiscData(startDateStr, endDateStr),
      ]);

    // ── 17. Maintenance & Invoices ─────────────────────────
    const [maintenanceAnalytics, invoiceAnalytics] = await Promise.all([
      fetchMaintenanceAnalytics(startDateStr, endDateStr, accountFilterUnits, paramsUnits),
      fetchInvoiceAnalytics(startDateStr, endDateStr),
    ]);

    // ── 18. Assemble & cache response ──────────────────────
    const responseData = {
      stats: {
        totalRevenue: `${totalRevenue.toLocaleString("en-US")} ر.س`,
        occupancyRate: `${occupancyRate}%`,
        adr: `${adr.toLocaleString("en-US")} ر.س`,
        revpar: `${revpar.toLocaleString("en-US")} ر.س`,
        totalBookings: totalBookingsCount,
        totalExpenses: `${totalExpenses.toLocaleString("en-US")} ر.س`,
        netIncome: `${netIncome.toLocaleString("en-US")} ر.س`,
        repeatGuestRate: `${repeatGuestRate}%`,
      },
      platformShare: {
        airbnb: { percent: totalRevenue > 0 ? Math.round((platformShare.airbnb / totalRevenue) * 100) : 0, value: `${platformShare.airbnb.toLocaleString("en-US")} ر.س` },
        gathern: { percent: totalRevenue > 0 ? Math.round((platformShare.gathern / totalRevenue) * 100) : 0, value: `${platformShare.gathern.toLocaleString("en-US")} ر.س` },
        external: { percent: totalRevenue > 0 ? Math.round((platformShare.external / totalRevenue) * 100) : 0, value: `${platformShare.external.toLocaleString("en-US")} ر.س` },
      },
      monthlyData,
      liveUnits,
      profitability,
      crmPipeline,
      recentDeals,
      crmKPIs,
      crmStatusDistribution,
      hrPayroll,
      hrPayrollDetails,
      employeeAttendance,
      attendanceStats,
      leaveRequests,
      jobTitleStats,
      maintenanceAnalytics,
      invoiceAnalytics,
    };

    analyticsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("Analytics Route Error:", error);
    return NextResponse.json({ error: "فشل استيراد وتحليل البيانات" }, { status: 500 });
  }
}
