// ============================================================
// Analytics Shared Types
// ============================================================

export interface AnalyticsContext {
  startDateStr: string;
  endDateStr: string;
  daysCount: number;
  account: string;
  accountFilterBookings: string;
  accountFilterReservations: string;
  accountFilterUnits: string;
  paramsBookings: unknown[];
  paramsReservations: unknown[];
  paramsOccupancyBookings: unknown[];
  paramsOccupancyReservations: unknown[];
  paramsUnits: unknown[];
  totalUnits: number;
  totalRevenue: number;
}

export interface EmployeeRow {
  basic_salary: number | string;
  housing_allowance: number | string;
  transport_allowance: number | string;
  other_allowances: number | string;
  hire_date: string | null;
  salary_currency: string | null;
}

export interface MonthlyDataPoint {
  month: string;
  amount: number;
  expenses: number;
  occupancy: number;
  percentage: string;
}

export interface ProfitabilityRow {
  name: string;
  platform: string;
  revenueVal: number;
  bookingRevenueVal: number;
  crmRevenueVal: number;
  crmPipelineVal: number;
  crmWonCount: number;
  costVal: number;
  profitVal: number;
  marginVal: number;
  occupancyVal: number;
  adrVal: number;
  revparVal: number;
  profitSharePct: number;
  investorPct: number;
  revenue: string;
  bookingRevenue: string;
  crmRevenue: string;
  crmPipeline: string;
  cost: string;
  profit: string;
  margin: string;
  occupancy: string;
  adr: string;
  revpar: string;
  status: "high" | "normal";
}
