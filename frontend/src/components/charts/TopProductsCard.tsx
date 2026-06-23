export type TopProduct = {
  name: string;
  imageUrl?: string;
  sold: string;
  revenue: string;
};

type TopProductsCardProps = {
  products: TopProduct[];
};

export default function TopProductsCard({ products }: TopProductsCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-lg shadow-slate-200/40">
      <div className="mb-6 flex items-center justify-between">
        <h4 className="font-['Plus_Jakarta_Sans',sans-serif] font-black text-[14px] uppercase tracking-wider text-[#0b1c30]">
          TOP BÁN CHẠY
        </h4>
      </div>
      <div className="flex flex-col">
        {products.length > 0 ? (
          products.map((product, index) => (
            <div key={product.name} className="flex items-center gap-4 py-4 border-b border-slate-100 last:border-0 last:pb-0 first:pt-0">
              <span className="w-6 text-center font-black text-[#f97316] text-lg">{index + 1}</span>
              <div className="h-12 w-12 shrink-0 overflow-hidden bg-white flex items-center justify-center border border-slate-100 shadow-sm">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold italic">No IMG</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="truncate text-[13px] font-bold text-[#0b1c30]">{product.name}</h5>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{product.sold}</p>
              </div>
              <div className="text-right whitespace-nowrap pl-2">
                <p className="text-[13px] font-black text-[#f97316]">{product.revenue}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-sm font-semibold text-slate-400 py-4">Chưa có sản phẩm bán ra</p>
        )}
      </div>
    </div>
  );
}
