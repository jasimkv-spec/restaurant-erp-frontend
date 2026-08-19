import { useEffect, useState } from "react";
import { api, type ListResponse } from "./apiClient";

interface MasterSeriesRow {
  numberingMode: string;
  prefix: string;
}

/**
 * Looks up whether a Master Series is configured for the given entityType
 * (Vendor, Customer, RawMaterial, MenuItem, Item, ...) and, if so, whether
 * it's in Auto or Manual numbering mode.
 *
 * Auto configured -> the code field should be locked; the system always
 * generates it, typing one in would either be ignored or create a
 * conflicting/duplicate code.
 * Manual configured, or nothing configured yet -> there's nothing to
 * auto-generate from, so the field stays open for manual entry (this
 * matches resolveMasterCode()'s own fallback in masterNumber.ts).
 */
export function useCodeLock(entityType: string) {
  const [locked, setLocked] = useState(false);
  const [prefix, setPrefix] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ListResponse<MasterSeriesRow>>(`/api/admin/master-series?entityType=${encodeURIComponent(entityType)}`)
      .then((res) => {
        if (cancelled) return;
        const series = res.data[0];
        setLocked(!!series && series.numberingMode === "Auto");
        setPrefix(series?.prefix ?? null);
      })
      .catch(() => {
        if (!cancelled) setLocked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType]);

  return { locked, prefix };
}
