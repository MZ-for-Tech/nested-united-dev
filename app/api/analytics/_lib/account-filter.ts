// ============================================================
// Account Filter Builder for Analytics SQL Queries
// ============================================================

export interface AccountFilters {
  accountFilterBookings: string;
  accountFilterReservations: string;
  accountFilterUnits: string;
  paramsBookings: unknown[];
  paramsReservations: unknown[];
  paramsOccupancyBookings: unknown[];
  paramsOccupancyReservations: unknown[];
  paramsUnits: unknown[];
  /** accountIds extracted from the account string; empty array if "all" */
  accountIds: string[];
}

/**
 * Build SQL WHERE clause fragments and parameter arrays for account-based filtering.
 *
 * The filter uses unit_calendars as the primary bridge between units and
 * platform_accounts, with a fallback to the direct platform_account_id column
 * on the units table. Both legs are joined via UNION so no data is missed.
 *
 * Each returned params array already has accountIds duplicated twice (for the
 * two IN clauses inside the UNION subquery).
 *
 * @param account  Comma-separated platform_account IDs, or "all"
 * @param startDateStr  Range start (YYYY-MM-DD) — used for base occupancy params
 * @param endDateStr    Range end   (YYYY-MM-DD) — used for base occupancy params
 */
export function buildAccountFilters(
  account: string,
  startDateStr: string,
  endDateStr: string
): AccountFilters {
  // Base params (no account filter)
  const paramsBookings: unknown[] = [startDateStr, endDateStr];
  const paramsReservations: unknown[] = [startDateStr, endDateStr];
  const paramsOccupancyBookings: unknown[] = [endDateStr, startDateStr, endDateStr, startDateStr];
  const paramsOccupancyReservations: unknown[] = [endDateStr, startDateStr, endDateStr, startDateStr];
  const paramsUnits: unknown[] = [];

  if (account === "all") {
    return {
      accountFilterBookings: "",
      accountFilterReservations: "",
      accountFilterUnits: "",
      paramsBookings,
      paramsReservations,
      paramsOccupancyBookings,
      paramsOccupancyReservations,
      paramsUnits,
      accountIds: [],
    };
  }

  const accountIds = account.split(",");
  const placeholders = accountIds.map(() => "?").join(",");

  // UNION subquery: unit_calendars (primary) + direct platform_account_id fallback
  const unitSubquery = `u.id IN (
    SELECT uc.unit_id FROM unit_calendars uc WHERE uc.platform_account_id IN (${placeholders})
    UNION
    SELECT u2.id FROM units u2 WHERE u2.platform_account_id IN (${placeholders})
  )`;

  const filter = ` AND ${unitSubquery} `;

  // Push accountIds twice per filter (once per UNION leg)
  paramsBookings.push(...accountIds, ...accountIds);
  paramsReservations.push(...accountIds, ...accountIds);
  paramsOccupancyBookings.push(...accountIds, ...accountIds);
  paramsOccupancyReservations.push(...accountIds, ...accountIds);
  paramsUnits.push(...accountIds, ...accountIds);

  return {
    accountFilterBookings: filter,
    accountFilterReservations: filter,
    accountFilterUnits: filter,
    paramsBookings,
    paramsReservations,
    paramsOccupancyBookings,
    paramsOccupancyReservations,
    paramsUnits,
    accountIds,
  };
}

/**
 * Build a fresh param array starting with given base params, then appending
 * accountIds twice (for the UNION filter) when account != "all".
 */
export function buildParams(
  baseParams: unknown[],
  accountIds: string[]
): unknown[] {
  if (accountIds.length === 0) return [...baseParams];
  return [...baseParams, ...accountIds, ...accountIds];
}
