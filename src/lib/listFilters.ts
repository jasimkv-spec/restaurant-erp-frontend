import * as XLSX from "xlsx";

/**
 * Shared search/filter/export building blocks for transaction list screens
 * (Material Requests, RFQs, Purchase Orders, and whatever comes after) so
 * each screen only has to declare WHAT is filterable, not re-implement HOW
 * filtering, selection and Excel export work every time. Used by both
 * DocumentScreen (the generic header+lines+lifecycle component) and any
 * custom-built list screen that isn't a DocumentScreen (e.g. Rfqs.tsx).
 */

export interface ListFilterConfig {
  /** Unique key for this filter's own UI state - doesn't have to match a row property. */
  key: string;
  label: string;
  type: "select";
  options: { value: string; label: string }[];
  /** How to read this row's value for comparison against the selected option - defaults to row[key]. Needed whenever the filterable value lives on a nested relation, e.g. row.vendor?.id. */
  accessor?: (row: any) => any;
}

export interface DateRangeFilterConfig {
  label: string;
  /** How to read this row's date - defaults to row[key]. */
  key: string;
  accessor?: (row: any) => string | Date | null | undefined;
}

/** True if `row` matches every currently-active filter/search/date-range - an inactive filter (blank value) always passes. */
export function matchesRowFilters(
  row: any,
  params: {
    search?: string;
    searchAccessor?: (row: any) => string;
    filters?: ListFilterConfig[];
    filterValues?: Record<string, string>;
    dateRangeFilter?: DateRangeFilterConfig;
    dateFrom?: string;
    dateTo?: string;
  }
): boolean {
  const { search, searchAccessor, filters, filterValues, dateRangeFilter, dateFrom, dateTo } = params;

  if (search && search.trim() && searchAccessor) {
    const haystack = searchAccessor(row)?.toLowerCase?.() ?? "";
    if (!haystack.includes(search.trim().toLowerCase())) return false;
  }

  if (filters && filterValues) {
    for (const f of filters) {
      const selected = filterValues[f.key];
      if (!selected) continue;
      const actual = f.accessor ? f.accessor(row) : row[f.key];
      if (String(actual ?? "") !== selected) return false;
    }
  }

  if (dateRangeFilter && (dateFrom || dateTo)) {
    const raw = dateRangeFilter.accessor ? dateRangeFilter.accessor(row) : row[dateRangeFilter.key];
    const rowDate = raw ? new Date(raw) : null;
    if (!rowDate || Number.isNaN(rowDate.getTime())) return false;
    if (dateFrom && rowDate < new Date(dateFrom)) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (rowDate > end) return false;
    }
  }

  return true;
}

/** Same plain-text extraction CrudTable/DocumentScreen already use for CSV - a rendered React badge falls back to the raw underlying value instead of "[object Object]". */
function exportText(col: { key: string; render?: (row: any) => any }, row: Record<string, any>): string {
  const rendered = col.render ? col.render(row) : row[col.key];
  if (typeof rendered === "string" || typeof rendered === "number") return String(rendered);
  const raw = row[col.key];
  if (raw === undefined || raw === null || typeof raw === "object") return "";
  return String(raw);
}

/** Builds and downloads an .xlsx from whichever rows the caller passes in (typically "selected if any, otherwise every currently-filtered row"). */
export function exportRowsToExcel(
  columns: { key: string; label: string; render?: (row: any) => any }[],
  rows: any[],
  filenameBase: string
) {
  const data = rows.map((row) => Object.fromEntries(columns.map((c) => [c.label, exportText(c, row)])));
  const sheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Export");
  XLSX.writeFile(workbook, `${filenameBase.replace(/\s+/g, "-").toLowerCase()}.xlsx`);
}
