import { Fragment, useEffect, useState } from "react";
import { ArrowLeft, Check, FileSpreadsheet, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { api, ApiError, type ListResponse } from "../lib/apiClient";
import { FIELD_CLASS } from "./CrudTable";
import { DocumentAttachments } from "./DocumentAttachments";
import { ListFilterBar } from "./ListFilterBar";
import { matchesRowFilters, exportRowsToExcel, type ListFilterConfig, type DateRangeFilterConfig } from "../lib/listFilters";

// A denser variant of CrudTable's shared FIELD_CLASS/LABEL_CLASS, used only
// here - transaction screens (Material Request, RFQ, Purchase Order, ...)
// pack a lot more fields onto one screen than a master's simple form, so
// they read as cramped-yet-oversized at CrudTable's full padding/label size.
// Scoped to this file rather than changed globally so master-data forms
// (Vendors, Items, Taxes, ...) keep their original, already-fine sizing.
// Exported so other hand-built transaction screens (Rfqs.tsx,
// MrConsolidation.tsx) can opt into the same denser look.
export const COMPACT_FIELD_CLASS = FIELD_CLASS.replace("px-3 py-2", "px-2 py-1.5");
export const COMPACT_LABEL_CLASS = "text-[11px] font-semibold text-navy-900";

/**
 * Generic screen for transactional documents (Material Request, Purchase
 * Order, GRN, Stock Transfer, Stock Adjustment, ...) - a header + an
 * editable line-item grid + a Draft -> Submit -> Approve -> Post lifecycle,
 * plus Edit/Delete while a document is still in an editable status (see
 * editableStatuses/deletableStatuses - default just "Draft", matching every
 * module's own submit/approve routes which only accept a Draft document).
 *
 * Deliberately separate from CrudTable: masters are flat records with
 * enable/disable, documents are header+lines with a status workflow and
 * module-owned transition rules, so trying to force both shapes through one
 * component was worse than having two purpose-built ones. Every field in
 * headerFields/lineFields must already exist as a plain key on the
 * create/update payload - options for "select" fields are fetched by the
 * caller (useOptions) and passed in, same convention as CrudTable's
 * formFields. A "select" lineField can instead take optionsForRow to scope
 * choices per-row (e.g. only the packing units configured for the item
 * picked on that particular line).
 */

export interface DocFieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "date" | "textarea" | "readonly";
  options?: { value: string; label: string }[];
  /** Per-row options for a "select" lineField, e.g. scoped to the item picked on that row. Takes priority over options when present. */
  optionsForRow?: (row: Record<string, any>) => { value: string; label: string }[];
  /** For type "readonly" - a display-only derived value (e.g. an item's base UOM), never sent back to the server. */
  computed?: (row: Record<string, any>) => string;
  required?: boolean;
  placeholder?: string;
  /** Greys the field out and blocks input - e.g. a branch that's auto-selected because the user only has access to one. */
  disabled?: boolean;
  /** Groups this headerField into its own titled, color-coded panel alongside other fields sharing the same section name (e.g. "Transaction Details", "Party Details") - mirrors the multi-panel header layout of a standard ERP transaction screen. Fields without a section fall into a single default "Document Details" panel, so existing screens render unchanged until they opt in. Ignored on lineFields. */
  section?: string;
  /** Caps this lineField's input width instead of letting it stretch to fill its table cell - a Qty or a short code column looks wrong spanning the same width as an Item picker. Ignored on headerFields (those already size themselves via the panel grid). */
  compact?: boolean;
}

export interface LifecycleStep {
  /** Only offered when the open record's status matches this. */
  fromStatus: string;
  /** Appended as POST {basePath}/{id}/{action}. */
  action: string;
  label: string;
  /** Optional extra confirm text shown before firing. */
  confirmMessage?: string;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Submitted: "bg-amber-50 text-amber-700 border-amber-200",
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Posted: "bg-brand-50 text-brand-700 border-brand-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {status}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-gray-100 text-gray-600 border-gray-200",
  Normal: "bg-brand-50 text-brand-700 border-brand-200",
  High: "bg-amber-50 text-amber-700 border-amber-200",
  Urgent: "bg-red-50 text-red-700 border-red-200",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        PRIORITY_STYLES[priority] ?? "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {priority}
    </span>
  );
}

/** Draft -> Submitted -> Approved style progress strip - the visual cue that this is a workflow document, not a static form. Falls back silently (render nothing) when the current status isn't part of the declared flow (e.g. Rejected/Cancelled side-branches) - the StatusBadge next to the title still covers those. */
function Stepper({ steps, current }: { steps: string[]; current: string }) {
  const idx = steps.indexOf(current);
  if (idx === -1) return null;
  return (
    <div className="mb-5 flex items-center rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      {steps.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "current" : "upcoming";
        return (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <div
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${
                state === "done"
                  ? "bg-emerald-50 text-emerald-700"
                  : state === "current"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {state === "done" && <Check size={11} />}
              {s}
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-2 h-px flex-1 ${i < idx ? "bg-emerald-300" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "2026-08-19T12:00:00.000Z" -> "2026-08-19", so it can seed an <input type="date">. Passes through anything that isn't a parseable date untouched. */
function toDateInputValue(value: any): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Resolves what to show for a select-type field's value in a read-only
 * context (detail view). Prefers the matching relation object the API
 * already included (e.g. a lineField "itemId" pairs with a "item" relation,
 * "uomId" with "uom") over an options-list lookup, since a line/header can
 * reference a record (an item, a uom, a branch) that isn't in the option
 * list actually loaded on screen (paged out, since made inactive, etc).
 */
function resolveDisplayValue(f: DocFieldConfig, row: Record<string, any>): string {
  const relationKey = f.key.endsWith("Id") ? f.key.slice(0, -2) : null;
  const relation = relationKey ? row[relationKey] : null;
  if (relation && typeof relation === "object") {
    if (relation.code && relation.name) return `${relation.code} - ${relation.name}`;
    if (relation.code) return relation.code;
    if (relation.name) return relation.name;
  }
  return f.options?.find((o) => o.value === row[f.key])?.label ?? row[f.key] ?? "-";
}

/** Cycled by section index so a 4-panel header (Transaction/Party/Reference/Payment, say) reads as visually distinct blocks rather than one undifferentiated field grid - same idea as a standard ERP transaction screen's colored header strips. */
const SECTION_PALETTE = [
  { border: "border-brand-100", bg: "bg-brand-50", title: "text-brand-700", divider: "border-brand-200" },
  { border: "border-sky-100", bg: "bg-sky-50", title: "text-sky-700", divider: "border-sky-200" },
  { border: "border-amber-100", bg: "bg-amber-50", title: "text-amber-700", divider: "border-amber-200" },
  { border: "border-violet-100", bg: "bg-violet-50", title: "text-violet-700", divider: "border-violet-200" },
];

/** Groups headerFields by their (optional) `section`, preserving first-seen order. Fields with no section land together in one "Document Details" panel, so screens that never set `section` keep rendering exactly one panel like before. */
function groupBySection(fields: DocFieldConfig[]): { section: string; fields: DocFieldConfig[] }[] {
  const groups: { section: string; fields: DocFieldConfig[] }[] = [];
  for (const f of fields) {
    const section = f.section ?? "Document Details";
    let group = groups.find((g) => g.section === section);
    if (!group) {
      group = { section, fields: [] };
      groups.push(group);
    }
    group.fields.push(f);
  }
  return groups;
}

function sumNumericField(rows: Record<string, any>[], key: string): number {
  return rows.reduce((sum, r) => sum + (Number(r[key]) || 0), 0);
}

/**
 * Floor width (px) for a line-item column, applied to both the <th> and its
 * <td>s. Without this, a table with a lot of lineFields (e.g. Purchase
 * Order's 13+ columns) gets squeezed by the browser's auto table layout to
 * fit the visible width, shrinking every select/input down to a sliver that
 * shows one truncated character - exactly the "fields not visible" problem.
 * Giving each column an explicit floor, combined with min-w-full (not
 * w-full) on the <table> itself, lets wide line grids grow past the
 * container and scroll horizontally (the wrapping div is overflow-x-auto)
 * instead of being crushed - while a normal 5-6 column grid (Material
 * Request, say) still renders exactly as before, evenly filling the width.
 */
function lineColMinWidth(f: DocFieldConfig): number {
  if (f.compact) return 90;
  switch (f.type) {
    case "select":
      return 170;
    case "textarea":
      return 180;
    case "readonly":
      return 110;
    case "date":
      return 140;
    default:
      return 150;
  }
}

export function DocumentScreen({
  title,
  description,
  basePath,
  listColumns,
  headerFields,
  lineFields,
  emptyLine,
  lifecycle,
  createDefaults,
  editableStatuses = ["Draft"],
  deletableStatuses = ["Draft"],
  onLineFieldChange,
  onHeaderFieldChange,
  attachmentsModuleCode,
  statusFlow,
  lineWarnings,
  filters,
  searchAccessor,
  searchPlaceholder,
  dateRangeFilter,
  linesExtra,
}: {
  title: string;
  description: string;
  basePath: string;
  listColumns: { key: string; label: string; render?: (row: any) => any }[];
  headerFields: DocFieldConfig[];
  lineFields: DocFieldConfig[];
  emptyLine: Record<string, any>;
  lifecycle: LifecycleStep[];
  createDefaults?: Record<string, any>;
  /** Statuses that still allow editing the whole document (header + lines). Default: Draft only, matching every module's submit route. */
  editableStatuses?: string[];
  /** Statuses that still allow deleting the document outright. Default: Draft only. */
  deletableStatuses?: string[];
  /** Fires after any line field changes, with the row's latest values - lets the caller react (e.g. fetch that item's packing-unit options when itemId changes). editingId is the id of the document currently being edited (null when creating new) - useful for a duplicate/lookup check the caller wants to exclude this same document from. */
  onLineFieldChange?: (index: number, key: string, value: any, row: Record<string, any>, editingId: string | null) => void;
  /** Fires after any header field changes, with the header's latest values - lets the caller track things like "which branch is currently selected" for use inside onLineFieldChange (e.g. an available-stock lookup needs both the line's itemId and the header's branchId, but the two live in separate state owned by this component). May optionally return a partial object of other header fields to auto-set at the same time (e.g. picking a vendor auto-fills its default currency/payment terms) - ignored when called from the edit-seeding pass, where the record's own saved values already take precedence. */
  onHeaderFieldChange?: (key: string, value: any, header: Record<string, any>) => void | Record<string, any>;
  /** Passed straight to DocumentAttachments as moduleCode - opts this document into the same upload/download/delete panel Vendors/Customers use. Omit to leave attachments off for a screen that doesn't need them. */
  attachmentsModuleCode?: string;
  /** Ordered list of statuses that make up the normal happy-path (e.g. ["Draft","Submitted","Approved"]) - renders as a progress stepper in the detail view. Side-branch statuses like Rejected/Cancelled just fall back to the plain badge. */
  statusFlow?: string[];
  /** Caller-owned map of line index -> warning message (e.g. "Item already has an open MR for this branch"), rendered as an inline banner row directly under that line in the form view. The caller decides when to populate/clear it, typically from onLineFieldChange - kept generic here so any future document screen can reuse the same duplicate-check/stock-check UX. */
  lineWarnings?: Record<number, string>;
  /** Per-screen select filters shown above the list - e.g. Vendor on Purchase Orders, Priority on Material Requests. Omit whichever don't apply to this document type. */
  filters?: ListFilterConfig[];
  /** Combines whatever fields should be free-text searchable (transaction no., counterparty name/code, title, ...) into one lowercase string per row - e.g. (r) => `${r.poNo} ${r.vendor?.code} ${r.vendor?.name}`. Omit to hide the search box entirely. */
  searchAccessor?: (row: any) => string;
  searchPlaceholder?: string;
  /** Adds a From/To date range filter against this document's own transaction date (e.g. requestDate, poDate). */
  dateRangeFilter?: DateRangeFilterConfig;
  /**
   * Renders extra UI just above the Line Items grid in the create/edit form
   * only (e.g. a "Pull from Approved MR" picker panel for Purchase Orders) -
   * given the current header values (so the caller can scope its own lookup,
   * e.g. by branch) and an addLines() helper that appends one or more rows
   * to the line grid in one go (replacing the single still-empty starter row
   * if that's all that's there, so bulk-adding into a fresh form doesn't
   * leave a stray blank line at the top).
   */
  linesExtra?: (ctx: { header: Record<string, any>; lines: Record<string, any>[]; addLines: (rows: Record<string, any>[]) => void }) => any;
}) {
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // List search/filter/selection - all client-side over the (up to 200)
  // rows already fetched by load() below, so filtering never needs its own
  // round trip. Selection persists across filter changes; exporting always
  // re-checks selectedIds against whatever's currently in `rows`, so a
  // stale id from a deleted record just quietly drops out.
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [header, setHeader] = useState<Record<string, any>>(createDefaults ?? {});
  const [lines, setLines] = useState<Record<string, any>[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<any | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse<any>>(`${basePath}?pageSize=200`);
      setRows(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load list");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  function fieldInputValue(row: Record<string, any>, f: DocFieldConfig) {
    const v = row[f.key];
    return f.type === "date" ? toDateInputValue(v) : v ?? "";
  }

  function openCreate() {
    setEditingId(null);
    setHeader(createDefaults ?? {});
    setLines([{ ...emptyLine }]);
    setError(null);
    setView("form");
  }

  function openEdit(record: any) {
    setEditingId(record.id);
    const nextHeader: Record<string, any> = {};
    for (const f of headerFields) nextHeader[f.key] = fieldInputValue(record, f);
    setHeader(nextHeader);
    // Seed the caller's own shadow copy of the header too (see
    // onHeaderFieldChange) - otherwise a line-level lookup like available
    // stock keeps using whatever branch was last active on screen instead
    // of the branch this record actually belongs to, until the user
    // happens to re-touch the Branch field themselves.
    for (const f of headerFields) onHeaderFieldChange?.(f.key, nextHeader[f.key], nextHeader);
    const recordLines = (record.lines ?? []).length ? record.lines : [emptyLine];
    setLines(
      recordLines.map((line: any) => {
        const row: Record<string, any> = {};
        for (const f of lineFields) if (f.type !== "readonly") row[f.key] = fieldInputValue(line, f);
        return row;
      })
    );
    setError(null);
    setView("form");
  }

  async function openDetail(id: string) {
    setError(null);
    setDetail(null);
    setConfirmingDelete(false);
    setView("detail");
    try {
      const record = await api.get<any>(`${basePath}/${id}`);
      setDetail(record);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this record");
    }
  }

  function backToList() {
    setView("list");
    setDetail(null);
    setError(null);
    setConfirmingDelete(false);
  }

  function setLineValue(index: number, key: string, value: any) {
    setLines((prev) => {
      const next = prev.map((l, i) => (i === index ? { ...l, [key]: value } : l));
      onLineFieldChange?.(index, key, value, next[index], editingId);
      return next;
    });
  }

  function setHeaderValue(key: string, value: any) {
    setHeader((prev) => {
      const next = { ...prev, [key]: value };
      const extra = onHeaderFieldChange?.(key, value, next);
      return extra ? { ...next, ...extra } : next;
    });
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  /** Bulk-append rows (e.g. from an MR picker) - drops the lone still-empty starter row first so a fresh form doesn't end up with a stray blank line ahead of the picked ones. */
  function addLines(rows: Record<string, any>[]) {
    if (rows.length === 0) return;
    setLines((prev) => {
      const isBlankStarter = prev.length === 1 && Object.keys(prev[0]).every((k) => !prev[0][k]);
      return [...(isBlankStarter ? [] : prev), ...rows];
    });
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const cleanLines = lines.map((l) => {
        const out: Record<string, any> = {};
        for (const f of lineFields) {
          if (f.type === "readonly") continue;
          const v = l[f.key];
          if (v === "" || v === undefined || v === null) continue;
          out[f.key] = f.type === "number" ? Number(v) : v;
        }
        return out;
      });
      const cleanHeader: Record<string, any> = {};
      for (const f of headerFields) {
        const v = header[f.key];
        if (v === "" || v === undefined || v === null) continue;
        cleanHeader[f.key] = f.type === "number" ? Number(v) : v;
      }
      if (editingId) {
        await api.put(`${basePath}/${editingId}`, { ...cleanHeader, lines: cleanLines });
      } else {
        await api.post(basePath, { ...cleanHeader, lines: cleanLines });
      }
      setView("list");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this document");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    setDeleting(true);
    setError(null);
    try {
      await api.del(`${basePath}/${detail.id}`);
      setView("list");
      setConfirmingDelete(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this document");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function runLifecycleAction(step: LifecycleStep) {
    if (!detail) return;
    if (step.confirmMessage && !window.confirm(step.confirmMessage)) return;
    setActionBusy(step.action);
    setError(null);
    const id = detail.id;
    try {
      await api.post<any>(`${basePath}/${id}/${step.action}`, {});
      // Re-fetch via GET /:id rather than trusting the action route's own
      // response body - some lifecycle routes (submit especially) return a
      // bare record without the relations the GET endpoint includes, which
      // would otherwise make lines/requester/branch flicker away right
      // after the click.
      await openDetail(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${step.label.toLowerCase()}`);
    } finally {
      setActionBusy(null);
    }
  }

  const filteredRows = rows.filter((row) =>
    matchesRowFilters(row, { search, searchAccessor, filters, filterValues, dateRangeFilter, dateFrom, dateTo })
  );

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const r of filteredRows) next.delete(r.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of filteredRows) next.add(r.id);
      return next;
    });
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setFilterValues({});
    setDateFrom("");
    setDateTo("");
  }

  // Exports whatever's selected; with nothing selected, exports every
  // currently-filtered row instead (so the button is never a dead end).
  function handleExport() {
    const selectedRows = filteredRows.filter((r) => selectedIds.has(r.id));
    exportRowsToExcel(listColumns, selectedRows.length > 0 ? selectedRows : filteredRows, title);
  }

  // Hex approximations of SECTION_PALETTE, since the print window is a
  // standalone document (no Tailwind stylesheet available in it) - keeps the
  // printed header visually matching the on-screen sectioned panels.
  const PRINT_SECTION_COLORS = ["#eff6ff", "#f0f9ff", "#fffbeb", "#f5f3ff"];
  const PRINT_SECTION_BORDERS = ["#bfdbfe", "#bae6fd", "#fde68a", "#ddd6fe"];

  function printRecord(record: any) {
    const win = window.open("", "_blank");
    if (!win) return;
    // Derived from this specific record rather than the outer hasBaseQty/hasNumericLine
    // consts, which are based on `detail` - null while printing straight from the list
    // row (printRow), so relying on them there would silently drop the base-unit column.
    const recHasBaseQty = (record.lines ?? []).some((l: any) => l.baseQty != null);
    const recHasNumericLine = lineFields.some((f) => f.type === "number");
    const recDocNo = record.mrNo ?? record.poNo ?? record.grnNo ?? record.transferNo ?? record.adjustmentNo ?? record.id;
    const sections = groupBySection(headerFields);
    const sectionPanels = sections
      .map((group, i) => {
        const rows = group.fields
          .map(
            (f) =>
              `<tr><td style="padding:3px 0;color:#666;">${f.label}</td><td style="padding:3px 0 3px 8px;font-weight:600;text-align:right;">${
                f.type === "select" ? resolveDisplayValue(f, record) : String(record[f.key] ?? "-")
              }</td></tr>`
          )
          .join("");
        const bg = PRINT_SECTION_COLORS[i % PRINT_SECTION_COLORS.length];
        const bd = PRINT_SECTION_BORDERS[i % PRINT_SECTION_BORDERS.length];
        return `<td style="vertical-align:top;padding:0 6px 0 0;">
          <div style="border:1px solid ${bd};border-radius:6px;overflow:hidden;">
            <div style="background:${bg};border-bottom:1px solid ${bd};padding:6px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.03em;">${group.section}</div>
            <table style="width:100%;font-size:12px;padding:8px 10px;box-sizing:border-box;"><tbody>${rows}</tbody></table>
          </div>
        </td>`;
      })
      .join("");
    const lineHeaderCells = ["#", ...lineFields.map((f) => f.label), ...(recHasBaseQty ? ["In base unit"] : [])]
      .map((h) => `<th style="padding:6px 10px;border:1px solid #ddd;background:#f3f4f6;text-align:left;">${h}</th>`)
      .join("");
    const lineBodyRows = (record.lines ?? [])
      .map((line: any, i: number) => {
        const cells = [
          String(i + 1),
          ...lineFields.map((f) =>
            f.type === "readonly" ? f.computed?.(line) ?? "-" : f.type === "select" ? resolveDisplayValue(f, line) : String(line[f.key] ?? "-")
          ),
          ...(recHasBaseQty ? [line.baseQty != null ? `${line.baseQty} ${line.item?.baseUom?.code ?? ""}` : "-"] : []),
        ];
        return `<tr${i % 2 === 1 ? ' style="background:#fafafa;"' : ""}>${cells.map((c) => `<td style="padding:6px 10px;border:1px solid #ddd;">${c}</td>`).join("")}</tr>`;
      })
      .join("");
    const totalsRow = recHasNumericLine
      ? `<tr>${["Total", ...lineFields.map((f) => (f.type === "number" ? String(sumNumericField(record.lines ?? [], f.key)) : "")), ...(recHasBaseQty ? [""] : [])]
          .map((c) => `<td style="padding:6px 10px;border:1px solid #ddd;font-weight:700;">${c}</td>`)
          .join("")}</tr>`
      : "";
    const metaBits = [
      record.title,
      `Status: ${record.status}`,
      record.requester ? `Created by ${record.requester.displayName}` : null,
      record.approvedBy ? `Approved by ${record.approvedBy.displayName}${record.approvedAt ? ` on ${new Date(record.approvedAt).toLocaleString()}` : ""}` : null,
    ].filter(Boolean);
    win.document.write(`
      <html>
        <head>
          <title>${recDocNo}</title>
          <style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111;} table{border-collapse:collapse;} h1{margin-bottom:2px;} .meta{color:#666;font-size:12px;margin-bottom:14px;} .lines{width:100%;font-size:12px;margin-top:18px;}</style>
        </head>
        <body>
          <h1>${title} - ${recDocNo}</h1>
          <div class="meta">${metaBits.join(" &middot; ")}</div>
          <table style="width:100%;"><tbody><tr>${sectionPanels}</tr></tbody></table>
          <table class="lines"><thead><tr>${lineHeaderCells}</tr></thead><tbody>${lineBodyRows}${totalsRow}</tbody></table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  function printDocument() {
    if (detail) printRecord(detail);
  }

  async function printRow(id: string, e: { stopPropagation: () => void }) {
    e.stopPropagation();
    try {
      const record = await api.get<any>(`${basePath}/${id}`);
      printRecord(record);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this record to print");
    }
  }

  function renderFieldInput(f: DocFieldConfig, row: Record<string, any>, onChange: (value: any) => void, rowOptions?: { value: string; label: string }[]) {
    if (f.type === "readonly") {
      return <div className="px-1 py-2 text-sm text-gray-500">{f.computed?.(row) ?? "-"}</div>;
    }
    const disabledCls = f.disabled ? "bg-gray-100 text-gray-500" : "";
    const compactCls = f.compact ? "max-w-[110px]" : "";
    if (f.type === "select") {
      const opts = rowOptions ?? f.options ?? [];
      return (
        <select
          className={`${COMPACT_FIELD_CLASS} ${disabledCls} ${compactCls}`}
          value={row[f.key] ?? ""}
          disabled={f.disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === "textarea") {
      return (
        <textarea
          className={`${COMPACT_FIELD_CLASS} ${disabledCls}`}
          rows={2}
          placeholder={f.placeholder}
          value={row[f.key] ?? ""}
          disabled={f.disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    return (
      <input
        type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
        className={`${COMPACT_FIELD_CLASS} ${disabledCls} ${compactCls}`}
        placeholder={f.placeholder}
        value={row[f.key] ?? ""}
        disabled={f.disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const hasBaseQty = (detail?.lines ?? []).some((l: any) => l.baseQty != null);
  const hasNumericLine = lineFields.some((f) => f.type === "number");
  const docNo = detail && (detail.mrNo ?? detail.poNo ?? detail.grnNo ?? detail.transferNo ?? detail.adjustmentNo ?? detail.id);
  const headerSections = groupBySection(headerFields);

  return (
    <div className="mx-auto max-w-6xl">
      {view === "list" && (
        <>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-navy-900">{title}</h1>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleExport}
                disabled={filteredRows.length === 0}
                title={selectedIds.size > 0 ? "Export selected rows to Excel" : "Export all listed rows to Excel"}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <FileSpreadsheet size={15} />
                {selectedIds.size > 0 ? `Export selected (${selectedIds.size})` : "Export to Excel"}
              </button>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
              >
                <Plus size={16} />
                New
              </button>
            </div>
          </div>

          <ListFilterBar
            search={search}
            onSearchChange={searchAccessor ? setSearch : undefined}
            searchPlaceholder={searchPlaceholder}
            filters={filters}
            filterValues={filterValues}
            onFilterChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
            dateRangeFilter={dateRangeFilter}
            dateFrom={dateFrom}
            onDateFromChange={setDateFrom}
            dateTo={dateTo}
            onDateToChange={setDateTo}
            onClear={clearFilters}
          />

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </th>
                  {listColumns.map((c) => (
                    <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={listColumns.length + 2} className="px-4 py-6 text-center text-gray-400">
                      Loading...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={listColumns.length + 2} className="px-4 py-6 text-center text-gray-400">
                      {rows.length === 0 ? "No records yet." : "No records match these filters."}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openDetail(row.id)}
                      className="cursor-pointer transition-colors hover:bg-brand-50"
                    >
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelectOne(row.id)} />
                      </td>
                      {listColumns.map((c) => (
                        <td key={c.key} className="px-4 py-2.5 text-navy-900">
                          {c.render ? c.render(row) : c.key === "status" ? <StatusBadge status={row.status} /> : String(row[c.key] ?? "-")}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={(e) => printRow(row.id, e)}
                          title="Print"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-navy-900"
                        >
                          <Printer size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "form" && (
        <>
          <button onClick={backToList} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
            <ArrowLeft size={16} />
            Back to list
          </button>
          <div className="mb-5 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <h1 className="text-xl font-bold text-navy-900">
                {editingId ? `Edit ${title.replace(/s$/, "")}` : `New ${title.replace(/s$/, "")}`}
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">{description}</p>
            </div>
            {/* Edit is only reachable from a Draft record (see editableStatuses), and a brand-new document always starts life as Draft too. */}
            <StatusBadge status="Draft" />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="mb-5 grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {headerSections.map((group, i) => {
              const palette = SECTION_PALETTE[i % SECTION_PALETTE.length];
              return (
                <div key={group.section} className={`rounded-xl border ${palette.border} ${palette.bg} p-4 shadow-sm`}>
                  <div className={`mb-3 border-b ${palette.divider} pb-2 text-[11px] font-semibold uppercase tracking-wide ${palette.title}`}>
                    {group.section}
                  </div>
                  <div className="space-y-1.5">
                    {group.fields.map((f) => (
                      <div key={f.key} className="flex items-center gap-2">
                        <label className={`${COMPACT_LABEL_CLASS} w-[38%] shrink-0`}>
                          {f.label}
                          {f.required && <span className="text-red-500"> *</span>}
                        </label>
                        <div className="min-w-0 flex-1">{renderFieldInput(f, header, (value) => setHeaderValue(f.key, value))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {linesExtra?.({ header, lines, addLines })}

          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">Line Items</div>
              <button
                onClick={addLine}
                className="flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100"
              >
                <Plus size={13} />
                Add line
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="w-8 border-b border-gray-200 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">#</th>
                    {lineFields.map((f) => (
                      <th
                        key={f.key}
                        style={{ minWidth: lineColMinWidth(f) }}
                        className="border-b border-l border-gray-200 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {f.label}
                      </th>
                    ))}
                    <th className="border-b border-l border-gray-200"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <Fragment key={i}>
                      <tr className={i % 2 === 1 ? "bg-gray-50/50" : ""}>
                        <td className="border-b border-gray-100 px-2 py-1.5 text-xs text-gray-400">{i + 1}</td>
                        {lineFields.map((f) => (
                          <td key={f.key} style={{ minWidth: lineColMinWidth(f) }} className="border-b border-l border-gray-100 px-2 py-1.5">
                            {renderFieldInput(f, line, (value) => setLineValue(i, f.key, value), f.optionsForRow?.(line))}
                          </td>
                        ))}
                        <td className="border-b border-l border-gray-100 px-2 py-1.5">
                          <button
                            onClick={() => removeLine(i)}
                            disabled={lines.length === 1}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                      {lineWarnings?.[i] && (
                        <tr>
                          <td colSpan={lineFields.length + 2} className="border-b border-amber-100 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                            {lineWarnings[i]}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
                {hasNumericLine && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total</td>
                      {lineFields.map((f) => (
                        <td key={f.key} style={{ minWidth: lineColMinWidth(f) }} className="border-l border-gray-200 px-2 py-1.5 text-sm font-semibold text-navy-900">
                          {f.type === "number" ? sumNumericField(lines, f.key) : ""}
                        </td>
                      ))}
                      <td className="border-l border-gray-200"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={backToList} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : editingId ? "Save changes" : "Save as Draft"}
            </button>
          </div>
        </>
      )}

      {view === "detail" && (
        <>
          <button onClick={backToList} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-navy-900">
            <ArrowLeft size={16} />
            Back to list
          </button>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          {!detail ? (
            <div className="py-10 text-center text-gray-400">Loading...</div>
          ) : (
            <>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-navy-900">{docNo}</h1>
                  {detail.title && <span className="text-sm text-gray-500">- {detail.title}</span>}
                  <StatusBadge status={detail.status} />
                </div>
                <div className="flex gap-2">
                  {lifecycle
                    .filter((step) => step.fromStatus === detail.status)
                    .map((step) => (
                      <button
                        key={step.action}
                        onClick={() => runLifecycleAction(step)}
                        disabled={actionBusy === step.action}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                      >
                        {actionBusy === step.action ? "..." : step.label}
                      </button>
                    ))}
                  <button
                    onClick={printDocument}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Printer size={14} />
                    Print
                  </button>
                  {editableStatuses.includes(detail.status) && (
                    <button
                      onClick={() => openEdit(detail)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  )}
                  {deletableStatuses.includes(detail.status) && (
                    <button
                      onClick={() => setConfirmingDelete(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {statusFlow && <Stepper steps={statusFlow} current={detail.status} />}

              {confirmingDelete && (
                <div className="mb-5 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="text-sm text-red-700">Delete this document permanently? This can't be undone.</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-5 grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {headerSections.map((group, i) => {
                  const palette = SECTION_PALETTE[i % SECTION_PALETTE.length];
                  return (
                    <div key={group.section} className={`rounded-xl border ${palette.border} ${palette.bg} p-4 shadow-sm`}>
                      <div className={`mb-3 border-b ${palette.divider} pb-2 text-[11px] font-semibold uppercase tracking-wide ${palette.title}`}>
                        {group.section}
                      </div>
                      <div className="space-y-1.5">
                        {group.fields.map((f) => (
                          <div key={f.key} className="flex items-baseline gap-2">
                            <div className={`${COMPACT_LABEL_CLASS} w-[38%] shrink-0`}>{f.label}</div>
                            <div className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-navy-900">
                              {f.type === "select" ? resolveDisplayValue(f, detail) : String(detail[f.key] ?? "-")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {(detail.requester || detail.approvedBy || detail.createdAt) && (
                <div className="mb-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs">
                  {detail.requester && (
                    <div>
                      <span className="font-semibold uppercase tracking-wide text-gray-500">Created by </span>
                      <span className="text-navy-900">{detail.requester.displayName}</span>
                    </div>
                  )}
                  {detail.createdAt && (
                    <div>
                      <span className="font-semibold uppercase tracking-wide text-gray-500">Created on </span>
                      <span className="text-navy-900">{new Date(detail.createdAt).toLocaleString()}</span>
                    </div>
                  )}
                  {detail.approvedBy && (
                    <div>
                      <span className="font-semibold uppercase tracking-wide text-gray-500">Approved by </span>
                      <span className="text-navy-900">{detail.approvedBy.displayName}</span>
                    </div>
                  )}
                  {detail.approvedAt && (
                    <div>
                      <span className="font-semibold uppercase tracking-wide text-gray-500">Approved on </span>
                      <span className="text-navy-900">{new Date(detail.approvedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 border-b border-gray-100 pb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">Line Items</div>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="w-8 border-b border-gray-200 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">#</th>
                        {lineFields.map((f) => (
                          <th
                            key={f.key}
                            style={{ minWidth: lineColMinWidth(f) }}
                            className="border-b border-l border-gray-200 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500"
                          >
                            {f.label}
                          </th>
                        ))}
                        {hasBaseQty && (
                          <th className="border-b border-l border-gray-200 px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                            In base unit
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.lines ?? []).map((line: any, i: number) => (
                        <tr key={line.id ?? i} className={i % 2 === 1 ? "bg-gray-50/50" : ""}>
                          <td className="border-b border-gray-100 px-2 py-1.5 text-xs text-gray-400">{i + 1}</td>
                          {lineFields.map((f) => (
                            <td key={f.key} style={{ minWidth: lineColMinWidth(f) }} className="border-b border-l border-gray-100 px-2 py-1.5 text-navy-900">
                              {f.type === "readonly"
                                ? f.computed?.(line) ?? "-"
                                : f.type === "select"
                                  ? resolveDisplayValue(f, line)
                                  : String(line[f.key] ?? "-")}
                            </td>
                          ))}
                          {hasBaseQty && (
                            <td className="border-b border-l border-gray-100 px-2 py-1.5 text-gray-500">
                              {line.baseQty != null
                                ? `${line.baseQty} ${line.item?.baseUom?.code ?? ""}`
                                : "no conversion set up"}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {hasNumericLine && (
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                          <td className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Total</td>
                          {lineFields.map((f) => (
                            <td key={f.key} style={{ minWidth: lineColMinWidth(f) }} className="border-l border-gray-200 px-2 py-1.5 text-sm font-semibold text-navy-900">
                              {f.type === "number" ? sumNumericField(detail.lines ?? [], f.key) : ""}
                            </td>
                          ))}
                          {hasBaseQty && <td className="border-l border-gray-200"></td>}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {attachmentsModuleCode && <DocumentAttachments moduleCode={attachmentsModuleCode} recordId={detail.id} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
