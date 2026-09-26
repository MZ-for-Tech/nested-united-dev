// ============================================================
// Analytics Date Utilities
// ============================================================
import { query } from "@/lib/db";

/** Format a Date object to YYYY-MM-DD string */
export const formatDate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Get ISO week number for a given date */
export const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export interface DateBounds {
  startDateStr: string;
  endDateStr: string;
  daysCount: number;
}

/**
 * Resolve date range from params, then cap against actual data min/max dates.
 */
export async function resolveDateRange(
  range: string,
  customStartDate: string,
  customEndDate: string
): Promise<DateBounds> {
  const now = new Date();

  // Fetch max/min dates from database to support YTD capping
  const [maxBookings, maxReservations, minBookings, minReservations] = await Promise.all([
    query<any>("SELECT MAX(checkout_date) as max_d FROM bookings"),
    query<any>("SELECT MAX(end_date) as max_d FROM reservations"),
    query<any>("SELECT MIN(checkin_date) as min_d FROM bookings"),
    query<any>("SELECT MIN(start_date) as min_d FROM reservations"),
  ]);

  const maxDates: Date[] = [];
  if (maxBookings[0]?.max_d) maxDates.push(new Date(maxBookings[0].max_d));
  if (maxReservations[0]?.max_d) maxDates.push(new Date(maxReservations[0].max_d));
  const maxDataDate = maxDates.length > 0 ? new Date(Math.max(...maxDates.map(d => d.getTime()))) : null;

  const minDates: Date[] = [];
  if (minBookings[0]?.min_d) minDates.push(new Date(minBookings[0].min_d));
  if (minReservations[0]?.min_d) minDates.push(new Date(minReservations[0].min_d));
  const minDataDate = minDates.length > 0 ? new Date(Math.min(...minDates.map(d => d.getTime()))) : null;

  let startDateStr = "";
  let endDateStr = "";

  if (range === "all") {
    startDateStr = minDataDate ? formatDate(minDataDate) : "2025-01-01";
    endDateStr = maxDataDate ? formatDate(maxDataDate) : "2026-12-31";
  } else if (customStartDate && customEndDate) {
    startDateStr = customStartDate;
    endDateStr = customEndDate;
  } else {
    switch (range) {
      case "today":
        startDateStr = formatDate(now);
        endDateStr = formatDate(now);
        break;
      case "week": {
        const startOfWeek = new Date(now);
        const diff = now.getDay() === 0 ? 6 : now.getDay() - 1;
        startOfWeek.setDate(now.getDate() - diff);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        startDateStr = formatDate(startOfWeek);
        endDateStr = formatDate(endOfWeek);
        break;
      }
      case "month": {
        startDateStr = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
        endDateStr = formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        break;
      }
      case "quarter": {
        const q = Math.floor(now.getMonth() / 3);
        startDateStr = formatDate(new Date(now.getFullYear(), q * 3, 1));
        endDateStr = formatDate(new Date(now.getFullYear(), (q + 1) * 3, 0));
        break;
      }
      case "year": {
        startDateStr = formatDate(new Date(now.getFullYear(), 0, 1));
        endDateStr = formatDate(new Date(now.getFullYear(), 11, 31));
        break;
      }
      default: {
        startDateStr = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
        endDateStr = formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      }
    }
  }

  // Apply YTD capping: start date
  if (minDataDate) {
    const startD = new Date(startDateStr);
    const endD = new Date(endDateStr);
    if (minDataDate > startD && minDataDate <= endD) {
      startDateStr = formatDate(minDataDate);
    }
  }

  // Apply YTD capping: end date
  if (maxDataDate) {
    const startD = new Date(startDateStr);
    const endD = new Date(endDateStr);
    if (maxDataDate >= startD && maxDataDate < endD) {
      endDateStr = formatDate(maxDataDate);
    }
  }

  const daysCount = Math.max(
    1,
    Math.ceil((new Date(endDateStr).getTime() - new Date(startDateStr).getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  return { startDateStr, endDateStr, daysCount };
}
