import { useEffect, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const needle = query.trim().toLowerCase();
  const filtered = (needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options).slice(0, 50);

  return (
    <div ref={containerRef} className="relative">
      <input
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
            if (filtered.length > 0) {
              onChange(filtered[0].value);
              setOpen(false);
              setQuery("");
            }
          }
        }}
      />
      {open && !disabled && (
        <div className="absolute z-20 mt-1 max-h-56 w-full min-w-[200px] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {value && (
            <div
              onClick={() => {
                onChange("");
                setOpen(false);
                setQuery("");
              }}
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
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
                className={`cursor-pointer px-3 py-1.5 text-sm hover:bg-brand-50 ${
                  o.value === value ? "bg-brand-50 font-semibold text-brand-700" : "text-navy-900"
                }`}
              >
                {o.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
