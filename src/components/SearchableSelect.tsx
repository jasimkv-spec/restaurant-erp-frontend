import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Type-to-filter replacement for a plain <select> - built for pickers whose
 * option list can grow into the hundreds (items, vendors, customers) where
 * scrolling a native dropdown to find one entry gets impractical. Typing 2-3
 * letters narrows the list to matching labels; clicking a row (or Enter,
 * which picks the top match) sets the value. Falls back to showing every
 * option when the box is empty, so it still works exactly like a normal
 * dropdown for short lists (Company, Branch, Tax Mode, ...).
 *
 * Deliberately a plain text input + absolutely-positioned list rather than
 * the native <select>, since <select>'s own options can't be filtered by
 * the browser as the user types more than one key at a time.
 *
 * The option list is rendered through a portal into document.body with
 * position:fixed coordinates computed from the input's own bounding box,
 * rather than nested + absolutely-positioned inside this component's own
 * markup. Every line-item grid on a transaction screen sits inside an
 * overflow-x-auto wrapper (needed so wide grids scroll instead of being
 * crushed - see DocumentScreen's line table), and per the CSS overflow
 * spec, setting overflow-x to anything but visible forces overflow-y to
 * "auto" too - so a plain absolutely-positioned dropdown gets silently
 * clipped/scrolled by that wrapper instead of floating over the page. A
 * fixed-position portal escapes that ancestor entirely.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Type to search...",
  disabled,
  className,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  function updateRect() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  useLayoutEffect(() => {
    if (open) updateRect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (inputRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    // Keep the floating list glued to the input if the page (or a scrollable
    // ancestor like the grid's own overflow-x-auto wrapper) scrolls while open,
    // instead of drifting away from what it's supposed to be anchored to.
    function handleScrollOrResize() {
      updateRect();
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const filtered = (needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options).slice(0, 50);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className={className}
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? "")}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (filtered.length > 0) pick(filtered[0].value);
          }
        }}
      />
      {open && !disabled && rect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: Math.max(rect.width, 200) }}
            className="z-50 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {value && (
              <div
                onClick={() => pick("")}
                className="cursor-pointer border-b border-gray-100 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
              >
                Clear selection
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">No matches</div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.value}
                  onClick={() => pick(o.value)}
                  className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-brand-50 ${
                    o.value === value ? "bg-brand-50 font-semibold text-brand-700" : "text-navy-900"
                  }`}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
