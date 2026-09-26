"use client";
import { UpdateStatusButton } from "@/app/dashboard/unit-readiness/UpdateStatusButton";
import { useRouter } from "next/navigation";

import { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Calendar,
  Filter,
  RefreshCw,
  PieChart as LucidePieChart,
  ChevronDown,
  Building2,
  Percent,
  Users,
  Briefcase,
  ClipboardList,
  CheckCircle,
  Wrench,
  ArrowUpRight,
  User,
  Clock,
  AlertTriangle,
  Search,
  ArrowUpDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LabelList,
} from "recharts";

interface Account {
  id: string;
  platform: string;
  account_name: string;
  ids?: string;
}
const JOB_TRANSLATIONS: Record<string, string> = {
  "admin": "مسؤول إداري",
  "ceo": "الرئيس التنفيذي",
  "hr_manager": "مدير الموارد البشرية",
  "super_admin": "مدير النظام العام",
  "accountant": "محاسب",
  "developer": "مطور برمجيات",
  "designer": "مصمم",
  "marketer": "مسؤول تسويق",
  "sales": "مسؤول مبيعات",
  "customer_service": "خدمة العملاء",
  "operations": "مدير العمليات",
  "cleaner": "مسؤول نظافة",
  "receptionist": "موظف استقبال",
  "security": "حارس أمن",
  "driver": "سائق",
  "technician": "فني صيانة",
  "manager": "مدير قسم",
  "agent": "وكيل خدمة",
};

function translateJobTitle(title: string): string {
  if (!title) return "";
  const normalized = title.trim().toLowerCase();
  return JOB_TRANSLATIONS[normalized] || title;
}

const NoDataState = () => (
  <div className="flex flex-col items-center justify-center w-full h-full min-h-[180px] bg-slate-50/30 border border-dashed border-slate-100 rounded-xl p-4 text-center">
    <div className="p-2.5 bg-white shadow-sm border border-slate-50 rounded-full mb-1.5">
      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.008 1.24l.885 1.77a2.25 2.25 0 002.007 1.24h1.98a2.25 2.25 0 002.007-1.24l.885-1.77a2.25 2.25 0 012.007-1.24h3.86m-18 0h18m-18 0V4.5A2.25 2.25 0 014.5 2.25h15A2.25 2.25 0 0121.75 4.5v9m-18 0v6.75A2.25 2.25 0 004.5 22.5h15a2.25 2.25 0 002.25-2.25V13.5m-16.5 0h16.5" />
      </svg>
    </div>
    <p className="text-xs font-bold text-slate-600">لا توجد بيانات متاحة</p>
    <p className="text-[10px] text-slate-400 mt-0.5">يرجى اختيار فترة زمنية أخرى أو تعديل التصفية</p>
  </div>
);

interface AnalyticsDashboardClientProps {
  initialAccounts: Account[];
  lastSyncTime: string | null;
  activeTab: "executive" | "live_ops" | "profitability" | "crm" | "hr";
}

export function AnalyticsDashboardClient({
  initialAccounts,
  lastSyncTime,
  activeTab: initialActiveTab,
}: AnalyticsDashboardClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"executive" | "live_ops" | "profitability" | "crm" | "hr">(
    initialActiveTab
  );

  useEffect(() => {
    setActiveTab(initialActiveTab);
  }, [initialActiveTab]);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("month");
  const [liveOpsFilter, setLiveOpsFilter] = useState<"all" | "occupied" | "ready" | "cleaning" | "maintenance">("all");

  // Profitability Tab interactive search and sorting states
  const [profitabilitySearch, setProfitabilitySearch] = useState("");
  const [profitabilitySortField, setProfitabilitySortField] = useState<"name" | "revenue" | "cost" | "profit" | "margin" | "occupancy" | "adr" | "revpar">("revenue");
  const [profitabilitySortAsc, setProfitabilitySortAsc] = useState(false);

  // HR Tab interactive states
  const [hrSearch, setHrSearch] = useState("");
  const [hrSortField, setHrSortField] = useState<"name" | "jobTitle" | "net" | "attendanceRate">("name");
  const [hrSortAsc, setHrSortAsc] = useState(true);
  const [hrCurrencyFilter, setHrCurrencyFilter] = useState<"all" | "SAR" | "EGP">("all");

  // Date selection states
  const now = new Date();
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getISOWeekString = (date: Date): string => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getMondayOfISOWeek = (weekStr: string): Date => {
    const parts = weekStr.split("-W");
    if (parts.length !== 2) return new Date();
    const year = parseInt(parts[0], 10);
    const week = parseInt(parts[1], 10);
    const d = new Date(year, 0, 4);
    const day = d.getDay();
    const mondayOfWeek1 = new Date(year, 0, 4 - (day === 0 ? 6 : day - 1));
    mondayOfWeek1.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);
    return mondayOfWeek1;
  };

  const getWeekNumberOnly = (weekStr: string): string => {
    const parts = weekStr.split("-W");
    return parts[1] ? String(parseInt(parts[1], 10)) : "";
  };

  const [selectedDay, setSelectedDay] = useState<string>(getLocalDateString(now));
  const [selectedWeek, setSelectedWeek] = useState<string>(getISOWeekString(now));
  const [selectedMonth, setSelectedMonth] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [selectedYear, setSelectedYear] = useState<string>(String(now.getFullYear()));
  const [customStartDate, setCustomStartDate] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  );
  const [customEndDate, setCustomEndDate] = useState<string>(getLocalDateString(now));

  const getComputedDates = () => {
    const todayStr = getLocalDateString(now);
    if (dateRange === "today") {
      return { startDate: selectedDay, endDate: selectedDay };
    }
    if (dateRange === "week") {
      const monday = getMondayOfISOWeek(selectedWeek);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: getLocalDateString(monday), endDate: getLocalDateString(sunday) };
    }
    if (dateRange === "month") {
      const [year, month] = selectedMonth.split("-").map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      return {
        startDate: `${selectedMonth}-01`,
        endDate: `${selectedMonth}-${String(lastDay).padStart(2, "0")}`
      };
    }
    if (dateRange === "year") {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`
      };
    }
    if (dateRange === "all") {
      return {
        startDate: "2020-01-01",
        endDate: "2030-12-31"
      };
    }
    // custom
    return { startDate: customStartDate, endDate: customEndDate };
  };

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const bypassCacheRef = useRef<boolean>(true); // Start true for fresh first load

  // Live data states
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [localSyncTime, setLocalSyncTime] = useState<Date | null>(
    lastSyncTime ? new Date(lastSyncTime) : new Date()
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRefresh = (bypass: boolean = true) => {
    bypassCacheRef.current = bypass;
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Auto refresh every 30 seconds & instant refresh when returning to tab
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        handleRefresh(false);
      }
    }, 30000); // 30 seconds

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleRefresh(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const bypass = bypassCacheRef.current;
        bypassCacheRef.current = false; // Reset

        const { startDate, endDate } = getComputedDates();

        const queryParams = new URLSearchParams({
          account: selectedAccount,
          range: dateRange, // Send the selected dateRange for dynamic grouping
          startDate: startDate,
          endDate: endDate,
        });
        if (bypass) {
          queryParams.append("bypass", "true");
        }
        const res = await fetch(`/api/analytics?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error("فشل تحميل البيانات المالية والتشغيلية");
        }
        const json = await res.json();
        if (active) {
          setData(json);
          setLocalSyncTime(new Date());
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "حدث خطأ غير متوقع أثناء استرجاع المؤشرات");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchAnalytics();

    return () => {
      active = false;
    };
  }, [
    selectedAccount,
    dateRange,
    selectedDay,
    selectedWeek,
    selectedMonth,
    selectedYear,
    customStartDate,
    customEndDate,
    isRefreshing
  ]);

  // Data availability checks for showing NoDataState placeholders
  const hasRevenueTrendData = data?.monthlyData && data.monthlyData.length > 0;
  const hasPlatformShareData = data?.platformShare && ((data.platformShare.airbnb?.percent || 0) > 0 || (data.platformShare.gathern?.percent || 0) > 0 || (data.platformShare.external?.percent || 0) > 0);
  const hasProfitabilityData = data?.profitability && data.profitability.length > 0 && data.profitability.some((u: any) => {
    const rev = u.revenue ? parseFloat(u.revenue.replace(/,/g, "")) : 0;
    return rev > 0;
  });
  const hasCashFlowData = data?.monthlyData && data.monthlyData.length > 0;
  const hasOccupancyData = data?.monthlyData && data.monthlyData.length > 0;

  const totalTickets = data?.maintenanceAnalytics?.statusDist
    ? data.maintenanceAnalytics.statusDist.reduce((acc: number, r: any) => acc + r.count, 0)
    : 0;
  const hasMaintenanceStatusData = data?.maintenanceAnalytics?.statusDist && data.maintenanceAnalytics.statusDist.length > 0 && totalTickets > 0;
  const hasMaintenanceTopUnitsData = data?.maintenanceAnalytics?.topUnits && data.maintenanceAnalytics.topUnits.length > 0 && data.maintenanceAnalytics.topUnits.some((u: any) => u.count > 0);
  const hasInvoiceData = data?.invoiceAnalytics && data.invoiceAnalytics.length > 0 && data.invoiceAnalytics.some((item: any) => (item.total || 0) > 0 || (item.count || 0) > 0);

  const formattedSyncTime = localSyncTime
    ? localSyncTime.toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    : "لم تتم المزامنة بعد";

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">التحليلات المتقدمة</h1>
          <p className="text-sm text-gray-500 mt-1">
            مؤشرات أداء الأعمال الحية والإحصاءات التشغيلية والمالية الشاملة
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => handleRefresh(true)}
            disabled={isRefreshing || loading}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm transition-all text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isRefreshing || loading ? "animate-spin" : ""}`} />
            <span>تحديث لوحة التحليلات</span>
          </button>
        </div>
      </div>

      {/* 2. Global Controls Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
          {/* Smart Account Filter */}
          {activeTab !== "hr" && (
            <div className="flex flex-col gap-1.5 min-w-[220px]">
              <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <span>مصدر البيانات والمنصات</span>
              </label>
              <div className="relative">
                <select
                  value={selectedAccount}
                  onChange={(e) => {
                    bypassCacheRef.current = true;
                    setSelectedAccount(e.target.value);
                  }}
                  className="w-full bg-gray-50/50 hover:bg-gray-50 border border-gray-200 text-gray-800 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none pl-8"
                >
                  <option value="all">كل المنصات والحسابات</option>
                  {initialAccounts.map((account) => (
                    <option key={account.id} value={account.ids || account.id}>
                      {account.account_name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Date Range Filter */}
          {activeTab !== "live_ops" && (
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>الفترة الزمنية للتقرير</span>
              </label>
              <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-200/60 max-w-max">
                {[
                  { id: "today", label: "يوم" },
                  { id: "week", label: "أسبوع" },
                  { id: "month", label: "شهر" },
                  { id: "year", label: "سنة" },
                  { id: "all", label: "الكل" },
                  { id: "custom", label: "مخصص" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      bypassCacheRef.current = true;
                      setDateRange(opt.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === opt.id
                        ? "bg-white text-blue-600 shadow-sm border border-gray-100"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sync Info Badges */}
        <div className="flex items-center gap-3 lg:self-end">
          <div className="flex flex-col text-left lg:text-right gap-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">مزامنة القنوات المباشرة</span>
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-100 px-3 py-1.5 rounded-xl text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>آخر تحديث: {formattedSyncTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Conditional Date picker dependent on selected dateRange */}
      {activeTab !== "live_ops" && dateRange === "today" && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200/70 p-4 flex items-center gap-4 max-w-max animate-fadeIn">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">اختر اليوم:</label>
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => {
                bypassCacheRef.current = true;
                setSelectedDay(e.target.value);
              }}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      )}

      {activeTab !== "live_ops" && dateRange === "week" && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200/70 p-4 flex items-center gap-4 max-w-max animate-fadeIn">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">اختر الأسبوع (أسبوع رقم {getWeekNumberOnly(selectedWeek)}):</label>
            <input
              type="week"
              value={selectedWeek}
              onChange={(e) => {
                bypassCacheRef.current = true;
                setSelectedWeek(e.target.value);
              }}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      )}

      {activeTab !== "live_ops" && dateRange === "month" && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200/70 p-4 flex items-center gap-4 max-w-max animate-fadeIn">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">اختر الشهر:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                bypassCacheRef.current = true;
                setSelectedMonth(e.target.value);
              }}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      )}

      {activeTab !== "live_ops" && dateRange === "year" && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200/70 p-4 flex items-center gap-4 max-w-max animate-fadeIn">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">اختر السنة:</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                bypassCacheRef.current = true;
                setSelectedYear(e.target.value);
              }}
              className="bg-white border border-gray-200 rounded-xl px-3.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activeTab !== "live_ops" && dateRange === "all" && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200/70 p-4 flex items-center gap-4 max-w-max animate-fadeIn">
          <span className="text-xs font-semibold text-gray-500">تم تحديد كامل الفترة الزمنية للبيانات تلقائياً</span>
        </div>
      )}

      {activeTab !== "live_ops" && dateRange === "custom" && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200/70 p-4 flex flex-col sm:flex-row items-center gap-4 max-w-max animate-fadeIn">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">من:</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => {
                bypassCacheRef.current = true;
                setCustomStartDate(e.target.value);
              }}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">إلى:</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => {
                bypassCacheRef.current = true;
                setCustomEndDate(e.target.value);
              }}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      )}

      {/* Main Contents Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[420px] flex flex-col justify-between relative">
        {loading && !data && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-bold text-gray-500">جاري معالجة وتحليل البيانات الفعلية...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-4 my-4 flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        )}

        {data && (
          <>
            {activeTab === "executive" && (
              <div className="space-y-8 animate-fadeIn">
                {/* Tab Header */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900">ملخص الأداء التنفيذي الموحد</h2>
                  <p className="text-xs text-gray-500 mt-0.5">مؤشرات الأداء الأساسية وإجمالي الإيرادات ومعدلات الإشغال الفعلية</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Card 1 */}
                  <div className="bg-gradient-to-br from-emerald-50/40 to-emerald-50/10 border border-emerald-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">إجمالي الإيرادات</span>
                      <div className="p-2 bg-emerald-500 text-white rounded-xl">
                        <DollarSign className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-gray-900">{data.stats.totalRevenue}</p>
                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                        <span>قراءة حية للتدفقات المالية</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="bg-gradient-to-br from-teal-50/40 to-teal-50/10 border border-teal-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">متوسط نسبة الإشغال</span>
                      <div className="p-2 bg-teal-500 text-white rounded-xl">
                        <Percent className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-gray-900">{data.stats.occupancyRate}</p>
                      <div className="flex items-center gap-1 text-teal-600 text-xs font-bold">
                        <span>نسبة المساحة المشغولة حالياً</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3 */}
                  <div className="bg-gradient-to-br from-amber-50/40 to-amber-50/10 border border-amber-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">متوسط السعر اليومي (ADR)</span>
                      <div className="p-2 bg-amber-500 text-white rounded-xl">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-gray-900">{data.stats.adr}</p>
                      <div className="flex items-center gap-1 text-gray-500 text-xs font-semibold">
                        <span>متوسط دخل الليلة الواحدة</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4 */}
                  <div className="bg-gradient-to-br from-purple-50/40 to-purple-50/10 border border-purple-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">العائد لكل وحدة متاحة (RevPAR)</span>
                      <div className="p-2 bg-purple-500 text-white rounded-xl">
                        <Building2 className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-gray-900">{data.stats.revpar}</p>
                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                        <span>توزيع كفاءة استغلال الأصول</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 5 */}
                  <div className="bg-gradient-to-br from-slate-50/40 to-slate-50/10 border border-slate-200/60 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">إجمالي الحجوزات</span>
                      <div className="p-2 bg-slate-500 text-white rounded-xl">
                        <ClipboardList className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-gray-900">{data.stats.totalBookings} حجز</p>
                      <div className="flex items-center gap-1 text-slate-600 text-xs font-bold">
                        <span>إجمالي الحجوزات المسجلة</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 6 */}
                  <div className="bg-gradient-to-br from-red-50/40 to-red-50/10 border border-red-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">إجمالي المصروفات</span>
                      <div className="p-2 bg-red-500 text-white rounded-xl">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-gray-900">{data.stats.totalExpenses}</p>
                      <div className="flex items-center gap-1 text-red-600 text-xs font-bold">
                        <span>تكاليف التشغيل والصيانة والرواتب</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 7 */}
                  {(() => {
                    const isLoss = data.stats.netIncome?.trim().startsWith("-");
                    return (
                      <div className={`bg-gradient-to-br ${isLoss ? "from-red-50/40 to-red-50/10 border-red-100/70" : "from-blue-50/40 to-blue-50/10 border-blue-100/70"} rounded-2xl p-5 space-y-3 relative overflow-hidden`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">{isLoss ? "صافي خسارة" : "صافي الدخل"}</span>
                          <div className={`p-2 ${isLoss ? "bg-red-500" : "bg-blue-500"} text-white rounded-xl`}>
                            <Briefcase className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className={`text-2xl font-black ${isLoss ? "text-red-600" : "text-gray-900"}`}>{data.stats.netIncome}</p>
                          <div className={`flex items-center gap-1 ${isLoss ? "text-red-600" : "text-blue-600"} text-xs font-bold`}>
                            <span>{isLoss ? "صافي الخسائر بعد المصروفات" : "صافي الأرباح بعد المصروفات"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Card 8 */}
                  <div className="bg-gradient-to-br from-indigo-50/40 to-indigo-50/10 border border-indigo-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500">معدل الضيوف المتكررين</span>
                      <div className="p-2 bg-indigo-500 text-white rounded-xl">
                        <Users className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-black text-gray-900">{data.stats.repeatGuestRate}</p>
                      <div className="flex items-center gap-1 text-indigo-600 text-xs font-bold">
                        <span>نسبة ولاء النزلاء وتكرار الحجز</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visual Analytics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Revenue Growth Card */}
                  <div className="lg:col-span-2 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between bg-white shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-900">
                          {dateRange === "today"
                            ? "تحليل الإيرادات والنمو اليومي"
                            : dateRange === "week"
                            ? "تحليل الإيرادات والنمو الأسبوعي"
                            : "تحليل الإيرادات والنمو الشهري"}
                        </h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {dateRange === "today"
                            ? "منحنى نمو تدفق المبيعات اليومي لأيام الأسبوع الحالي (ر.س)"
                            : dateRange === "week"
                            ? "منحنى نمو تدفق المبيعات الأسبوعي للأسابيع المقارنة (ر.س)"
                            : "منحنى نمو تدفق المبيعات للأشهر الستة الأخيرة (ر.س)"}
                        </p>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">إيرادات نشطة</span>
                    </div>

                    {/* Recharts Area Chart */}
                    <div className="w-full h-[280px] pt-2" style={{ direction: "ltr" }}>
                      {isMounted ? (
                        hasRevenueTrendData ? (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart
                              data={data.monthlyData || []}
                              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="rechartsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.65} />
                              <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 9, fontWeight: "bold", angle: -25, textAnchor: "end" }}
                                interval={0}
                                height={50}
                                tickMargin={8}
                                padding={{ left: 40, right: 20 }}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }}
                                tickFormatter={(v) => (v === 0 ? "" : v.toLocaleString("en-US"))}
                                width={55}
                                orientation="left"
                              />
                              <RechartsTooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const item = payload[0].payload;
                                    return (
                                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs font-bold space-y-1 text-right dir-rtl">
                                        <p className="text-gray-400">{item.month}</p>
                                        <p className="text-white">
                                          الإيرادات: <span className="text-emerald-400">{item.amount.toLocaleString()} ر.س</span>
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="amount"
                                stroke="#10b981"
                                strokeWidth={3.5}
                                fillOpacity={1}
                                fill="url(#rechartsAreaGrad)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <NoDataState />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>
                  </div>

                  {/* Platform Share Card */}
                  <div className="border border-gray-100 rounded-2xl p-5 flex flex-col justify-between bg-white shadow-sm space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">توزيع الحصص السوقية للمنصات</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">نسبة المساهمة لقنوات الحجوزات</p>
                    </div>

                    {/* Recharts Pie Chart with Centered Title */}
                    <div className="w-full h-[180px] relative flex items-center justify-center" style={{ direction: "ltr" }}>
                      {isMounted && hasPlatformShareData && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0" style={{ direction: "rtl" }}>
                          <span className="text-[10px] font-black text-gray-400">القنوات</span>
                          <span className="text-sm font-black text-slate-800 mt-0.5">حصة السوق</span>
                        </div>
                      )}

                      {isMounted ? (
                        hasPlatformShareData ? (() => {
                          const platformShareData = [
                            {
                              name: "Airbnb Global",
                              value: data.platformShare.airbnb.percent,
                              raw: data.platformShare.airbnb.value,
                              color: "#fd385b"
                            },
                            {
                              name: "Gathern Local",
                              value: data.platformShare.gathern.percent,
                              raw: data.platformShare.gathern.value,
                              color: "#8b5cf6"
                            },
                            {
                              name: "حجز خارجي",
                              value: data.platformShare.external?.percent || 0,
                              raw: data.platformShare.external?.value || "0 ر.س",
                              color: "#22c55e"
                            },
                          ].filter(item => item.value > 0);

                          return (
                            <>
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                  <Pie
                                    data={platformShareData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={52}
                                    outerRadius={70}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {platformShareData.map((entry, idx) => (
                                      <Cell key={`cell-${idx}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip
                                    cursor={false}
                                    wrapperStyle={{ zIndex: 100 }}
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        const entry = payload[0];
                                        return (
                                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs font-bold text-right dir-rtl min-w-[150px] space-y-1.5">
                                            <p className="font-black text-sm" style={{ color: entry.payload.color }}>
                                              {entry.name}
                                            </p>
                                            <p className="text-gray-300 text-[11px] leading-tight">
                                              الحصة: <span className="text-white font-extrabold">{entry.value}%</span>
                                            </p>
                                            <p className="text-gray-400 text-[10px] leading-tight">
                                              القيمة: {entry.payload.raw}
                                            </p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </>
                          );
                        })() : (
                          <NoDataState />
                        )
                      ) : (
                        <div className="w-28 h-28 rounded-full border-4 border-gray-100 border-t-blue-500 animate-spin" />
                      )}
                    </div>

                    {/* Premium Grid Legend Details */}
                    <div className="grid grid-cols-3 gap-2 pt-2">
                      <div 
                        style={{ backgroundColor: "rgba(253, 56, 91, 0.05)", borderColor: "rgba(253, 56, 91, 0.15)" }} 
                        className="border rounded-xl p-2.5 text-center transition-all hover:bg-[rgba(253,56,91,0.08)] flex flex-col justify-between min-h-[105px]"
                      >
                        <div className="flex items-center justify-center h-8 mb-1">
                          <img src="/images/platforms/airbnb.svg" className="h-7 object-contain" alt="Airbnb" />
                        </div>
                        <p style={{ color: "#fd385b" }} className="text-base font-black leading-none">{data.platformShare.airbnb.percent}%</p>
                        <span className="text-[10px] font-bold text-gray-500 mt-1 block">{data.platformShare.airbnb.value}</span>
                      </div>

                      <div 
                        style={{ backgroundColor: "rgba(139, 92, 246, 0.05)", borderColor: "rgba(139, 92, 246, 0.15)" }} 
                        className="border rounded-xl p-2.5 text-center transition-all hover:bg-[rgba(139,92,246,0.08)] flex flex-col justify-between min-h-[105px]"
                      >
                        <div className="flex items-center justify-center h-8 mb-1">
                          <img src="/images/platforms/gathern.svg" className="h-6 object-contain" alt="Gathern" />
                        </div>
                        <p style={{ color: "#8b5cf6" }} className="text-base font-black leading-none">{data.platformShare.gathern.percent}%</p>
                        <span className="text-[10px] font-bold text-gray-500 mt-1 block">{data.platformShare.gathern.value}</span>
                      </div>

                      <div className="bg-emerald-50/30 border border-emerald-100/50 rounded-xl p-2.5 text-center transition-all hover:bg-emerald-50/60 flex flex-col justify-between min-h-[105px]">
                        <div className="flex items-center justify-center h-8 mb-1">
                          <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-700">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>حجز خارجي</span>
                          </span>
                        </div>
                        <p className="text-base font-black text-emerald-600 leading-none">{data.platformShare.external?.percent || 0}%</p>
                        <span className="text-[10px] font-bold text-gray-500 mt-1 block">{data.platformShare.external?.value || "0 ر.س"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Second Row of Charts/Summaries */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Top Performing Units Card */}
                  <div className="lg:col-span-2 border border-gray-100 rounded-2xl p-5 flex flex-col justify-between bg-white shadow-sm space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">أعلى الوحدات أداءً (حسب الإيراد المحقق)</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">أفضل 5 وحدات عقارية تحقيقاً للتدفقات المالية للفترة المحددة</p>
                    </div>

                    <div className="w-full h-[220px]" style={{ direction: "ltr" }}>
                      {isMounted ? (
                        hasProfitabilityData ? (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart
                              data={(data.profitability || []).slice(0, 5).map((u: any) => ({
                                name: u.name,
                                revenue: parseFloat(u.revenue.replace(/,/g, "")),
                              }))}
                              layout="vertical"
                              margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                            >
                              <XAxis type="number" tickFormatter={(v) => (v === 0 ? "" : `${v.toLocaleString()} ر.س`)} />
                              <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#475569", fontSize: 10, fontWeight: "bold" }}
                                width={75}
                                tickMargin={8}
                                orientation="left"
                              />
                              <RechartsTooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const entry = payload[0];
                                    return (
                                      <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md border border-slate-800 text-[11px] font-bold text-right dir-rtl">
                                        <p className="font-bold text-gray-400">{entry.payload.name}</p>
                                        <p className="mt-0.5 text-white">
                                          الإيرادات: <span className="text-emerald-400">{Number(entry.value || 0).toLocaleString()} ر.س</span>
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <NoDataState />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>
                  </div>

                  {/* Operational Summary Quick Card */}
                  <div className="border border-gray-100 rounded-2xl p-5 flex flex-col justify-between bg-white shadow-sm space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">نظرة عامة على العمليات الحية</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">ملخص الحالة التشغيلية الفورية وأعمال الصيانة (اضغط للتفاصيل)</p>
                    </div>

                    <div className="space-y-3.5 my-auto">
                      <div
                        onClick={() => {
                          router.push("/analytics?tab=live_ops");
                          setActiveTab("live_ops");
                          setLiveOpsFilter("ready");
                        }}
                        className="flex items-center justify-between p-3 bg-blue-50/40 rounded-xl border border-blue-100/50 cursor-pointer hover:bg-blue-50/80 hover:border-blue-200 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          <span className="text-xs font-bold text-gray-600">شقق جاهزة وشاغرة</span>
                        </div>
                        <span className="text-sm font-black text-blue-700">
                          {(data.liveUnits || []).filter((u: any) => u.status === "ready" || u.status === "checkin_today" || u.status === "checkout_today").length} شقة
                        </span>
                      </div>

                      <div
                        onClick={() => {
                          router.push("/analytics?tab=live_ops");
                          setActiveTab("live_ops");
                          setLiveOpsFilter("occupied");
                        }}
                        className="flex items-center justify-between p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/50 cursor-pointer hover:bg-emerald-50/80 hover:border-emerald-200 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <span className="text-xs font-bold text-gray-600">شقق مأهولة بالنزلاء</span>
                        </div>
                        <span className="text-sm font-black text-emerald-700">
                          {(data.liveUnits || []).filter((u: any) => u.status === "occupied" || u.status === "booked" || u.status === "guest_not_checked_out").length} شقة
                        </span>
                      </div>

                      <div
                        onClick={() => {
                          router.push("/analytics?tab=live_ops");
                          setActiveTab("live_ops");
                          setLiveOpsFilter("cleaning");
                        }}
                        className="flex items-center justify-between p-3 bg-amber-50/40 rounded-xl border border-amber-100/50 cursor-pointer hover:bg-amber-50/80 hover:border-amber-200 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                          <span className="text-xs font-bold text-gray-600">شقق قيد التنظيف والتحضير</span>
                        </div>
                        <span className="text-sm font-black text-amber-700">
                          {(data.liveUnits || []).filter((u: any) => u.status === "awaiting_cleaning" || u.status === "cleaning_in_progress").length} شقة
                        </span>
                      </div>

                      <div
                        onClick={() => {
                          router.push("/analytics?tab=live_ops");
                          setActiveTab("live_ops");
                          setLiveOpsFilter("maintenance");
                        }}
                        className="flex items-center justify-between p-3 bg-rose-50/40 rounded-xl border border-rose-100/50 cursor-pointer hover:bg-rose-50/80 hover:border-rose-200 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                          <span className="text-xs font-bold text-gray-600">أعمال صيانة نشطة</span>
                        </div>
                        <span className="text-sm font-black text-rose-700">
                          {(data.liveUnits || []).filter((u: any) => u.status === "maintenance" || u.activeMaintTickets > 0).length} شقة
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section Title: Advanced Financial and Operational Analytics */}
                <div className="mt-10 mb-6">
                  <h2 className="text-base font-bold text-gray-900">التحليلات المالية والتشغيلية المتقدمة</h2>
                  <p className="text-xs text-gray-500 mt-0.5">مقارنات التدفقات النقدية الشهرية، تذبذب المواسم، الصيانة، ومستويات تحصيل الفواتير</p>
                </div>

                {/* Advanced Analytics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart 1: Cashflow (Income vs Expenses) */}
                  <div className="border border-gray-100 rounded-2xl p-5 flex flex-col bg-white shadow-sm space-y-4 justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        {dateRange === "today"
                          ? "مقارنة التدفق النقدي يومياً (الإيرادات مقابل المصروفات)"
                          : dateRange === "week"
                          ? "مقارنة التدفق النقدي أسبوعياً (الإيرادات مقابل المصروفات)"
                          : "مقارنة التدفق النقدي شهرياً (الإيرادات مقابل المصروفات)"}
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {dateRange === "today"
                          ? "تحليل الإيرادات اليومية مقابل المصاريف الكلية والرواتب والصيانة (ر.س)"
                          : dateRange === "week"
                          ? "تحليل الإيرادات الأسبوعية مقابل المصاريف الكلية والرواتب والصيانة (ر.س)"
                          : "تحليل الإيرادات المحققة مقابل المصاريف الكلية والرواتب والصيانة (ر.س)"}
                      </p>
                    </div>
                    <div className="w-full h-[280px]" style={{ direction: "ltr" }}>
                      {isMounted ? (
                        hasCashFlowData ? (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart
                              data={data.monthlyData || []}
                              margin={{ top: 15, right: 10, left: 10, bottom: 0 }}
                              barGap={6}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.65} />
                              <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 9, fontWeight: "bold", angle: -25, textAnchor: "end" }}
                                interval={0}
                                height={50}
                                tickMargin={8}
                                padding={{ left: 40, right: 20 }}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }}
                                tickFormatter={(v) => (v === 0 ? "" : v.toLocaleString("en-US"))}
                                width={55}
                              />
                              <RechartsTooltip
                                cursor={{ fill: "#f8fafc", opacity: 0.5 }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const item = payload[0].payload;
                                    return (
                                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs font-bold space-y-1 text-right dir-rtl">
                                        <p className="text-gray-400">{item.month}</p>
                                        <p className="text-emerald-400">
                                          الأساسي / الإيرادات: {Number(item.amount || 0).toLocaleString()} ر.س
                                        </p>
                                        <p className="text-rose-400">
                                          المصروفات: {Number(item.expenses || 0).toLocaleString()} ر.س
                                        </p>
                                        <p className="text-blue-400 border-t border-slate-700/50 pt-1 mt-1">
                                          صافي الربح: {Math.max(0, Number(item.amount || 0) - Number(item.expenses || 0)).toLocaleString()} ر.س
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend verticalAlign="bottom" height={36} iconType="circle" />
                              <Bar name="إجمالي الإيرادات" dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} barSize={14} />
                              <Bar name="إجمالي المصروفات" dataKey="expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} barSize={14} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <NoDataState />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>
                  </div>

                  {/* Chart 2: Occupancy Rate Seasonality */}
                  <div className="border border-gray-100 rounded-2xl p-5 flex flex-col bg-white shadow-sm space-y-4 justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        {dateRange === "today"
                          ? "منحنى مواسم نسب الإشغال اليومي"
                          : dateRange === "week"
                          ? "منحنى مواسم نسب الإشغال الأسبوعي"
                          : "منحنى مواسم نسب الإشغال الشهري"}
                      </h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {dateRange === "today"
                          ? "تحليل تقلبات نسب الإشغال اليومية على مدار الأسبوع الحالي (%)"
                          : dateRange === "week"
                          ? "تحليل تقلبات نسب الإشغال الأسبوعية للأسابيع المقارنة (%)"
                          : "تحليل تقلبات نسب الإشغال على مدار أشهر السنة لتحديد فترات الذروة (%)"}
                      </p>
                    </div>
                    <div className="w-full h-[280px]" style={{ direction: "ltr" }}>
                      {isMounted ? (
                        hasOccupancyData ? (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <AreaChart
                              data={data.monthlyData || []}
                              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="occupancyGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.65} />
                              <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 9, fontWeight: "bold", angle: -25, textAnchor: "end" }}
                                interval={0}
                                height={50}
                                tickMargin={8}
                                padding={{ left: 40, right: 20 }}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }}
                                tickFormatter={(v) => (v === 0 ? "" : `${v}%`)}
                                width={40}
                              />
                              <RechartsTooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const item = payload[0].payload;
                                    return (
                                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs font-bold space-y-1 text-right dir-rtl">
                                        <p className="text-gray-400">{item.month}</p>
                                        <p className="text-purple-400">
                                          نسبة الإشغال: {item.occupancy || 0}%
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="occupancy"
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#occupancyGrad)"
                                dot={{ r: 3.5, strokeWidth: 1.5, stroke: "#8b5cf6", fill: "#ffffff" }}
                                activeDot={{ r: 6, strokeWidth: 0, fill: "#8b5cf6" }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <NoDataState />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>
                    <div className="flex justify-center mt-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 rounded-full text-[10px] font-bold text-purple-700 border border-purple-100/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        % تذبذب الطلب الموسمي للوحدات النشطة
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3-Column Grid for Maintenance & Invoices */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                  {/* Card 1: Maintenance Status Distribution (Donut) */}
                  <div className="border border-gray-100 rounded-2xl p-5 flex flex-col bg-white shadow-sm justify-between min-h-[360px]">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">توزيع تذاكر الصيانة حسب الحالة</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">نسب ومقادير تذاكر الأعطال القائمة والمكتملة</p>
                    </div>
                    <div className="w-full h-[180px] relative flex items-center justify-center mt-2" style={{ direction: "ltr" }}>
                      {isMounted && hasMaintenanceStatusData && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0" style={{ direction: "rtl" }}>
                          <span className="text-[9px] font-bold text-gray-400">الإجمالي</span>
                          <span className="text-xs font-black text-slate-800 mt-0.5">
                            {(data.maintenanceAnalytics?.statusDist || []).reduce((acc: number, r: any) => acc + r.count, 0)} تذكرة
                          </span>
                        </div>
                      )}
                      {isMounted ? (
                        hasMaintenanceStatusData ? (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                              <Pie
                                data={data.maintenanceAnalytics?.statusDist || []}
                                cx="50%"
                                cy="50%"
                                innerRadius={47}
                                outerRadius={65}
                                paddingAngle={3}
                                dataKey="count"
                              >
                                {(data.maintenanceAnalytics?.statusDist || []).map((entry: any, index: number) => {
                                  const statusColors: Record<string, string> = {
                                    "محلولة": "#10b981",       // Green
                                    "قيد المعالجة": "#f59e0b",  // Amber
                                    "مفتوحة": "#ef4444"         // Red
                                  };
                                  const color = statusColors[entry.status] || "#64748b";
                                  return <Cell key={`cell-${index}`} fill={color} />;
                                })}
                              </Pie>
                              <RechartsTooltip
                                cursor={false}
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const entry = payload[0];
                                    return (
                                      <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-md border border-slate-800 text-xs font-bold text-right dir-rtl">
                                        <p className="font-bold text-gray-300">{entry.payload.status}</p>
                                        <p className="mt-0.5 text-white">العدد: {entry.value}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <NoDataState />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>
                    {/* Status Badges Grid */}
                    <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                      <div className="bg-emerald-50/40 border border-emerald-100/50 rounded-xl p-2 flex flex-col items-center justify-between">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          محلولة
                        </span>
                        <span className="text-xs font-black text-emerald-800 mt-1">
                          {(data.maintenanceAnalytics?.statusDist || []).find((r: any) => r.status === "محلولة")?.count || 0}
                        </span>
                      </div>
                      <div className="bg-amber-50/40 border border-amber-100/50 rounded-xl p-2 flex flex-col items-center justify-between">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          جاري العمل
                        </span>
                        <span className="text-xs font-black text-amber-800 mt-1">
                          {(data.maintenanceAnalytics?.statusDist || []).find((r: any) => r.status === "قيد المعالجة")?.count || 0}
                        </span>
                      </div>
                      <div className="bg-rose-50/40 border border-rose-100/50 rounded-xl p-2 flex flex-col items-center justify-between">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          جديدة
                        </span>
                        <span className="text-xs font-black text-rose-800 mt-1">
                          {(data.maintenanceAnalytics?.statusDist || []).find((r: any) => r.status === "مفتوحة")?.count || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Top Units Maintenance Horizontal Bar */}
                  <div className="border border-gray-100 rounded-2xl p-5 flex flex-col bg-white shadow-sm justify-between min-h-[360px]">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">أعلى الوحدات طلباً للصيانة</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">الشقق الأكثر تسجيلاً للأعطال والطلبات</p>
                    </div>
                    <div className="w-full h-[240px] mt-2" style={{ direction: "ltr" }}>
                      {isMounted ? (
                        hasMaintenanceTopUnitsData ? (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart
                              data={data.maintenanceAnalytics?.topUnits || []}
                              layout="vertical"
                              margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} stroke="#e2e8f0" strokeOpacity={0.65} />
                              <XAxis type="number" hide />
                              <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#475569", fontSize: 10, fontWeight: "bold" }}
                                width={75}
                                tickMargin={8}
                                orientation="right"
                              />
                              <RechartsTooltip
                                cursor={{ fill: "#f8fafc", opacity: 0.5 }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const entry = payload[0];
                                    return (
                                      <div className="bg-slate-900 text-white p-2 rounded-xl shadow-md border border-slate-800 text-[10px] font-bold text-right dir-rtl">
                                        <p className="text-gray-400">{entry.payload.name}</p>
                                        <p className="text-white">التذاكر: {entry.value}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                                {(data.maintenanceAnalytics?.topUnits || []).map((entry: any, index: number) => {
                                  let color = "#10b981"; // Green for low tickets (2 or fewer)
                                  if (entry.count >= 5) color = "#ef4444";      // Red for high tickets (5 or more)
                                  else if (entry.count >= 3) color = "#f59e0b"; // Amber/Orange for medium tickets (3 or 4)
                                  return <Cell key={`cell-${index}`} fill={color} />;
                                })}
                                <LabelList dataKey="count" position="right" style={{ fill: "#475569", fontSize: 10, fontWeight: "bold" }} offset={8} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <NoDataState />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>
                  </div>

                  {/* Card 3: Invoice Status & Collection Rates */}
                  <div className="border border-gray-100 rounded-2xl p-5 flex flex-col bg-white shadow-sm justify-between min-h-[360px]">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">تحليل الفواتير ومعدلات التحصيل</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">حالة المبالغ المالية للفواتير المحاسبية المعتمدة</p>
                    </div>
                    <div className="w-full h-[240px] mt-2" style={{ direction: "ltr" }}>
                      {isMounted ? (
                        hasInvoiceData ? (
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <BarChart
                              data={data.invoiceAnalytics || []}
                              margin={{ top: 25, right: 10, left: 5, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.65} />
                              <XAxis
                                dataKey="state"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }}
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: "#64748b", fontSize: 10, fontWeight: "bold" }}
                                tickFormatter={(v) => (v === 0 ? "" : `${v.toLocaleString("en-US")} ر.س`)}
                                width={75}
                              />
                              <RechartsTooltip
                                cursor={{ fill: "#f8fafc", opacity: 0.5 }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const item = payload[0].payload;
                                    return (
                                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs font-bold space-y-1 text-right dir-rtl">
                                        <p className="text-gray-400">{item.state}</p>
                                        <p className="text-emerald-400">
                                          إجمالي القيمة: {Number(item.total || 0).toLocaleString()} ر.س
                                        </p>
                                        <p className="text-blue-400">
                                          عدد الفواتير: {item.count}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar name="إجمالي الفواتير" dataKey="total" radius={[6, 6, 0, 0]} barSize={24}>
                                {(data.invoiceAnalytics || []).map((entry: any, index: number) => {
                                  const invoiceColors: Record<string, string> = {
                                    "مؤكدة": "#3b82f6",  // Blue (Confirmed/Awaiting payment)
                                    "ملغاة": "#ef4444",  // Red (Cancelled)
                                    "مدفوعة": "#10b981",  // Green (Paid)
                                    "مسودة": "#64748b",  // Gray/Slate (Draft)
                                    "مرحلة": "#8b5cf6"   // Purple (Posted)
                                  };
                                  return <Cell key={`cell-${index}`} fill={invoiceColors[entry.state] || "#4f46e5"} />;
                                })}
                                <LabelList
                                  dataKey="total"
                                  position="top"
                                  formatter={(v: any) => Number(v) > 0 ? `${Number(v).toLocaleString("en-US")} ر.س` : ""}
                                  style={{ fill: "#475569", fontSize: 9, fontWeight: "bold" }}
                                  offset={6}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <NoDataState />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "live_ops" && (
              <div className="space-y-8 animate-fadeIn">
                {/* Tab Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">الحالة التشغيلية المباشرة للوحدات</h2>
                    <p className="text-xs text-gray-500 mt-0.5">مراقبة لحظية لحجوزات اليوم والوحدات الجاهزة وعمليات الصيانة القائمة</p>
                  </div>
                  {liveOpsFilter !== "all" && (
                    <button
                      onClick={() => setLiveOpsFilter("all")}
                      className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-100 transition-all self-start sm:self-auto flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>عرض جميع الشقق</span>
                    </button>
                  )}
                </div>

                {/* Operations KPI Grid (3x2 layout) */}
                {(() => {
                  const totalUnits = data.liveUnits?.length || 0;
                  const occupiedUnits = (data.liveUnits || []).filter((u: any) => u.status === "occupied" || u.status === "booked" || u.status === "guest_not_checked_out").length;
                  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
                  const readyUnits = (data.liveUnits || []).filter((u: any) => u.status === "ready" || u.status === "checkin_today" || u.status === "checkout_today").length;
                  const cleaningUnits = (data.liveUnits || []).filter((u: any) => u.status === "awaiting_cleaning" || u.status === "cleaning_in_progress").length;
                  const maintUnits = (data.liveUnits || []).filter((u: any) => u.status === "maintenance" || u.activeMaintTickets > 0).length;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Card 1: Total Units */}
                      <div
                        onClick={() => setLiveOpsFilter("all")}
                        className={`bg-gradient-to-br from-slate-50/50 to-slate-50/10 border rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${liveOpsFilter === "all" ? "border-slate-400 ring-2 ring-slate-500/20 bg-slate-50/80" : "border-slate-100/70"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">إجمالي الوحدات النشطة</span>
                          <div className="p-2 bg-slate-500 text-white rounded-xl">
                            <Building2 className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-gray-900">{totalUnits} شقة</p>
                          <div className="text-[10px] text-gray-400 font-bold">
                            <span>اضغط هنا لعرض كافة الشقق</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Occupied Units */}
                      <div
                        onClick={() => setLiveOpsFilter("occupied")}
                        className={`bg-gradient-to-br from-emerald-50/50 to-emerald-50/10 border rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${liveOpsFilter === "occupied" ? "border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/80" : "border-emerald-100/40"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">الشقق المأهولة (شغالة)</span>
                          <div className="p-2 bg-emerald-500 text-white rounded-xl">
                            <Users className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-gray-900">{occupiedUnits} شقة</p>
                          <div className="text-[10px] text-emerald-600 font-bold">
                            <span>تصفية بحسب الشقق المسكونة</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Occupancy Rate */}
                      <div
                        onClick={() => setLiveOpsFilter("occupied")}
                        className={`bg-gradient-to-br from-teal-50/50 to-teal-50/10 border rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${liveOpsFilter === "occupied" ? "border-teal-400 ring-2 ring-teal-500/20 bg-teal-50/80" : "border-teal-100/40"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">نسبة الإشغال اللحظي</span>
                          <div className="p-2 bg-teal-500 text-white rounded-xl">
                            <Percent className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-gray-900">{occupancyRate}%</p>
                          <div className="text-[10px] text-teal-600 font-bold">
                            <span>معدل التشغيل الفوري للوحدات</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 4: Vacant & Ready */}
                      <div
                        onClick={() => setLiveOpsFilter("ready")}
                        className={`bg-gradient-to-br from-blue-50/50 to-blue-50/10 border rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${liveOpsFilter === "ready" ? "border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/80" : "border-blue-100/40"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">شاغر وجاهز</span>
                          <div className="p-2 bg-blue-500 text-white rounded-xl">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-gray-900">{readyUnits} شقة</p>
                          <div className="text-[10px] text-blue-600 font-bold">
                            <span>تصفية بالشقق النظيفة الجاهزة</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 5: Cleaning */}
                      <div
                        onClick={() => setLiveOpsFilter("cleaning")}
                        className={`bg-gradient-to-br from-amber-50/50 to-amber-50/10 border rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${liveOpsFilter === "cleaning" ? "border-amber-400 ring-2 ring-amber-500/20 bg-amber-50/80" : "border-amber-100/40"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">تحت التنظيف والتحضير</span>
                          <div className="p-2 bg-amber-500 text-white rounded-xl">
                            <RefreshCw className="w-4 h-4 animate-spin-slow" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-gray-900">{cleaningUnits} شقة</p>
                          <div className="text-[10px] text-amber-600 font-bold">
                            <span>تصفية بحسب شقق التدبير المنزلي</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 6: Maintenance */}
                      <div
                        onClick={() => setLiveOpsFilter("maintenance")}
                        className={`bg-gradient-to-br from-rose-50/50 to-rose-50/10 border rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 ${liveOpsFilter === "maintenance" ? "border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/80" : "border-rose-100/40"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-500">يوجد بها أعطال تحتاج صيانة</span>
                          <div className="p-2 bg-rose-500 text-white rounded-xl">
                            <Wrench className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-2xl font-black text-gray-900">{maintUnits} شقة</p>
                          <div className="text-[10px] text-rose-600 font-bold">
                            <span>تصفية بالشقق التي بها بلاغات صيانة</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Active Operational Grid */}
                {(() => {
                  const STATUS_CONFIG = {
                    checkout_today: {
                      label: "خروج اليوم",
                      color: "text-orange-600 border-orange-200 bg-orange-50/50",
                      badge: "bg-orange-50 text-orange-700 border-orange-200",
                      border: "border-r-orange-500",
                      icon: "📤",
                    },
                    checkin_today: {
                      label: "دخول اليوم",
                      color: "text-blue-600 border-blue-200 bg-blue-50/50",
                      badge: "bg-blue-50 text-blue-700 border-blue-200",
                      border: "border-r-blue-500",
                      icon: "📥",
                    },
                    guest_not_checked_out: {
                      label: "الضيف لم يخرج",
                      color: "text-red-600 border-red-200 bg-red-50/50",
                      badge: "bg-red-50 text-red-700 border-red-200",
                      border: "border-r-red-500",
                      icon: "⚠️",
                    },
                    awaiting_cleaning: {
                      label: "في انتظار التنظيف",
                      color: "text-amber-600 border-amber-200 bg-amber-50/50",
                      badge: "bg-amber-50 text-amber-700 border-amber-200",
                      border: "border-r-amber-500",
                      icon: "⏳",
                    },
                    cleaning_in_progress: {
                      label: "قيد التنظيف",
                      color: "text-purple-600 border-purple-200 bg-purple-50/50",
                      badge: "bg-purple-50 text-purple-700 border-purple-200",
                      border: "border-r-purple-500",
                      icon: "🧹",
                    },
                    ready: {
                      label: "جاهزة للتسكين",
                      color: "text-emerald-600 border-emerald-200 bg-emerald-50/50",
                      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      border: "border-r-emerald-500",
                      icon: "✅",
                    },
                    occupied: {
                      label: "تم التسكين",
                      color: "text-indigo-600 border-indigo-200 bg-indigo-50/50",
                      badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
                      border: "border-r-indigo-500",
                      icon: "🏠",
                    },
                    booked: {
                      label: "إشغال",
                      color: "text-sky-600 border-sky-200 bg-sky-50/50",
                      badge: "bg-sky-50 text-sky-700 border-sky-200",
                      border: "border-r-sky-500",
                      icon: "📅",
                    },
                    maintenance: {
                      label: "تحت الصيانة",
                      color: "text-rose-600 border-rose-200 bg-rose-50/50",
                      badge: "bg-rose-50 text-rose-700 border-rose-200",
                      border: "border-r-rose-500",
                      icon: "🔧",
                    },
                  };

                  const filteredUnits = (data.liveUnits || []).filter((unit: any) => {
                    if (liveOpsFilter === "all") return true;
                    if (liveOpsFilter === "occupied") return unit.status === "occupied" || unit.status === "booked" || unit.status === "guest_not_checked_out";
                    if (liveOpsFilter === "ready") return unit.status === "ready" || unit.status === "checkin_today" || unit.status === "checkout_today";
                    if (liveOpsFilter === "cleaning") return unit.status === "awaiting_cleaning" || unit.status === "cleaning_in_progress";
                    if (liveOpsFilter === "maintenance") return unit.status === "maintenance" || unit.activeMaintTickets > 0;
                    return true;
                  });

                  return (
                    <div className="space-y-6">
                      {/* Section Title with Divider */}
                      <div className="border-t border-gray-100 pt-6 mt-8 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-gray-800">
                            {liveOpsFilter === "all" ? "جميع الوحدات العقارية" :
                              liveOpsFilter === "occupied" ? "الوحدات المأهولة حالياً" :
                                liveOpsFilter === "ready" ? "الوحدات الشاغرة والجاهزة" :
                                  liveOpsFilter === "cleaning" ? "الوحدات قيد التنظيف والتحضير" :
                                    "وحدات بها أعطال تحتاج صيانة"}
                          </h3>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            عرض تفصيلي للوحدات المطابقة للحالة المحددة أعلاه
                          </p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 bg-gray-50 border border-gray-150 rounded-lg text-gray-500">
                          {filteredUnits.length} وحدة
                        </span>
                      </div>

                      {filteredUnits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50/30 rounded-2xl border border-dashed border-gray-200 p-8">
                          <div className="p-3 bg-white shadow-sm border border-gray-100 rounded-full mb-3 text-gray-400">
                            <Building2 className="w-6 h-6" />
                          </div>
                          <p className="text-sm font-bold text-gray-700">لا توجد شقق في هذه الحالة حالياً</p>
                          <p className="text-xs text-gray-400 mt-1">المحفظة المحددة لا تحتوي على أي وحدات تنطبق عليها هذه الحالة حالياً.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {filteredUnits.map((unit: any, idx: number) => {
                            const config = STATUS_CONFIG[unit.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.ready;
                            const platforms = unit.platforms || [];

                            return (
                              <div key={idx} className={`bg-white border border-gray-150 border-r-4 rounded-2xl p-5 flex flex-col justify-between min-h-[220px] transition-all hover:shadow-md hover:scale-[1.01] duration-205 ${config.border}`}>
                                {/* Header: Title, Code, Status & Platform */}
                                <div className="space-y-1.5">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                                        {unit.title}
                                        {unit.unitCode && (
                                          <span className="text-[10px] font-mono text-gray-400">({unit.unitCode})</span>
                                        )}
                                      </h4>
                                    </div>

                                    {/* Platform Badges */}
                                    <div className="flex gap-1">
                                      {platforms.length > 0 ? (
                                        platforms.map((p: string, pIdx: number) => {
                                          const isAirbnb = p === "airbnb";
                                          const isGathern = p === "gathern";
                                          return (
                                            <span key={pIdx} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize ${
                                              isAirbnb ? "bg-red-50 text-red-600 border-red-100" :
                                              isGathern ? "bg-orange-50 text-orange-600 border-orange-100" :
                                              "bg-slate-50 text-slate-600 border-slate-100"
                                            }`}>
                                              {isAirbnb ? "Airbnb" : isGathern ? "Gathern" : p}
                                            </span>
                                          );
                                        })
                                      ) : (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-100">
                                          مباشر
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Status Pill */}
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${config.badge}`}>
                                      <span>{config.icon}</span>
                                      <span>{config.label}</span>
                                    </span>

                                    {/* Special Today Indicators */}
                                    <div className="flex gap-1">
                                      {unit._has_checkin_today && (
                                        <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5" title="دخول اليوم">
                                          📥 دخول
                                        </span>
                                      )}
                                      {unit._has_checkout_today && (
                                        <span className="bg-orange-600 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5" title="خروج اليوم">
                                          📤 خروج
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Body 1: Operational Status (Guest & Dates) */}
                                <div className="my-4 py-3 border-y border-gray-100/70 space-y-2.5">
                                  {(unit.guest || unit.checkinDate || unit.checkoutDate) ? (
                                    <div className="space-y-2">
                                      {unit.guest ? (
                                        <div className="flex items-center gap-2 text-xs text-gray-650">
                                          <User className="w-3.5 h-3.5 text-gray-400" />
                                          <span>العميل: <span className="font-bold text-gray-800">{unit.guest}</span></span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 text-xs text-gray-450 italic">
                                          <User className="w-3.5 h-3.5 text-gray-300" />
                                          <span>العميل: <span className="text-gray-400">-- لا يوجد ضيف --</span></span>
                                        </div>
                                      )}

                                      <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                                        {unit.checkinDate && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-gray-400">دخول:</span>
                                            <span className="font-semibold text-gray-700">{unit.checkinDate}</span>
                                          </div>
                                        )}
                                        {unit.checkoutDate && (
                                          <div className="flex items-center gap-1">
                                            <span className="text-gray-400">خروج:</span>
                                            <span className="font-semibold text-gray-700">{unit.checkoutDate}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400 py-1.5 italic flex items-center gap-1.5 justify-center bg-gray-50/50 rounded-lg border border-dashed border-gray-150">
                                      <CheckCircle className="w-3.5 h-3.5 text-teal-500" />
                                      <span>الوحدة جاهزة ولا توجد حجوزات نشطة اليوم</span>
                                    </div>
                                  )}

                                  {/* Notes (if any) */}
                                  {unit.notes && (
                                    <div className="bg-amber-50/40 border border-amber-100/50 p-2 rounded-lg text-[10px] text-amber-800 leading-normal flex items-start gap-1">
                                      <AlertTriangle className="w-3 h-3 mt-0.5 text-amber-500 flex-shrink-0" />
                                      <span className="line-clamp-2">{unit.notes}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Body 2: Analytics & Performance Metrics */}
                                <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-gray-450 tracking-wider block">مؤشرات الأداء والتشغيل للشهر الحالي</span>
                                  <div className="grid grid-cols-3 gap-2 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
                                    <div className="text-center space-y-0.5">
                                      <span className="text-[9px] text-gray-400 font-bold block">إجمالي الدخل</span>
                                      <span className="text-[11px] font-black text-gray-800 block">
                                        {unit.revenue > 0 ? `${unit.revenue.toLocaleString()} ر.س` : "0 ر.س"}
                                      </span>
                                    </div>
                                    <div className="text-center space-y-0.5 border-x border-gray-200/60">
                                      <span className="text-[9px] text-gray-400 font-bold block">الحجوزات</span>
                                      <span className="text-[11px] font-black text-gray-800 block">
                                        {unit.bookingsCount} {unit.bookingsCount === 1 ? "حجز" : "حجوزات"}
                                      </span>
                                    </div>
                                    <div className="text-center space-y-0.5">
                                      <span className="text-[9px] text-gray-400 font-bold block">بلاغات صيانة</span>
                                      <span className={`text-[11px] font-black block ${unit.activeMaintTickets > 0 ? "text-rose-600" : "text-gray-800"}`}>
                                        {unit.activeMaintTickets} {unit.activeMaintTickets === 1 ? "عطل" : "أعطال"}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Miniature Occupancy Calendar */}
                                <div className="mt-4 space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-bold">
                                    <span>مخطط إشغال الشهر الحالي</span>
                                    <span className="text-gray-500 font-medium">
                                      {(() => {
                                        const months = [
                                          "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                                          "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
                                        ];
                                        const cDate = new Date();
                                        return `${months[cDate.getMonth()]} ${cDate.getFullYear()}`;
                                      })()}
                                    </span>
                                  </div>

                                  {/* Calendar Grid */}
                                  <div className="border border-gray-100 rounded-xl p-2 bg-slate-50/30" dir="rtl">
                                    {/* Weekdays header */}
                                    <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-gray-400 mb-1">
                                      {["ح", "ن", "ث", "ر", "خ", "ج", "س"].map((dayName, dIdx) => (
                                        <div key={dIdx} className="h-4 flex items-center justify-center">
                                          {dayName}
                                        </div>
                                      ))}
                                    </div>

                                    {/* Days Grid */}
                                    <div className="grid grid-cols-7 gap-1 text-center">
                                      {(() => {
                                        const cDate = new Date();
                                        const cYear = cDate.getFullYear();
                                        const cMonth = cDate.getMonth();
                                        const todayDay = cDate.getDate();

                                        const firstDayDate = new Date(cYear, cMonth, 1);
                                        const offset = firstDayDate.getDay();

                                        const daysInM = new Date(cYear, cMonth + 1, 0).getDate();
                                        const cells = [];

                                        for (let i = 0; i < offset; i++) {
                                          cells.push(<div key={`empty-${i}`} className="h-5" />);
                                        }

                                        const bDays = new Set(unit.bookedDays || []);
                                        for (let day = 1; day <= daysInM; day++) {
                                          const isBooked = bDays.has(day);
                                          const isToday = day === todayDay;

                                          cells.push(
                                            <div
                                              key={`day-${day}`}
                                              className={`h-5 w-full flex items-center justify-center text-[9px] rounded-md font-bold transition-all ${isBooked
                                                  ? "bg-emerald-500 text-white shadow-[0_1px_3px_rgba(16,185,129,0.3)]"
                                                  : "text-gray-600 hover:bg-slate-100 bg-white border border-gray-100/50"
                                                } ${isToday ? "ring-1 ring-blue-500" : ""}`}
                                              title={isBooked ? "محجوز" : "متاح"}
                                            >
                                              {day}
                                            </div>
                                          );
                                        }

                                        return cells;
                                      })()}
                                    </div>
                                  </div>
                                </div>

                                {/* Card Footer: Quick links & Update Status Button */}
                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
                                  <div className="flex items-center gap-1 text-gray-400">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>
                                      {unit.updatedAt
                                        ? `آخر تحديث: ${new Date(unit.updatedAt).toLocaleTimeString("ar-SA", { hour: '2-digit', minute: '2-digit' })}`
                                        : "حالة تلقائية"}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <a
                                      href={`/dashboard/units/${unit.id}?from=analytics`}
                                      className="px-2.5 py-1 bg-white border border-gray-200 rounded-md hover:bg-gray-50 text-gray-700 font-bold flex items-center gap-0.5 transition-colors text-[11px]"
                                    >
                                      <span>ملف الوحدة</span>
                                      <ArrowUpRight className="w-3 h-3" />
                                    </a>
                                    <UpdateStatusButton
                                      unit={unit}
                                      currentStatus={unit.status || "ready"}
                                      onSuccess={() => handleRefresh(true)}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === "profitability" && (
              <div className="space-y-8 animate-fadeIn">
                {/* Tab Header & Search Input */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">تحليل ربحية الوحدات العقارية</h2>
                    <p className="text-xs text-gray-500 mt-0.5">بيان تفصيلي بصافي الربح ومؤشرات الإشغال ومتوسط السعر اليومي لكل وحدة عقارية</p>
                  </div>

                  {/* Search box inside the tab */}
                  <div className="relative min-w-[280px] self-start md:self-auto">
                    <input
                      type="text"
                      placeholder="ابحث عن وحدة عقارية..."
                      value={profitabilitySearch}
                      onChange={(e) => setProfitabilitySearch(e.target.value)}
                      className="w-full bg-gray-50/50 hover:bg-gray-50 focus:bg-white border border-gray-200 text-gray-800 rounded-xl pr-9 pl-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Advanced Hospitality KPI Summary Cards for Profitability */}
                {(() => {
                  const list = data.profitability || [];
                  if (list.length === 0) return null;

                  // Find top earning unit
                  const topUnit = [...list].sort((a: any, b: any) => b.revenueVal - a.revenueVal)[0];

                  // Calculate average ADR for units with bookings
                  const unitsWithBookings = list.filter((u: any) => u.adrVal > 0);
                  const avgADR = unitsWithBookings.length > 0
                    ? Math.round(unitsWithBookings.reduce((sum: number, u: any) => sum + u.adrVal, 0) / unitsWithBookings.length)
                    : 0;

                  // Calculate average occupancy
                  const avgOccupancy = Math.round(list.reduce((sum: number, u: any) => sum + u.occupancyVal, 0) / list.length);

                  // Total CRM pipeline value across all units
                  const totalCrmPipeline = list.reduce((sum: number, u: any) => sum + (u.crmPipelineVal || 0), 0);
                  const totalCrmWon = list.reduce((sum: number, u: any) => sum + (u.crmRevenueVal || 0), 0);

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                      {/* Top Earning Unit Card */}
                      <div className="bg-gradient-to-br from-indigo-50/40 to-indigo-50/10 border border-indigo-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">الوحدة الأعلى دخلاً</span>
                          <Building2 className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-base font-black text-gray-800">{topUnit ? topUnit.name : "N/A"}</h4>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-indigo-600">{topUnit ? topUnit.revenue : "0 ر.س"}</span>
                            <span className="text-[10px] text-gray-450 font-bold">بمعدل إشغال {topUnit ? topUnit.occupancy : "0%"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Average ADR Card */}
                      <div className="bg-gradient-to-br from-emerald-50/40 to-emerald-50/10 border border-emerald-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">متوسط سعر الليلة (ADR)</span>
                          <DollarSign className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-base font-black text-gray-800">معدل البيع لليوم المأهول</h4>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-emerald-600">{avgADR.toLocaleString()} ر.س</span>
                            <span className="text-[10px] text-gray-450 font-bold">للغرف المحجوزة</span>
                          </div>
                        </div>
                      </div>

                      {/* Average Occupancy Card */}
                      <div className="bg-gradient-to-br from-sky-50/40 to-sky-50/10 border border-sky-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg">متوسط نسبة الإشغال للوحدات</span>
                          <Percent className="w-5 h-5 text-sky-500" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-base font-black text-gray-800">متوسط الأيام المأهولة</h4>
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-sky-600">{avgOccupancy}%</span>
                            <span className="text-[10px] text-gray-450 font-bold">من إجمالي الأيام المتاحة</span>
                          </div>
                        </div>
                      </div>

                      {/* CRM Pipeline Card */}
                      <div className="bg-gradient-to-br from-violet-50/40 to-violet-50/10 border border-violet-100/70 rounded-2xl p-5 space-y-3 relative overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg">إيرادات CRM للوحدات</span>
                          <Briefcase className="w-5 h-5 text-violet-500" />
                        </div>
                        <div className="space-y-0.5">
                          <h4 className="text-base font-black text-gray-800">صفقات مؤكدة + Pipeline</h4>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-lg font-black text-violet-600">{totalCrmWon.toLocaleString("en-US")} ر.س <span className="text-[10px] font-bold text-gray-400">مؤكد</span></span>
                            <span className="text-xs font-bold text-violet-400">{totalCrmPipeline.toLocaleString("en-US")} ر.س توقعات</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Profitability Table */}
                <div className="border border-gray-150 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-600">
                        <tr>
                          {(() => {
                            const renderSortHeader = (field: "name" | "revenue" | "cost" | "profit" | "margin" | "occupancy" | "adr" | "revpar", label: string, isLeft: boolean = false) => {
                              const isActive = profitabilitySortField === field;
                              return (
                                <th
                                  onClick={() => {
                                    if (isActive) {
                                      setProfitabilitySortAsc(!profitabilitySortAsc);
                                    } else {
                                      setProfitabilitySortField(field);
                                      setProfitabilitySortAsc(false); // default DESC
                                    }
                                  }}
                                  className={`px-4 py-4 cursor-pointer hover:bg-gray-100/70 hover:text-gray-900 transition-colors select-none ${isLeft ? "text-left" : "text-right"}`}
                                >
                                  <div className={`flex items-center gap-1.5 ${isLeft ? "justify-start" : "justify-end"}`}>
                                    <span>{label}</span>
                                    <ArrowUpDown className={`w-3.5 h-3.5 ${isActive ? "text-blue-500 font-bold" : "text-gray-405"}`} />
                                  </div>
                                </th>
                              );
                            };
                            return (
                              <>
                                {renderSortHeader("name", "اسم الوحدة")}
                                {renderSortHeader("occupancy", "نسبة الإشغال")}
                                {renderSortHeader("adr", "سعر الليلة (ADR)")}
                                {renderSortHeader("revpar", "العائد المتاح (RevPAR)")}
                                {renderSortHeader("revenue", "إجمالي الإيراد (حجوزات + CRM)")}
                                <th className="px-4 py-4 text-right text-violet-600">CRM صفقات مؤكدة</th>
                                <th className="px-4 py-4 text-right text-violet-400">Pipeline CRM</th>
                                {renderSortHeader("cost", "حصة المستثمر")}
                                {renderSortHeader("profit", "صافي الأرباح (الشركة)")}
                                {renderSortHeader("margin", "هامش الربح", true)}
                              </>
                            );
                          })()}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                        {(() => {
                          const filtered = (data.profitability || [])
                            .filter((row: any) => row.name.toLowerCase().includes(profitabilitySearch.toLowerCase()));

                          const sorted = [...filtered].sort((a: any, b: any) => {
                            let aVal: any = a[profitabilitySortField + (profitabilitySortField === "name" ? "" : "Val")];
                            let bVal: any = b[profitabilitySortField + (profitabilitySortField === "name" ? "" : "Val")];

                            if (typeof aVal === 'string') {
                              aVal = aVal.toLowerCase();
                              bVal = bVal.toLowerCase();
                            }

                            if (aVal < bVal) return profitabilitySortAsc ? -1 : 1;
                            if (aVal > bVal) return profitabilitySortAsc ? 1 : -1;
                            return 0;
                          });

                          if (sorted.length === 0) {
                            return (
                              <tr>
                                <td colSpan={10} className="px-5 py-8 text-center text-gray-400">
                                  لا توجد نتائج مطابقة لبحثك.
                                </td>
                              </tr>
                            );
                          }

                          return sorted.map((row: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-4 font-bold text-gray-900">
                                <div className="flex flex-col gap-0.5">
                                  <span>{row.name}</span>
                                  {row.profitSharePct !== undefined && (
                                    <span className="text-[10px] font-bold text-gray-400">
                                      الشركة {row.profitSharePct}% · المستثمر {row.investorPct || 0}%
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Occupancy Rate Column */}
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2 justify-end">
                                  <span className="text-xs font-bold text-gray-800">{row.occupancy}</span>
                                  <div className="w-12 bg-gray-100 h-1.5 rounded-full overflow-hidden hidden sm:block">
                                    <div
                                      className="bg-sky-500 h-full rounded-full"
                                      style={{ width: row.occupancy }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* ADR & RevPAR Column */}
                              <td className="px-4 py-4 text-gray-700">{row.adr}</td>
                              <td className="px-4 py-4 text-gray-500">{row.revpar}</td>

                              {/* Total Revenue (Bookings + CRM) */}
                              <td className="px-4 py-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-gray-900">{row.revenue}</span>
                                  {(row.bookingRevenueVal > 0 || row.crmRevenueVal > 0) && (
                                    <span className="text-[10px] text-gray-400 font-bold">
                                      حجوزات: {row.bookingRevenue}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* CRM Won Deals */}
                              <td className="px-4 py-4">
                                {(row.crmRevenueVal || 0) > 0 ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-violet-700">{row.crmRevenue}</span>
                                    <span className="text-[10px] text-violet-400 font-bold">{row.crmWonCount || 0} صفقة مؤكدة</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>

                              {/* CRM Pipeline */}
                              <td className="px-4 py-4">
                                {(row.crmPipelineVal || 0) > 0 ? (
                                  <span className="font-semibold text-violet-400">{row.crmPipeline}</span>
                                ) : (
                                  <span className="text-gray-300 text-xs">—</span>
                                )}
                              </td>

                              {/* Investor Payout */}
                              <td className="px-4 py-4 text-rose-600">{row.cost}</td>

                              {/* Net Profit */}
                              <td className="px-4 py-4 text-emerald-600 font-bold">{row.profit}</td>

                              {/* Margin Badge */}
                              <td className="px-4 py-4 text-left">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  row.status === "high" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                                }`}>
                                  {row.margin}
                                </span>
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "crm" && (
              <div className="space-y-8 animate-fadeIn">
                {/* Tab Header */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900">توقعات المبيعات وعلاقات العملاء</h2>
                  <p className="text-xs text-gray-500 mt-0.5">تحليل تدفق صفقات المبيعات النشطة، توزيع الحالات، وتوقعات التحصيل المالي</p>
                </div>

                {/* CRM Advanced KPI Summary Cards */}
                {data?.crmKPIs && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Pipeline Value */}
                    <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="text-[11px] font-bold text-gray-500">قيمة الفرص النشطة</span>
                        <DollarSign className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-lg font-black text-gray-900">{data.crmKPIs.pipelineValue}</h4>
                        <p className="text-[10px] text-blue-600 font-bold">{data.crmKPIs.openCount} صفقات نشطة</p>
                      </div>
                    </div>

                    {/* Won Value */}
                    <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="text-[11px] font-bold text-gray-500">قيمة الصفقات المؤكدة</span>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-lg font-black text-gray-900">{data.crmKPIs.wonValue}</h4>
                        <p className="text-[10px] text-emerald-600 font-bold">{data.crmKPIs.wonCount} صفقات مغلقة ناجحة</p>
                      </div>
                    </div>

                    {/* Average Deal Value */}
                    <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="text-[11px] font-bold text-gray-500">متوسط قيمة الصفقة</span>
                        <Briefcase className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-lg font-black text-gray-900">{data.crmKPIs.avgDealValue}</h4>
                        <p className="text-[10px] text-purple-600 font-bold">لكل عميل محتمل</p>
                      </div>
                    </div>

                    {/* Conversion Rate */}
                    <div className="bg-white border border-gray-150 rounded-2xl p-5 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="text-[11px] font-bold text-gray-500">معدل نجاح الصفقات</span>
                        <Percent className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-lg font-black text-gray-900">{data.crmKPIs.conversionRate}</h4>
                        <p className="text-[10px] text-indigo-600 font-bold">إجمالي العملاء: {data.crmKPIs.totalCustomers}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sales Funnel and Status Distribution Chart Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Pipeline Stages (Col-span 2) */}
                  <div className="lg:col-span-2 border border-gray-150 rounded-2xl p-5 bg-white shadow-sm space-y-4">
                    <h3 className="text-sm font-bold text-gray-900">قمع المبيعات ومراحل الصفقات النشطة (Pipeline Funnel)</h3>

                    {/* Recharts CRM BarChart */}
                    <div className="w-full h-[240px] pt-2" style={{ direction: "ltr" }}>
                      {isMounted ? (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                          <BarChart
                            data={(data.crmPipeline || []).map((item: any) => ({
                              name: item.stage.split(" / ")[0],
                              value: Number(item.rawValue || 0),
                              valueText: item.value,
                              countText: item.count,
                            }))}
                            layout="vertical"
                            margin={{ top: 5, right: 75, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.65} />
                            <XAxis type="number" hide />
                            <YAxis
                              dataKey="name"
                              type="category"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#334155", fontSize: 10, fontWeight: "bold" }}
                              width={140}
                            />
                            <RechartsTooltip
                              cursor={false}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const item = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs font-bold space-y-1 text-right dir-rtl">
                                      <p className="text-gray-400 font-black">{item.name}</p>
                                      <p className="text-white">العدد: {item.countText}</p>
                                      <p className="text-emerald-400">القيمة المتوقعة: {item.valueText}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={16}>
                              {(data.crmPipeline || []).map((_: any, index: number) => {
                                const colors = ["#3b82f6", "#f59e0b", "#10b981", "#6366f1"];
                                return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                              })}
                              <LabelList dataKey="valueText" position="right" style={{ fill: "#475569", fontSize: 10, fontWeight: "bold" }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>
                  </div>

                  {/* Deals Distribution Pie Chart (Col-span 1) */}
                  <div className="border border-gray-150 rounded-2xl p-5 bg-white shadow-sm flex flex-col justify-between space-y-4">
                    <h3 className="text-sm font-bold text-gray-900">توزيع صفقات CRM حسب الحالة</h3>

                    <div className="w-full h-[200px] flex items-center justify-center relative" style={{ direction: "ltr" }}>
                      {isMounted && data?.crmStatusDistribution ? (
                        <>
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                            <PieChart>
                              <Pie
                                data={data.crmStatusDistribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {data.crmStatusDistribution.map((entry: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip
                                wrapperStyle={{ zIndex: 100 }}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const pData = payload[0].payload;
                                    return (
                                      <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs font-bold text-right dir-rtl">
                                        <p className="font-bold">{pData.name}</p>
                                        <p className="text-emerald-400">العدد: {pData.value} صفقة</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0" style={{ direction: "rtl" }}>
                            <span className="text-2xl font-black text-gray-900 leading-none">
                              {data.crmStatusDistribution.reduce((acc: number, item: any) => acc + item.value, 0)}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold mt-1">إجمالي الصفقات</span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-gray-50/50 animate-pulse rounded-xl" />
                      )}
                    </div>

                    {/* Custom Legend */}
                    {data?.crmStatusDistribution && (
                      <div className="flex justify-center gap-4 flex-wrap">
                        {data.crmStatusDistribution.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span>{entry.name} ({entry.value})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed CRM Active Deals List */}
                <div className="border border-gray-150 rounded-2xl bg-white shadow-sm overflow-hidden space-y-4 p-5">
                  <h3 className="text-sm font-bold text-gray-900">أحدث الصفقات والفرص البيعية النشطة</h3>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-600">
                        <tr>
                          <th className="px-5 py-3 text-right">اسم الصفقة</th>
                          <th className="px-5 py-3 text-right">العميل</th>
                          <th className="px-5 py-3 text-right">المبلغ المتوقع</th>
                          <th className="px-5 py-3 text-right">المرحلة الحالية</th>
                          <th className="px-5 py-3 text-right">الأولوية</th>
                          <th className="px-5 py-3 text-left">تاريخ الإغلاق المتوقع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                        {(data.recentDeals || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                              لا توجد صفقات مسجلة حالياً.
                            </td>
                          </tr>
                        ) : (
                          (data.recentDeals || []).map((deal: any, idx: number) => (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-4 font-bold text-gray-900">{deal.title}</td>
                              <td className="px-5 py-4 text-gray-500">{deal.customer}</td>
                              <td className="px-5 py-4 text-gray-900 font-bold">{deal.price}</td>

                              {/* Stage Badge */}
                              <td className="px-5 py-4">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${deal.stage === "completed" || deal.stage === "management" ? "bg-emerald-50 text-emerald-700" :
                                    deal.stage === "partial_payment" ? "bg-amber-50 text-amber-700" :
                                      deal.stage === "negotiation" ? "bg-blue-50 text-blue-700" :
                                        "bg-gray-50 text-gray-600"
                                  }`}>
                                  {deal.status}
                                </span>
                              </td>

                              {/* Priority Badge */}
                              <td className="px-5 py-4">
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${deal.priority === "high" ? "bg-rose-50 text-rose-700" :
                                    deal.priority === "medium" ? "bg-amber-50 text-amber-700" :
                                      "bg-blue-50 text-blue-700"
                                  }`}>
                                  {deal.priority === "high" ? "مرتفعة" : deal.priority === "medium" ? "متوسطة" : "منخفضة"}
                                </span>
                              </td>

                              <td className="px-5 py-4 text-left text-xs text-gray-500 font-semibold">{deal.expectedClose}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hr" && (() => {
              // Interactive state operations
              const filteredEmployees = (data?.employeeAttendance || []).filter((emp: any) => {
                const matchesSearch = emp.name.toLowerCase().includes(hrSearch.toLowerCase()) ||
                                      emp.jobTitle.toLowerCase().includes(hrSearch.toLowerCase());
                const matchesCurrency = hrCurrencyFilter === "all" || emp.currency === hrCurrencyFilter;
                return matchesSearch && matchesCurrency;
              }).sort((a: any, b: any) => {
                if (hrSortField === "net") {
                  const isASAR = a.currency?.toUpperCase() === "SAR";
                  const isBSAR = b.currency?.toUpperCase() === "SAR";
                  
                  if (isASAR && !isBSAR) return -1;
                  if (!isASAR && isBSAR) return 1;
                  
                  const netA = Number(a.net || 0);
                  const netB = Number(b.net || 0);
                  if (netA < netB) return hrSortAsc ? -1 : 1;
                  if (netA > netB) return hrSortAsc ? 1 : -1;
                  return 0;
                }
                let fieldA: any = a[hrSortField];
                let fieldB: any = b[hrSortField];
                if (typeof fieldA === "string") {
                  fieldA = fieldA.toLowerCase();
                  fieldB = fieldB.toLowerCase();
                }
                if (fieldA < fieldB) return hrSortAsc ? -1 : 1;
                if (fieldA > fieldB) return hrSortAsc ? 1 : -1;
                return 0;
              });

              const totalEmployees = filteredEmployees.length;
              const sarEmployees = filteredEmployees.filter((e: any) => e.currency?.toUpperCase() !== "EGP").length;
              const egpEmployees = filteredEmployees.filter((e: any) => e.currency?.toUpperCase() === "EGP").length;

              const sarNetSum = filteredEmployees
                .filter((e: any) => e.currency?.toUpperCase() !== "EGP")
                .reduce((acc: number, cur: any) => acc + Number(cur.net || 0), 0);
              const sarNetFormatted = `${Math.round(sarNetSum).toLocaleString("en-US")} ر.س`;

              const egpNetSum = filteredEmployees
                .filter((e: any) => e.currency?.toUpperCase() === "EGP")
                .reduce((acc: number, cur: any) => acc + Number(cur.net || 0), 0);
              const egpNetFormatted = `${Math.round(egpNetSum).toLocaleString("en-US")} ج.م`;

              const trackedEmployees = filteredEmployees.filter((e: any) => e.attendanceRate !== -1);
              const avgAttendance = trackedEmployees.length > 0 
                ? Math.round(trackedEmployees.reduce((acc: number, cur: any) => acc + cur.attendanceRate, 0) / trackedEmployees.length)
                : -1;

              const filteredEmpNames = new Set(filteredEmployees.map((e: any) => e.name));
              const pendingRequestsCount = (data?.leaveRequests || []).filter((r: any) => 
                r.status === "pending" && filteredEmpNames.has(r.employeeName)
              ).length;

              const dynamicJobTitleStats = (() => {
                const counts: Record<string, number> = {};
                filteredEmployees.forEach((emp: any) => {
                  const title = emp.jobTitle || "غير محدد";
                  counts[title] = (counts[title] || 0) + 1;
                });
                return Object.entries(counts)
                  .map(([name, value]) => ({ name, value }))
                  .sort((a, b) => b.value - a.value);
              })();

              const dynamicAttendanceStats = (() => {
                let present = 0;
                let late = 0;
                let absent = 0;
                let leave = 0;
                filteredEmployees.forEach((emp: any) => {
                  present += Number(emp.presentDays || 0);
                  late += Number(emp.lateDays || 0);
                  absent += Number(emp.absentDays || 0);
                  leave += Number(emp.leaveDays || 0);
                });
                return [
                  { status: "حاضر", count: present },
                  { status: "متأخر", count: late },
                  { status: "غائب", count: absent },
                  { status: "إجازة", count: leave }
                ].filter(item => item.count > 0);
              })();

              const COLORS_PIE = ["#6366f1", "#10b981", "#3b82f6", "#f59e0b", "#06b6d4", "#ec4899", "#8b5cf6", "#14b8a6"];
              const ATT_COLORS: Record<string, string> = {
                "حاضر": "#10b981",
                "متأخر": "#f59e0b",
                "غائب": "#ef4444",
                "إجازة": "#3b82f6",
                "عطلة رسمي": "#64748b",
              };

              return (
                <div className="space-y-8 animate-fadeIn">
                  {/* Tab Header */}
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">ملخص الموارد البشرية ومسيرة الرواتب</h2>
                    <p className="text-xs text-gray-500 mt-0.5">إحصاءات الحضور والانصراف، نسب الالتزام، وتفاصيل الأجور المستحقة للشهر الجاري</p>
                  </div>

                  {/* 4 KPI Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Active Staff */}
                    <div className="border border-gray-150 rounded-2xl p-5 bg-white shadow-sm flex flex-col justify-between min-h-[125px] relative overflow-hidden group hover:border-gray-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400">إجمالي الموظفين النشطين</span>
                          <h3 className="text-2xl font-black text-slate-800">{totalEmployees} موظفاً</h3>
                        </div>
                        <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl">
                          <Users className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-gray-500 mt-2 flex gap-2">
                        <span>{sarEmployees} بالسعودية</span>
                        <span className="text-gray-300">|</span>
                        <span>{egpEmployees} بمصر</span>
                      </div>
                    </div>

                    {/* Concurrency Payrolls */}
                    <div className="border border-gray-150 rounded-2xl p-5 bg-white shadow-sm flex flex-col justify-between min-h-[125px] relative overflow-hidden group hover:border-gray-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400">مسيرة الرواتب النشطة</span>
                          <h3 className="text-2xl font-black text-indigo-600">{sarNetFormatted}</h3>
                        </div>
                        <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl">
                          <Briefcase className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="text-[9px] font-bold text-gray-400 mt-1">
                        تتضمن الراتب الأساسي والبدلات بعد الاستقطاعات
                      </div>
                    </div>

                    {/* Attendance Rate */}
                    <div className="border border-gray-150 rounded-2xl p-5 bg-white shadow-sm flex flex-col justify-between min-h-[125px] relative overflow-hidden group hover:border-gray-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400">معدل الحضور والانضباط</span>
                           <h3 className="text-2xl font-black text-teal-600">{avgAttendance === -1 ? "—" : `${avgAttendance}%`}</h3>
                        </div>
                        <div className="p-2.5 bg-teal-50 text-teal-500 rounded-xl">
                          <Clock className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-gray-500 mt-2 flex gap-2">
                        <span>إجمالي {data?.employeeAttendance?.reduce((a:number,c:any)=>a+c.totalDays,0) || 0} تسجيلات حضور نشطة</span>
                      </div>
                    </div>

                    {/* Requests Status */}
                    <div className="border border-gray-150 rounded-2xl p-5 bg-white shadow-sm flex flex-col justify-between min-h-[125px] relative overflow-hidden group hover:border-gray-300 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-gray-400">طلبات الإجازات النشطة</span>
                          <h3 className="text-2xl font-black text-amber-600">{pendingRequestsCount} طلبات معلقة</h3>
                        </div>
                        <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
                          <ClipboardList className="w-5 h-5" />
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-gray-500 mt-2">
                        إجمالي الطلبات المقدمة: {(data?.leaveRequests || []).length}
                      </div>
                    </div>
                  </div>

                  {/* Graphs & Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Job Title distribution (Vertical Bar Chart, col-span-2) */}
                    <div className="lg:col-span-2 border border-gray-150 rounded-2xl p-5 bg-white shadow-sm flex flex-col justify-between min-h-[380px]">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">توزيع الموظفين حسب المسمى الوظيفي</h3>
                          <p className="text-[10px] text-gray-400 font-medium">نظرة عامة على الهيكل الوظيفي وتوزيع القوى العاملة بالشركة</p>
                        </div>
                        {isMounted && (dynamicJobTitleStats || []).length > 0 && (() => {
                          const stats = dynamicJobTitleStats || [];
                          let maxJob = { name: "", value: 0 };
                          stats.forEach((s: any) => {
                            if (s.value > maxJob.value) {
                              maxJob = s;
                            }
                          });
                          const totalRoles = stats.length;
                          return (
                            <div className="text-right sm:text-left bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 flex gap-4 text-[10px] font-bold text-gray-500">
                              <div>
                                <span className="text-gray-400">التخصصات: </span>
                                <span className="text-indigo-600 font-extrabold">{totalRoles}</span>
                              </div>
                              <span className="text-gray-300">|</span>
                              <div>
                                <span className="text-gray-400">الأكثر شيوعاً: </span>
                                <span className="text-emerald-600 font-extrabold">{translateJobTitle(maxJob.name)} ({maxJob.value} موظفين)</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="w-full h-[280px] relative" style={{ direction: "ltr" }}>
                        {isMounted && (dynamicJobTitleStats || []).length > 0 ? (() => {
                          const sortedHRData = [...(dynamicJobTitleStats || [])]
                            .sort((a: any, b: any) => b.value - a.value)
                            .map((item: any) => ({
                              ...item,
                              name: translateJobTitle(item.name)
                            }));
                          const maxVal = Math.max(...sortedHRData.map((d: any) => d.value), 0);
                          const yTicks = Array.from({ length: maxVal + 1 }, (_, i) => i + 1);

                          // 12 shades of Teal from darkest to lightest
                          const tealShades = [
                            "#042f2e", // teal-950 (darkest)
                            "#134e4a", // teal-900
                            "#115e59", // teal-800
                            "#0f766e", // teal-700
                            "#0d9488", // teal-600
                            "#14b8a6", // teal-500 (color in the image!)
                            "#2dd4bf", // teal-400
                            "#5eead4", // teal-300
                            "#99f6e4", // teal-200
                            "#ccfbf1", // teal-100
                            "#e6fffa", // light teal
                            "#f0fdfa", // teal-50 (lightest)
                          ];

                          return (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                              <BarChart 
                                data={sortedHRData} 
                                margin={{ top: 10, right: 10, left: -20, bottom: 60 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                  dataKey="name"
                                  tick={{ fill: '#475569', fontSize: 9, fontWeight: 'bold' }} 
                                  axisLine={false} 
                                  tickLine={false}
                                  interval={0}
                                  angle={-35}
                                  textAnchor="end"
                                />
                                <YAxis 
                                  ticks={yTicks}
                                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                                  axisLine={false} 
                                  tickLine={false}
                                  allowDecimals={false}
                                  domain={[0, maxVal + 1]}
                                />
                                <RechartsTooltip
                                  wrapperStyle={{ zIndex: 100 }}
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      return (
                                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs font-bold text-right dir-rtl">
                                          <p className="text-gray-400">{payload[0].payload.name}</p>
                                          <p className="text-teal-400">{payload[0].value} موظفين ({Math.round(Number(payload[0].value) / totalEmployees * 100)}%)</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={30}>
                                  {sortedHRData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={tealShades[Math.min(index, tealShades.length - 1)]} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        })() : (
                          <NoDataState />
                        )}
                      </div>
                    </div>

                    {/* Attendance Status distribution (Donut Chart, col-span-1) */}
                    <div className="border border-gray-150 rounded-2xl p-5 bg-white shadow-sm flex flex-col min-h-[380px]">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 mb-2">توزيع حالات الحضور المسجلة</h3>
                        <div className="w-full h-[150px] relative" style={{ direction: "ltr" }}>
                          {isMounted && (dynamicAttendanceStats || []).length > 0 ? (
                            <>
                              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                <PieChart>
                                  <RechartsTooltip
                                    wrapperStyle={{ zIndex: 100 }}
                                    content={({ active, payload }) => {
                                      if (active && payload && payload.length) {
                                        return (
                                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-lg border border-slate-800 text-xs font-bold text-right dir-rtl">
                                            <p className="text-gray-400">{payload[0].name}</p>
                                            <p className="text-indigo-400">{payload[0].value} تسجيلات</p>
                                          </div>
                                        );
                                      }
                                      return null;
                                    }}
                                  />
                                  <Pie
                                    data={(dynamicAttendanceStats || []).map((r:any) => ({ name: r.status, value: r.count }))}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={60}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {(dynamicAttendanceStats || []).map((entry: any, index: number) => (
                                      <Cell key={`cell-${index}`} fill={ATT_COLORS[entry.status] || COLORS_PIE[index % COLORS_PIE.length]} />
                                    ))}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">إجمالي الحالات</span>
                                <span className="text-sm font-black text-gray-700">{(dynamicAttendanceStats || []).reduce((a:number,c:any)=>a+c.count,0)}</span>
                              </div>
                            </>
                          ) : (
                            <NoDataState />
                          )}
                        </div>
                      </div>

                      {/* Attendance Legends with Progress Bars in a Grid Layout */}
                      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 mt-2">
                        {isMounted && (dynamicAttendanceStats || []).map((item: any, idx: number) => {
                          const color = ATT_COLORS[item.status] || COLORS_PIE[idx % COLORS_PIE.length];
                          const totalCount = (dynamicAttendanceStats || []).reduce((a:number,c:any)=>a+c.count,0) || 1;
                          const percent = Math.round((item.count / totalCount) * 100);
                          return (
                            <div key={idx} className="bg-slate-50/50 border border-slate-100/50 rounded-xl p-2.5 flex flex-col justify-between space-y-1.5 hover:border-slate-200 hover:bg-slate-50 transition-all">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                  <span className="text-gray-600">{item.status}</span>
                                </div>
                                <span className="text-gray-700 font-extrabold">{item.count} <span className="text-[8.5px] text-gray-400 font-bold">({percent}%)</span></span>
                              </div>
                              <div className="w-full bg-gray-150 h-1.5 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-500" style={{ backgroundColor: color, width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        {(dynamicAttendanceStats || []).length === 0 && (
                          <div className="col-span-2 py-6 text-center text-xs font-bold text-gray-400">
                            لا توجد سجلات حضور مسجلة للفترة المحددة
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Employees Directory Table */}
                  <div className="border border-gray-150 rounded-2xl bg-white shadow-sm overflow-hidden space-y-4 p-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">سجل رواتب وانضباط الموظفين التفصيلي</h3>
                        <p className="text-[11px] text-gray-400 mt-0.5">تفاصيل الأجور المستحقة ونسب الحضور لكافة الكادر الوظيفي بالشركة</p>
                      </div>

                      {/* Controls (Search, Currency, etc.) */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="بحث باسم الموظف أو الوظيفة..."
                            value={hrSearch}
                            onChange={(e) => setHrSearch(e.target.value)}
                            className="w-full md:w-56 text-xs font-bold pr-8 pl-3 py-2 bg-slate-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all text-right"
                          />
                        </div>

                        {/* Currency Filter Tabs */}
                        <div className="flex bg-slate-50 p-1 rounded-xl border border-gray-150">
                          <button
                            onClick={() => setHrCurrencyFilter("all")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              hrCurrencyFilter === "all" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-800"
                            }`}
                          >
                            الكل
                          </button>
                          <button
                            onClick={() => setHrCurrencyFilter("SAR")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              hrCurrencyFilter === "SAR" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-800"
                            }`}
                          >
                            ريال سعودي
                          </button>
                          <button
                            onClick={() => setHrCurrencyFilter("EGP")}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                              hrCurrencyFilter === "EGP" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-800"
                            }`}
                          >
                            جنيه مصري
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto w-full border border-gray-50 rounded-xl">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500">
                            <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/70" onClick={() => {
                              setHrSortAsc(hrSortField === "name" ? !hrSortAsc : true);
                              setHrSortField("name");
                            }}>
                              <div className="flex items-center gap-1.5 justify-end">
                                <span>اسم الموظف</span>
                                <ArrowUpDown className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>
                            <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/70" onClick={() => {
                              setHrSortAsc(hrSortField === "jobTitle" ? !hrSortAsc : true);
                              setHrSortField("jobTitle");
                            }}>
                              <div className="flex items-center gap-1.5 justify-end">
                                <span>المسمى الوظيفي</span>
                                <ArrowUpDown className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center">العملة</th>
                            <th className="px-4 py-3">الراتب الأساسي</th>
                            <th className="px-4 py-3">البدلات</th>
                            <th className="px-4 py-3">الاستقطاعات</th>
                            <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/70" onClick={() => {
                              setHrSortAsc(hrSortField === "net" ? !hrSortAsc : false);
                              setHrSortField("net");
                            }}>
                              <div className="flex items-center gap-1.5 justify-end">
                                <span>صافي الراتب</span>
                                <ArrowUpDown className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>
                            <th className="px-4 py-3 cursor-pointer select-none hover:bg-slate-100/70" onClick={() => {
                              setHrSortAsc(hrSortField === "attendanceRate" ? !hrSortAsc : false);
                              setHrSortField("attendanceRate");
                            }}>
                              <div className="flex items-center gap-1.5 justify-end">
                                <span>نسبة الحضور</span>
                                <ArrowUpDown className="w-3 h-3 text-gray-400" />
                              </div>
                            </th>
                            <th className="px-4 py-3 text-center">سجل الانضباط</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-[11px] font-bold text-gray-700">
                          {filteredEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="py-8 text-center text-gray-400">
                                لا يوجد موظفين يطابقون خيارات البحث الحالية
                              </td>
                            </tr>
                          ) : (
                            filteredEmployees.map((emp: any) => (
                              <tr key={emp.id} className="hover:bg-slate-50/50 transition-all">
                                <td className="px-4 py-3.5 text-gray-900">{emp.name}</td>
                                <td className="px-4 py-3.5 text-gray-500">{emp.jobTitle}</td>
                                <td className="px-4 py-3.5 text-center">
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                                    emp.currency === 'EGP' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                  }`}>
                                    {emp.currency}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 font-semibold">{emp.basic.toLocaleString("en-US")} {emp.currency}</td>
                                <td className="px-4 py-3.5 font-semibold text-emerald-600">+{emp.allowances.toLocaleString("en-US")}</td>
                                <td className="px-4 py-3.5 font-semibold text-rose-500">-{emp.deductions.toLocaleString("en-US")}</td>
                                <td className="px-4 py-3.5 text-slate-800 font-extrabold">{emp.net.toLocaleString("en-US")} {emp.currency}</td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2 justify-end">
                                    <span className={`w-12 text-left font-bold ${
                                      emp.attendanceRate === -1 ? "text-gray-400" :
                                      emp.attendanceRate >= 90 ? "text-emerald-600" :
                                      emp.attendanceRate >= 75 ? "text-blue-600" : "text-rose-500"
                                    }`}>
                                      {emp.attendanceRate === -1 ? "—" : `${emp.attendanceRate}%`}
                                    </span>
                                    {emp.attendanceRate !== -1 && (
                                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${
                                          emp.attendanceRate >= 90 ? "bg-emerald-500" : emp.attendanceRate >= 75 ? "bg-blue-500" : "bg-rose-500"
                                        }`} style={{ width: `${emp.attendanceRate}%` }} />
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <span className={`text-[10px] font-medium ${emp.attendanceRate === -1 ? "text-gray-400" : "text-gray-500"}`}>
                                    {emp.attendanceRate === -1 ? "غير مشمول بالفترة" : `حضر ${emp.presentDays} | تأخر ${emp.lateDays} | غاب ${emp.absentDays}`}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Leave Requests Overview */}
                  <div className="border border-gray-150 rounded-2xl bg-white shadow-sm p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">سجل طلبات الإجازات والغياب الإداري</h3>
                      <p className="text-[11px] text-gray-400 mt-0.5">الطلبات الحالية والسابقة المقدمة من الكادر الوظيفي وحالتها الإدارية</p>
                    </div>

                    <div className="overflow-x-auto w-full border border-gray-50 rounded-xl">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-50/75 border-b border-gray-100 text-[11px] font-bold text-gray-500">
                            <th className="px-4 py-3">اسم الموظف</th>
                            <th className="px-4 py-3">نوع الطلب</th>
                            <th className="px-4 py-3 text-center">تاريخ البدء</th>
                            <th className="px-4 py-3 text-center">تاريخ الانتهاء</th>
                            <th className="px-4 py-3 text-center">المدة</th>
                            <th className="px-4 py-3">سبب الإجازة</th>
                            <th className="px-4 py-3 text-center">حالة الطلب</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-[11px] font-bold text-gray-700">
                          {(data?.leaveRequests || []).length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-gray-400">
                                لا توجد طلبات إجازة نشطة أو معلّقة حالياً
                              </td>
                            </tr>
                          ) : (
                            (data.leaveRequests).map((req: any) => (
                              <tr key={req.id} className="hover:bg-slate-50/50 transition-all">
                                <td className="px-4 py-3.5 text-gray-900">{req.employeeName}</td>
                                <td className="px-4 py-3.5 text-slate-800">{req.type}</td>
                                <td className="px-4 py-3.5 text-center text-gray-500 font-semibold">{req.startDate}</td>
                                <td className="px-4 py-3.5 text-center text-gray-500 font-semibold">{req.endDate}</td>
                                <td className="px-4 py-3.5 text-center font-extrabold text-indigo-600">{req.daysCount} يوم</td>
                                <td className="px-4 py-3.5 text-gray-500 max-w-[200px] truncate" title={req.reason}>
                                  {req.reason}
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                                    req.status === "approved" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                    req.status === "rejected" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                                    "bg-amber-50 text-amber-600 border border-amber-100 animate-pulse"
                                  }`}>
                                    {req.statusLabel}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* Global Footer */}
        <div className="border-t border-gray-100 pt-6 mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>لوحة البيانات متصلة بقاعدة بيانات Rentals وقاعدة بيانات ERP الموحدة مباشرة.</span>
          </div>
          <span>برنامج لوحة تحليلات NestedUnited ERP</span>
        </div>
      </div>
    </div>
  );
}
