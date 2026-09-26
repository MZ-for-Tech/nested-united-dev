// ============================================================
// HR Payroll, Attendance & Employee Analytics Queries
// ============================================================
import { query, queryOne } from "@/lib/db";

/** Full HR payroll breakdown (SAR vs EGP, pro-rated to selected period) */
export async function fetchHRPayroll(startDateStr: string, endDateStr: string) {
  const hrActiveEmployees = await query<any>(
    `SELECT e.basic_salary, e.housing_allowance, e.transport_allowance, e.other_allowances, e.hire_date, e.salary_currency 
     FROM hr_employees e
     LEFT JOIN users u ON e.user_id = u.id
     WHERE e.status = 'active'
       AND (u.role IS NULL OR u.role NOT IN ('super_admin', 'accountant'))
       AND (e.hire_date IS NULL OR e.hire_date <= ?)`,
    [endDateStr]
  );

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const periodDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  let sarBasic = 0, sarAllowances = 0, sarDeductions = 0;
  let egpBasic = 0, egpAllowances = 0, egpDeductions = 0;

  for (const emp of hrActiveEmployees) {
    const hireDate = emp.hire_date ? new Date(emp.hire_date) : null;
    const b = Number(emp.basic_salary || 0);
    const a = Number(emp.housing_allowance || 0) +
              Number(emp.transport_allowance || 0) +
              Number(emp.other_allowances || 0);
    const d = Math.round(b * 0.02); // 2% GOSI

    let days = periodDays;
    if (hireDate && hireDate > start) {
      days = Math.max(1, Math.ceil((end.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }

    const factor = days / 30;
    if (emp.salary_currency?.toUpperCase() === "EGP") {
      egpBasic += b * factor;
      egpAllowances += a * factor;
      egpDeductions += d * factor;
    } else {
      sarBasic += b * factor;
      sarAllowances += a * factor;
      sarDeductions += d * factor;
    }
  }

  const sarNet = Math.round(sarBasic + sarAllowances - sarDeductions);
  const egpNet = Math.round(egpBasic + egpAllowances - egpDeductions);

  return {
    hrPayroll: {
      basic: `${Math.round(sarBasic).toLocaleString("en-US")} ر.س`,
      allowances: `${Math.round(sarAllowances).toLocaleString("en-US")} ر.س`,
      deductions: `${Math.round(sarDeductions).toLocaleString("en-US")} ر.س`,
      net: `${sarNet.toLocaleString("en-US")} ر.س`,
    },
    hrPayrollDetails: {
      sar: {
        basic: `${Math.round(sarBasic).toLocaleString("en-US")} ر.س`,
        allowances: `${Math.round(sarAllowances).toLocaleString("en-US")} ر.س`,
        deductions: `${Math.round(sarDeductions).toLocaleString("en-US")} ر.س`,
        net: `${sarNet.toLocaleString("en-US")} ر.س`,
        rawNet: sarNet,
      },
      egp: {
        basic: `${Math.round(egpBasic).toLocaleString("en-US")} ج.م`,
        allowances: `${Math.round(egpAllowances).toLocaleString("en-US")} ج.م`,
        deductions: `${Math.round(egpDeductions).toLocaleString("en-US")} ج.م`,
        net: `${egpNet.toLocaleString("en-US")} ج.م`,
        rawNet: egpNet,
      },
      activeEmployeesSAR: hrActiveEmployees.filter((e: any) => e.salary_currency?.toUpperCase() !== "EGP").length,
      activeEmployeesEGP: hrActiveEmployees.filter((e: any) => e.salary_currency?.toUpperCase() === "EGP").length,
      totalActiveEmployees: hrActiveEmployees.length,
    },
  };
}

function getDatesInRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const current = new Date(startStr);
  const last = new Date(endStr);
  while (current <= last) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/** Employee attendance report for the given period */
export async function fetchAttendanceReport(
  startDateStr: string,
  endDateStr: string,
  range: string
) {
  const SYSTEM_START_DATE = "2026-06-01";

  const [employeeList, activeLeaves, attendanceRecords, defaultOffSetting] = await Promise.all([
    query<any>(
      `SELECT e.id, e.full_name, e.job_title, e.salary_currency, e.basic_salary,
              e.housing_allowance, e.transport_allowance, e.other_allowances, e.hire_date,
              s.days_off
       FROM hr_employees e
       LEFT JOIN hr_shifts s ON e.shift_id = s.id
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.status = 'active'
         AND (u.role IS NULL OR u.role NOT IN ('super_admin', 'accountant'))
         AND (e.hire_date IS NULL OR e.hire_date <= ?)`,
      [endDateStr]
    ),
    query<any>(
      `SELECT employee_id, start_date, end_date
       FROM hr_requests
       WHERE status = 'approved' AND start_date <= ? AND end_date >= ?`,
      [endDateStr, startDateStr]
    ),
    query<any>(
      `SELECT employee_id, date, status
       FROM hr_attendance
       WHERE date >= ? AND date <= ?`,
      [startDateStr, endDateStr]
    ),
    queryOne<{ setting_value: string }>(
      "SELECT setting_value FROM hr_settings WHERE setting_key = 'default_days_off'"
    ),
  ]);

  const defaultOffDays = defaultOffSetting?.setting_value
    ? defaultOffSetting.setting_value.split(",").filter(Boolean).map(Number)
    : [5, 6];

  // Build attendance lookup map
  const attendanceMap: Record<string, Record<string, string>> = {};
  for (const att of attendanceRecords) {
    const empId = att.employee_id;
    const dateStr =
      att.date instanceof Date ? att.date.toISOString().split("T")[0] : String(att.date).split(" ")[0];
    if (!attendanceMap[empId]) attendanceMap[empId] = {};
    attendanceMap[empId][dateStr] = att.status;
  }

  // UTC+3 yesterday for capping
  const localNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const yesterday = new Date(localNow.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let globalPresent = 0, globalLate = 0, globalAbsent = 0, globalLeave = 0;

  const employeeAttendance = employeeList.map((emp: any) => {
    let empStart = startDateStr < SYSTEM_START_DATE ? SYSTEM_START_DATE : startDateStr;
    if (emp.hire_date) {
      const hireStr =
        emp.hire_date instanceof Date
          ? emp.hire_date.toISOString().split("T")[0]
          : String(emp.hire_date).split(" ")[0];
      if (hireStr > empStart) empStart = hireStr;
    }

    const empEnd = range === "today" ? startDateStr : endDateStr < yesterdayStr ? endDateStr : yesterdayStr;

    let expected = 0, present = 0, late = 0, absent = 0, leave = 0;
    const basic = Number(emp.basic_salary || 0);
    const allowances = Number(emp.housing_allowance || 0) + Number(emp.transport_allowance || 0) + Number(emp.other_allowances || 0);
    const deductions = Math.round(basic * 0.02);
    const net = basic + allowances - deductions;

    if (empStart <= empEnd) {
      const daysOff = emp.days_off
        ? emp.days_off.split(",").filter(Boolean).map(Number)
        : defaultOffDays;
      const empLeaves = activeLeaves.filter((l: any) => l.employee_id === emp.id);

      for (const dStr of getDatesInRange(empStart, empEnd)) {
        const dayOfWeek = new Date(dStr).getDay();
        if (daysOff.includes(dayOfWeek)) continue;

        const attStatus = attendanceMap[emp.id]?.[dStr];
        if (attStatus) {
          if (attStatus === "present") { present++; }
          else if (attStatus === "late") { present++; late++; }
          else if (attStatus === "absent") { absent++; }
          else if (attStatus === "leave" || attStatus === "holiday") { leave++; }
        } else {
          const onLeave = empLeaves.some((l: any) => {
            const lS = l.start_date instanceof Date ? l.start_date.toISOString().split("T")[0] : String(l.start_date).split(" ")[0];
            const lE = l.end_date instanceof Date ? l.end_date.toISOString().split("T")[0] : String(l.end_date).split(" ")[0];
            return dStr >= lS && dStr <= lE;
          });
          onLeave ? leave++ : absent++;
        }
      }
    }

    expected = present + absent + leave;
    globalPresent += present;
    globalLate += late;
    globalAbsent += absent;
    globalLeave += leave;

    const attendanceRate = expected > 0 ? Math.round((present / expected) * 100) : -1;
    return {
      id: emp.id,
      name: emp.full_name,
      jobTitle: emp.job_title || "موظف",
      currency: emp.salary_currency || "SAR",
      basic, allowances, deductions, net,
      totalDays: expected, presentDays: present, lateDays: late, absentDays: absent, leaveDays: leave,
      attendanceRate,
      attend: `${attendanceRate}% حضور`,
      delay: `${late} تأخير`,
    };
  });

  const attendanceStats = [
    { status: "حاضر", count: globalPresent },
    { status: "متأخر", count: globalLate },
    { status: "غائب", count: globalAbsent },
    { status: "إجازة", count: globalLeave },
  ].filter((item) => item.count > 0);

  return { employeeAttendance, attendanceStats };
}

/** Job title distribution + leave requests for HR tab */
export async function fetchHRMiscData(startDateStr: string, endDateStr: string) {
  const ARABIC_REQUEST_TYPES: Record<string, string> = {
    annual_leave: "إجازة سنوية",
    sick_leave: "إجازة مرضية",
    unpaid_leave: "إجازة بدون راتب",
    emergency_leave: "إجازة طارئة",
  };
  const ARABIC_STATUSES: Record<string, string> = {
    pending: "معلقة",
    approved: "معتمدة",
    rejected: "مرفوضة",
  };

  const [jobTitleStatsList, leaveRequestsList] = await Promise.all([
    query<any>(
      `SELECT e.job_title, COUNT(*) as count 
       FROM hr_employees e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.status = 'active'
         AND (u.role IS NULL OR u.role NOT IN ('super_admin', 'accountant'))
         AND (e.hire_date IS NULL OR e.hire_date <= ?)
       GROUP BY e.job_title`,
      [endDateStr]
    ),
    query<any>(
      `SELECT r.id, r.request_type, r.start_date, r.end_date, r.days_count, r.reason, r.status, e.full_name as employee_name
       FROM hr_requests r
       INNER JOIN hr_employees e ON r.employee_id = e.id
       LEFT JOIN users u ON e.user_id = u.id
       WHERE (u.role IS NULL OR u.role NOT IN ('super_admin', 'accountant'))
         AND (r.start_date <= ? AND r.end_date >= ?)
       ORDER BY r.created_at DESC`,
      [endDateStr, startDateStr]
    ),
  ]);

  const jobTitleStats = jobTitleStatsList.map((r: any) => ({
    name: r.job_title || "غير محدد",
    value: Number(r.count || 0),
  }));

  const leaveRequests = leaveRequestsList.map((r: any) => ({
    id: r.id,
    employeeName: r.employee_name,
    type: ARABIC_REQUEST_TYPES[r.request_type] || r.request_type,
    startDate: r.start_date
      ? typeof r.start_date === "string" ? r.start_date.split("T")[0] : r.start_date.toISOString().split("T")[0]
      : "",
    endDate: r.end_date
      ? typeof r.end_date === "string" ? r.end_date.split("T")[0] : r.end_date.toISOString().split("T")[0]
      : "",
    daysCount: parseFloat(r.days_count || 0),
    reason: r.reason || "لا يوجد سبب محدد",
    status: r.status,
    statusLabel: ARABIC_STATUSES[r.status] || r.status,
  }));

  return { jobTitleStats, leaveRequests };
}
