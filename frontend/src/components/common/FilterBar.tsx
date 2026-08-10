import type { ReactNode, FormEvent } from "react";
import { Icon } from "../../layouts/AdminLayout";

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  onClear?: () => void;
  afterClear?: ReactNode;
  onSubmit?: (event: FormEvent) => void;
  className?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  children,
  onClear,
  afterClear,
  onSubmit,
  className,
}: FilterBarProps) {
  const defaultClass = onSubmit
    ? "flex flex-col gap-3 sm:flex-row sm:items-center"
    : "grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_repeat(auto-fit,minmax(180px,1fr))_auto] lg:items-center";

  const appliedClass = className || defaultClass;

  const content = (
    <>
      {onSearchChange !== undefined ? (
        <div className="relative min-w-50 flex-1">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400"
          />
          <input
            value={search || ""}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-[#f97316] focus:bg-white focus:ring-2 focus:ring-orange-100"
          />
        </div>
      ) : null}

      {children}

      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-11.5 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Icon name="filter_alt_off" className="text-base" />
          Xóa lọc
        </button>
      ) : null}

      {afterClear}
    </>
  );

  if (onSubmit) {
    return (
      <form onSubmit={onSubmit} className={appliedClass}>
        {content}
      </form>
    );
  }

  return <div className={appliedClass}>{content}</div>;
}

export default FilterBar;
