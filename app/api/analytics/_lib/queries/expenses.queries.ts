// ============================================================
// Expenses, Payroll & Investor Payout Queries
// ============================================================
import { query } from "@/lib/db";
import { buildParams } from "../account-filter";
import { EmployeeRow } from "../types";

/** Fetch all active SAR-salaried employees for payroll calculation */
export async function fetchEmployees(): Promise<EmployeeRow[]> {
  return query<EmployeeRow>(
    `SELECT basic_salary, housing_allowance, transport_allowance, other_allowances, hire_date, salary_currency 
     FROM hr_employees 
     WHERE status = 'active' AND exclude_from_payroll = 0`
  );
}

/**
 * Calculate total payroll cost for a given period using daily pro-ration.
 * - Skips EGP-salaried employees (handled manually by accountant).
 * - Applies 2% GOSI deduction on basic salary.
 * - Pro-rates from hire date if hired during the period.
 */
export function calculatePayrollForPeriod(
  employees: EmployeeRow[],
  startStr: string,
  endStr: string
): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  let totalPayroll = 0;

  for (const emp of employees) {
    const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
    if (hireDate && hireDate > end) continue;

    const currency = emp.salary_currency || "SAR";
    if (currency.toUpperCase() === "EGP") continue; // Skipped — handled manually

    const basic = Number(emp.basic_salary || 0);
    const allowances =
      Number(emp.housing_allowance || 0) +
      Number(emp.transport_allowance || 0) +
      Number(emp.other_allowances || 0);
    const deductions = Math.round(basic * 0.02); // 2% GOSI
    const monthlyNet = basic + allowances - deductions;

    const effectiveStart = !hireDate || hireDate <= start ? start : hireDate;
    const days = Math.max(
      1,
      Math.ceil((end.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
    totalPayroll += (monthlyNet / 30) * days;
  }

  return Math.round(totalPayroll);
}

/** Total investor payout across all filtered units for the given period */
export async function fetchInvestorPayouts(
  startStr: string,
  endStr: string,
  accountIds: string[],
  accountFilterBookings: string
): Promise<number> {
  const p = buildParams([endStr, startStr, endStr, startStr], accountIds);

  const rows = await query<any>(
    `SELECT 
        b.unit_id,
        SUM(
          (b.amount / COALESCE(NULLIF(DATEDIFF(b.checkout_date, b.checkin_date), 0), 1)) *
          GREATEST(0, DATEDIFF(
            LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?),
            GREATEST(b.checkin_date, ?)
          ) + 1)
        ) as unit_revenue,
        u.profit_share,
        inv.default_profit_share
     FROM bookings b
     INNER JOIN units u ON b.unit_id = u.id
     LEFT JOIN investors inv ON u.investor_id = inv.id
     WHERE b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ?
     ${accountFilterBookings}
     GROUP BY b.unit_id, u.profit_share, inv.default_profit_share`,
    p
  );

  let totalPayout = 0;
  for (const row of rows) {
    const rev = Number(row.unit_revenue || 0);
    const companyPct =
      row.profit_share !== null
        ? Number(row.profit_share)
        : row.default_profit_share !== null
        ? Number(row.default_profit_share)
        : 100;
    const investorPct = Math.max(0, 100 - companyPct);
    totalPayout += rev * (investorPct / 100);
  }

  return Math.round(totalPayout);
}

/**
 * Aggregate all expense components for the main date range:
 * vendor bills, payroll (allocated by unit share), investor payouts, maintenance.
 */
export async function fetchMainExpenses(opts: {
  startDateStr: string;
  endDateStr: string;
  totalBookingsCount: number;
  maintenanceCount: number;
  totalUnits: number;
  totalUnitsCount: number;
  employees: EmployeeRow[];
  accountIds: string[];
  accountFilterBookings: string;
}) {
  const {
    startDateStr, endDateStr,
    totalBookingsCount, maintenanceCount,
    totalUnits, totalUnitsCount,
    employees, accountIds, accountFilterBookings
  } = opts;

  const invoicesResult = await query<{ total: number | string }>(
    `SELECT SUM(total_amount) as total FROM accounting_invoices 
     WHERE invoice_type = 'vendor_bill' AND deleted_at IS NULL
       AND invoice_date >= ? AND invoice_date <= ?`,
    [startDateStr, endDateStr]
  );
  const vendorBills = Number(invoicesResult[0]?.total || 0);

  const payrollForPeriod = calculatePayrollForPeriod(employees, startDateStr, endDateStr);
  const allocatedPayroll = totalUnitsCount > 0 ? (totalUnits / totalUnitsCount) * payrollForPeriod : 0;
  const allocatedInvoices = totalUnitsCount > 0 ? (totalUnits / totalUnitsCount) * vendorBills : 0;

  const investorPayouts = await fetchInvestorPayouts(startDateStr, endDateStr, accountIds, accountFilterBookings);

  const operatingExpenses = totalBookingsCount * 0;
  const maintenanceExpenses = maintenanceCount * 0;

  const totalExpenses = Math.round(
    operatingExpenses + maintenanceExpenses + allocatedPayroll + allocatedInvoices + investorPayouts
  );

  return { vendorBills, allocatedPayroll, allocatedInvoices, investorPayouts, totalExpenses };
}

/**
 * Period-scoped expense total for trend chart series.
 * Used inside getPeriodExpenses (cashflow trend).
 */
export async function getPeriodExpenses(opts: {
  startStr: string;
  endStr: string;
  accountIds: string[];
  accountFilterBookings: string;
  accountFilterReservations: string;
  accountFilterUnits: string;
  totalUnits: number;
  totalUnitsCount: number;
  employees: EmployeeRow[];
}): Promise<number> {
  const {
    startStr, endStr,
    accountIds,
    accountFilterBookings, accountFilterReservations, accountFilterUnits,
    totalUnits, totalUnitsCount, employees
  } = opts;

  const pCountB = buildParams([endStr, startStr], accountIds);
  const pCountR = buildParams([endStr, startStr], accountIds);
  const pMaint = buildParams([startStr, endStr], accountIds);

  const [bCountRes, rCountRes, maintRes, invoicesRes] = await Promise.all([
    query<{ count: number }>(
      `SELECT COUNT(*) as count FROM bookings b
       INNER JOIN units u ON b.unit_id = u.id
       WHERE b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}`,
      pCountB
    ),
    query<{ count: number }>(
      `SELECT COUNT(*) as count FROM reservations r
       INNER JOIN units u ON r.unit_id = u.id
       WHERE r.start_date <= ? AND (CASE WHEN r.end_date = r.start_date THEN r.end_date ELSE r.end_date - INTERVAL 1 DAY END) >= ? ${accountFilterReservations}`,
      pCountR
    ),
    query<{ count: number }>(
      `SELECT COUNT(*) as count FROM maintenance_tickets mt
       INNER JOIN units u ON mt.unit_id = u.id
       WHERE mt.status = 'resolved' 
         AND mt.created_at >= ? AND mt.created_at <= ?
         ${accountFilterUnits}`,
      pMaint
    ),
    query<{ total: number | string }>(
      `SELECT SUM(total_amount) as total FROM accounting_invoices 
       WHERE invoice_type = 'vendor_bill' AND deleted_at IS NULL
         AND invoice_date >= ? AND invoice_date <= ?`,
      [startStr, endStr]
    ),
  ]);

  const bCount = Number(bCountRes[0]?.count || 0);
  const rCount = Number(rCountRes[0]?.count || 0);
  const maintCount = Number(maintRes[0]?.count || 0);
  const vendorBillsVal = Number(invoicesRes[0]?.total || 0);

  const opExpenses = (bCount + rCount) * 0;
  const maintExpenses = maintCount * 0;

  const periodPayroll = calculatePayrollForPeriod(employees, startStr, endStr);
  const allocPayroll = totalUnitsCount > 0 ? (totalUnits / totalUnitsCount) * periodPayroll : 0;
  const allocInvoices = totalUnitsCount > 0 ? (totalUnits / totalUnitsCount) * vendorBillsVal : 0;

  const subInvestorPayouts = await fetchInvestorPayouts(startStr, endStr, accountIds, accountFilterBookings);

  return Math.round(opExpenses + maintExpenses + allocPayroll + allocInvoices + subInvestorPayouts);
}
