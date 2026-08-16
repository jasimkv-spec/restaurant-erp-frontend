import { useEffect, useState } from "react";
import { api, type ListResponse } from "./apiClient";

/**
 * Fetches a list endpoint once and reshapes it into { value, label }
 * dropdown options for CrudTable's "select" fields - every setup screen
 * below a company/branch needs at least one of these (Branch needs
 * Company, Warehouse needs Branch, and so on).
 */
export function useOptions(path: string | null, labelFn: (row: any) => string) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api.get<ListResponse<any>>(`${path}?pageSize=200`).then((res) => {
      if (!cancelled) setOptions(res.data.map((row) => ({ value: row.id, label: labelFn(row) })));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return options;
}
