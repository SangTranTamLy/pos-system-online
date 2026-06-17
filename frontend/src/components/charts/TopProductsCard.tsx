export type TopProduct = {
  name: string;
  sold: string;
  width: string;
};

type TopProductsCardProps = {
  products: TopProduct[];
};

export default function TopProductsCard({ products }: TopProductsCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h4 className="mb-4 font-['Plus_Jakarta_Sans',sans-serif] font-bold text-[#0b1c30]">
        Ban chay nhat
      </h4>
      <div className="space-y-3">
        {products.map((product) => (
          <div key={product.name} className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-[#0b1c30]">
              <span>{product.name}</span>
              <span className="text-slate-400">{product.sold}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#f97316]" style={{ width: product.width }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
