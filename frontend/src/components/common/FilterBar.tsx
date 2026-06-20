import React from "react";
import { Icon } from "../../layouts/AdminLayout";

interface FilterBarProps {
  /** Search input value. If omitted, search input is not rendered. */
  search?: string;
  /** Search input change handler */
  onSearchChange?: (val: string) => void;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Additional filter controls (selects, datepickers, etc.) */
  children?: React.ReactNode;
  /** Callback to clear all filters. If omitted, the "Xóa lọc" button is not rendered. */
  onClear?: () => void;
  /** Callback for form submission (e.g. on Audit Logs search submit). If provided, wraps in a <form> */
  onSubmit?: (e: React.FormEvent) => void;
  /** Custom wrapper class names. If omitted, standard designs are applied. */
  className?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  children,
  onClear,
  onSubmit,
  className,
}: FilterBarProps) {
  // Determine standard layout grids based on the presence of onSubmit
  const defaultClass = onSubmit
    ? "flex flex-col gap-3 sm:flex-row sm:items-center"
    : "grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_repeat(auto-fit,minmax(180px,1fr))_auto] lg:items-center";

  const appliedClass = className || defaultClass;

  const content = (
    <>
      {onSearchChange !== undefined && (
        <div className="relative flex-1 min-w-[200px]">
          <Icon
            name="search"
            className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 text-[18px]"
          />
          <input
            value={search || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-10 text-sm outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
          />
        </div>
      )}

      {children}

      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-[46px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 shrink-0"
        >
          <Icon name="filter_alt_off" className="text-base" />
          Xóa lọc
        </button>
      )}
    </>
  );

  if (onSubmit) {
    return (
      <form onSubmit={onSubmit} className={appliedClass}>
        {content}
      </form>
    );
  }

  return (
    <div className={appliedClass}>
      {content}
    </div>
  );
}

export default FilterBar;
