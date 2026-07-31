"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export type MobileOption = {
  value: string;
  label: string;
};

export function MobileOptionPicker({
  disabled = false,
  id,
  label,
  options,
  searchable = true,
  value,
  onChange
}: {
  disabled?: boolean;
  id?: string;
  label: string;
  options: MobileOption[];
  searchable?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const searchInputId = `mobile-picker-search-${label.toLowerCase().replaceAll(" ", "-")}`;
  const filteredOptions = searchable && normalizedQuery
    ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
    : options;

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  function closePicker() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="mobile-picker">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="mobile-picker-trigger"
        disabled={disabled || options.length === 0}
        id={id}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span>{selectedOption?.label ?? "Select"}</span>
        <ChevronDown aria-hidden="true" size={18} />
      </button>
      {open ? (
        <div className="mobile-picker-overlay" onClick={closePicker}>
          <div className="mobile-picker-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-picker-heading">
              <strong>{label}</strong>
              <button aria-label={`Close ${label} picker`} className="icon-button" onClick={closePicker} type="button">
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            {searchable ? (
              <div className="mobile-picker-search-wrap">
                <label className="sr-only" htmlFor={searchInputId}>
                  Search {label}
                </label>
                <input
                  autoFocus
                  className="mobile-picker-search"
                  id={searchInputId}
                  placeholder="Search code or description"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            ) : null}
            <div className="mobile-picker-options" role="listbox" aria-label={label}>
              {filteredOptions.length === 0 ? (
                <div className="mobile-picker-empty">No matches found.</div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    aria-selected={option.value === value}
                    className={option.value === value ? "mobile-picker-option selected" : "mobile-picker-option"}
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      closePicker();
                    }}
                    role="option"
                    type="button"
                  >
                    <span>{option.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
