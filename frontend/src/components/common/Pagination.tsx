import { type ReactNode } from "react";
import { Icon } from "../../layouts/AdminLayout";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemName: string;
};

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemName,
}: PaginationProps) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);

  function renderPageButtons() {
    const buttons: ReactNode[] = [];
    const maxVisible = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      buttons.push(
        <button
          key={1}
          type="button"
          onClick={() => onPageChange(1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          1
        </button>
      );
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis-start" className="flex h-9 w-9 items-center justify-center text-slate-400">
            …
          </span>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          type="button"
          onClick={() => onPageChange(i)}
          className={[
            "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold transition-colors",
            i === currentPage
              ? "bg-[#f97316] text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100",
          ].join(" ")}
        >
          {i}
        </button>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span key="ellipsis-end" className="flex h-9 w-9 items-center justify-center text-slate-400">
            …
          </span>
        );
      }
      buttons.push(
        <button
          key={totalPages}
          type="button"
          onClick={() => onPageChange(totalPages)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          {totalPages}
        </button>
      );
    }

    return buttons;
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row p-4 border-t border-slate-200 bg-white w-full">
      <p className="text-sm font-medium text-slate-500">
        Hiển thị {start}–{end === 0 ? "" : end} của{" "}
        <span className="font-bold text-[#0b1c30]">
          {totalItems.toLocaleString("vi-VN")}
        </span>{" "}
        {itemName} · {pageSize}/trang
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
        >
          <Icon name="chevron_left" className="text-[18px]" />
        </button>

        {renderPageButtons()}

        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
        >
          <Icon name="chevron_right" className="text-[18px]" />
        </button>
      </div>
    </div>
  );
}
