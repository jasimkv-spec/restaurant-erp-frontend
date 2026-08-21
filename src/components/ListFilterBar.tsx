import { Search, X } from "lucide-react";
import { FIELD_CLASS } from "./CrudTable";
import type { DateRangeFilterConfig, ListFilterConfig } from "../lib/listFilters";

/**
 * Search box + per-screen filter selects + an optional date range, rendered
 * as one compact row above a transaction list. Each screen (Material
 * Requests, RFQs, Purchase Orders, ...) only declares which filters make
 * sense for it - see ListFilterConfig/DateRangeFilterConfig in
 * lib/listFilters.ts - so a screen with no vendor (e.g. Material Request)
 * simply doesn't pass one, rather than showing an irrelevant blank field.
 */
export function ListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  filters,
  filterValues,
  onFilterChange,
  dateRangeFilter,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClear,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ListFilterConfig[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  dateRangeFilter?: DateRangeFilterConfig;
  dateFrom?: string;
  onDateFromChange?: (value: string) => void;
  dateTo?: string;
  onDateToChange?: (value: string) => void;
  onClear?: () => void;
}) {
  const hasAnything = !!onSearchChange || (filters && filters.length > 0) || !!dateRangeFilter;
  if (!hasAnything) return null;

  const hasActiveFilter =
    !!search || Object.values(filterValues ?? {}).some(Boolean) || !!dateFrom || !!dateTo;

  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      {onSearchChange && (
        <div className="relative w-56">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className={`${FIELD_CLASS} pl-8`}
            placeholder={searchPlaceholder ?? "Search..."}
            value={search ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      )}

      {filters?.map((f) => (
        <div key={f.key} className="w-44">
          <select
            className={FIELD_CLASS}
            value={filterValues?.[f.key] ?? ""}
            onChange={(e) => onFilterChange?.(f.key, e.target.value)}
          >
            <option value="">{f.label}: All</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {dateRangeFilter && (
        <>
          <div className="w-36">
            <input
              type="date"
              className={FIELD_CLASS}
              value={dateFrom ?? ""}
              onChange={(e) => onDateFromChange?.(e.target.value)}
              title={`${dateRangeFilter.label} from`}
            />
          </div>
          <div className="w-36">
            <input
              type="date"
              className={FIELD_CLASS}
              value={dateTo ?? ""}
              onChange={(e) => onDateToChange?.(e.target.value)}
              title={`${dateRangeFilter.label} to`}
            />
          </div>
        </>
      )}

      {hasActiveFilter && onClear && (
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-navy-900"
        >
          <X size={13} />
          Clear
        </button>
      )}
    </div>
  );
}
