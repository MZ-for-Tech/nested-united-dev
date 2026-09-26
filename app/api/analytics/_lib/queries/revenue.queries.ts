// ============================================================
// Revenue, Occupancy & KPI Queries
// ============================================================
import { query } from "@/lib/db";
import { buildParams } from "../account-filter";
import { EmployeeRow } from "../types";

/** Pro-rated booking revenue over [startStr, endStr] */
export async function getPeriodRevenue(
  startStr: string,
  endStr: string,
  accountIds: string[],
  accountFilterBookings: string
): Promise<number> {
  const p = buildParams([endStr, startStr, endStr, startStr], accountIds);
  const res = await query<{ revenue: number | string }>(
    `SELECT SUM(
       (b.amount / COALESCE(NULLIF(DATEDIFF(b.checkout_date, b.checkin_date), 0), 1)) *
       GREATEST(0, DATEDIFF(
         LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?),
         GREATEST(b.checkin_date, ?)
       ) + 1)
     ) as revenue
     FROM bookings b
     INNER JOIN units u ON b.unit_id = u.id
     WHERE b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}`,
    p
  );
  return Number(res[0]?.revenue || 0);
}

/** Total occupied days (bookings + iCal reservations) over [startStr, endStr] */
export async function getPeriodOccupiedDays(
  startStr: string,
  endStr: string,
  accountIds: string[],
  accountFilterBookings: string,
  accountFilterReservations: string
): Promise<number> {
  const pB = buildParams([endStr, startStr, endStr, startStr], accountIds);
  const pR = buildParams([endStr, startStr, endStr, startStr], accountIds);

  const [resB, resR] = await Promise.all([
    query<{ days: number | string }>(
      `SELECT SUM(GREATEST(0, DATEDIFF(
         LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?),
         GREATEST(b.checkin_date, ?)
       ) + 1)) as days
       FROM bookings b
       INNER JOIN units u ON b.unit_id = u.id
       WHERE b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}`,
      pB
    ),
    query<{ days: number | string }>(
      `SELECT SUM(GREATEST(0, DATEDIFF(
         LEAST(CASE WHEN r.end_date = r.start_date THEN r.end_date ELSE r.end_date - INTERVAL 1 DAY END, ?),
         GREATEST(r.start_date, ?)
       ) + 1)) as days
       FROM reservations r
       INNER JOIN units u ON r.unit_id = u.id
       WHERE r.start_date <= ? AND (CASE WHEN r.end_date = r.start_date THEN r.end_date ELSE r.end_date - INTERVAL 1 DAY END) >= ? ${accountFilterReservations}`,
      pR
    ),
  ]);

  return Number(resB[0]?.days || 0) + Number(resR[0]?.days || 0);
}

/** Main revenue KPIs: totalRevenue, bookingsDays, reservationsDays, totalBookedDays, totalUnits */
export async function fetchRevenueKPIs(
  startDateStr: string,
  endDateStr: string,
  accountFilterBookings: string,
  accountFilterReservations: string,
  accountFilterUnits: string,
  paramsOccupancyBookings: unknown[],
  paramsOccupancyReservations: unknown[],
  paramsUnits: unknown[]
) {
  const [bookingsRevResult, reservationsDaysResult, bookingsDaysResult, totalUnitsResult] =
    await Promise.all([
      query<{ revenue: number | string }>(
        `SELECT SUM(
           (b.amount / COALESCE(NULLIF(DATEDIFF(b.checkout_date, b.checkin_date), 0), 1)) *
           GREATEST(0, DATEDIFF(
             LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?),
             GREATEST(b.checkin_date, ?)
           ) + 1)
         ) as revenue
         FROM bookings b
         INNER JOIN units u ON b.unit_id = u.id
         WHERE b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}`,
        paramsOccupancyBookings
      ),
      query<{ days: number | string }>(
        `SELECT SUM(GREATEST(0, DATEDIFF(
           LEAST(CASE WHEN r.end_date = r.start_date THEN r.end_date ELSE r.end_date - INTERVAL 1 DAY END, ?),
           GREATEST(r.start_date, ?)
         ) + 1)) as days
         FROM reservations r
         INNER JOIN units u ON r.unit_id = u.id
         WHERE r.start_date <= ? AND (CASE WHEN r.end_date = r.start_date THEN r.end_date ELSE r.end_date - INTERVAL 1 DAY END) >= ? ${accountFilterReservations}`,
        paramsOccupancyReservations
      ),
      query<{ days: number | string }>(
        `SELECT SUM(GREATEST(0, DATEDIFF(
           LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?),
           GREATEST(b.checkin_date, ?)
         ) + 1)) as days
         FROM bookings b
         INNER JOIN units u ON b.unit_id = u.id
         WHERE b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}`,
        paramsOccupancyBookings
      ),
      query<{ count: number }>(
        `SELECT COUNT(*) as count FROM units u WHERE u.status = 'active' ${accountFilterUnits}`,
        paramsUnits
      ),
    ]);

  const totalRevenue = Number(bookingsRevResult[0]?.revenue || 0);
  const reservationsDays = Number(reservationsDaysResult[0]?.days || 0);
  const bookingsDays = Number(bookingsDaysResult[0]?.days || 0);
  const totalBookedDays = reservationsDays + bookingsDays;
  const totalUnits = Math.max(1, totalUnitsResult[0]?.count || 1);

  return { totalRevenue, bookingsDays, reservationsDays, totalBookedDays, totalUnits };
}

/** Platform revenue split: Airbnb vs Gathern vs external */
export async function fetchPlatformShare(
  totalRevenue: number,
  accountFilterBookings: string,
  paramsOccupancyBookings: unknown[]
) {
  const [airbnbResult, gathernResult] = await Promise.all([
    query<{ revenue: number | string }>(
      `SELECT SUM(
         (b.amount / COALESCE(NULLIF(DATEDIFF(b.checkout_date, b.checkin_date), 0), 1)) *
         GREATEST(0, DATEDIFF(
           LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?),
           GREATEST(b.checkin_date, ?)
         ) + 1)
       ) as revenue
       FROM bookings b
       INNER JOIN units u ON b.unit_id = u.id
       WHERE b.platform = 'airbnb' AND b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}`,
      paramsOccupancyBookings
    ),
    query<{ revenue: number | string }>(
      `SELECT SUM(
         (b.amount / COALESCE(NULLIF(DATEDIFF(b.checkout_date, b.checkin_date), 0), 1)) *
         GREATEST(0, DATEDIFF(
           LEAST(CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END, ?),
           GREATEST(b.checkin_date, ?)
         ) + 1)
       ) as revenue
       FROM bookings b
       INNER JOIN units u ON b.unit_id = u.id
       WHERE b.platform = 'gathern' AND b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}`,
      paramsOccupancyBookings
    ),
  ]);

  const airbnb = Number(airbnbResult[0]?.revenue || 0);
  const gathern = Number(gathernResult[0]?.revenue || 0);
  const external = Math.max(0, totalRevenue - (airbnb + gathern));

  return { airbnb, gathern, external };
}

/** Booking/reservation counts + repeat guest rate */
export async function fetchBookingKPIs(
  endDateStr: string,
  startDateStr: string,
  accountIds: string[],
  accountFilterBookings: string,
  accountFilterReservations: string
) {
  const pSimpleB = buildParams([endDateStr, startDateStr], accountIds);
  const pSimpleR = buildParams([endDateStr, startDateStr], accountIds);

  const [bookingsCountRes, reservationsCountRes, repeatGuestsRes] = await Promise.all([
    query<{ count: number }>(
      `SELECT COUNT(*) as count FROM bookings b
       INNER JOIN units u ON b.unit_id = u.id
       WHERE b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}`,
      pSimpleB
    ),
    query<{ count: number }>(
      `SELECT COUNT(*) as count FROM reservations r
       INNER JOIN units u ON r.unit_id = u.id
       WHERE r.start_date <= ? AND (CASE WHEN r.end_date = r.start_date THEN r.end_date ELSE r.end_date - INTERVAL 1 DAY END) >= ? ${accountFilterReservations}`,
      pSimpleR
    ),
    query<{ repeated: number; total_unique: number }>(
      `SELECT 
         COUNT(DISTINCT CASE WHEN booking_count > 1 THEN guest_key END) as repeated,
         COUNT(DISTINCT guest_key) as total_unique
       FROM (
         SELECT COALESCE(NULLIF(b.phone, ''), b.guest_name) as guest_key, COUNT(*) as booking_count
         FROM bookings b
         INNER JOIN units u ON b.unit_id = u.id
         WHERE b.checkin_date <= ? AND (CASE WHEN b.checkout_date = b.checkin_date THEN b.checkout_date ELSE b.checkout_date - INTERVAL 1 DAY END) >= ? ${accountFilterBookings}
         GROUP BY COALESCE(NULLIF(b.phone, ''), b.guest_name)
       ) as guest_bookings`,
      pSimpleB
    ),
  ]);

  const bookingsCount = Number(bookingsCountRes[0]?.count || 0);
  const reservationsCount = Number(reservationsCountRes[0]?.count || 0);
  const totalBookingsCount = bookingsCount + reservationsCount;

  const repeatedCount = Number(repeatGuestsRes[0]?.repeated || 0);
  const totalUniqueCount = Number(repeatGuestsRes[0]?.total_unique || 0);
  const repeatGuestRate = totalUniqueCount > 0
    ? Number(((repeatedCount / totalUniqueCount) * 100).toFixed(1))
    : 0.0;

  return { totalBookingsCount, repeatGuestRate, paramsSimpleBookings: pSimpleB };
}
