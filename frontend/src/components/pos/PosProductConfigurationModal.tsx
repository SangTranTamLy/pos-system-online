import { useState } from "react";
import type {
  ModifierOption,
  Product,
  ProductConfiguration,
  ProductVariant,
} from "../../api/product.api";
import { Icon } from "../../layouts/AdminLayout";

type Props = {
  product: Product;
  configuration: ProductConfiguration;
  onClose: () => void;
  onConfirm: (data: {
    variant: ProductVariant;
    modifiers: ModifierOption[];
    note: string;
    unitPrice: number;
  }) => void;
};

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export default function PosProductConfigurationModal({
  product,
  configuration,
  onClose,
  onConfirm,
}: Props) {
  const activeVariants = configuration.variants.filter(
    (item) => item.isActive !== false
  );
  const [variantId, setVariantId] = useState(
    activeVariants.find((item) => item.isDefault)?.id || activeVariants[0]?.id || ""
  );
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const variant = activeVariants.find((item) => item.id === variantId);
  const modifiers = configuration.modifierOptions.filter(
    (item) => modifierIds.includes(item.id) && item.isActive !== false
  );
  const unitPrice =
    Number(variant?.salePrice || 0) +
    modifiers.reduce((sum, item) => sum + Number(item.priceDelta), 0);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <p className="text-xs font-black uppercase text-[#f97316]">
              Tùy chọn món
            </p>
            <h3 className="text-xl font-black text-[#0b1c30]">{product.name}</h3>
          </div>
          <button type="button" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="max-h-[65vh] space-y-5 overflow-y-auto p-5">
          <section>
            <p className="mb-2 text-sm font-black text-[#0b1c30]">Size/biến thể</p>
            <div className="grid gap-2">
              {activeVariants.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center justify-between rounded-xl border p-3"
                >
                  <span className="flex items-center gap-3 font-bold">
                    <input
                      type="radio"
                      name="variant"
                      checked={variantId === item.id}
                      onChange={() => setVariantId(item.id)}
                    />
                    {item.name}
                  </span>
                  <span className="font-black text-[#f97316]">
                    {money(item.salePrice)}
                  </span>
                </label>
              ))}
            </div>
          </section>
          {configuration.modifierOptions.some((item) => item.isActive !== false) ? (
            <section>
              <p className="mb-2 text-sm font-black text-[#0b1c30]">
                Topping (có thể chọn nhiều)
              </p>
              <div className="grid gap-2">
                {configuration.modifierOptions
                  .filter((item) => item.isActive !== false)
                  .map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border p-3"
                    >
                      <span className="flex items-center gap-3 font-bold">
                        <input
                          type="checkbox"
                          checked={modifierIds.includes(item.id)}
                          onChange={(event) =>
                            setModifierIds((current) =>
                              event.target.checked
                                ? [...current, item.id]
                                : current.filter((id) => id !== item.id)
                            )
                          }
                        />
                        {item.name}
                      </span>
                      <span>+{money(item.priceDelta)}</span>
                    </label>
                  ))}
              </div>
            </section>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-sm font-black text-[#0b1c30]">
              Ghi chú chế biến
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 500))}
              rows={3}
              placeholder="Ví dụ: ít đá (ghi chú không thay đổi định mức)"
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
            />
          </label>
        </div>
        <div className="flex items-center justify-between border-t p-4">
          <div>
            <p className="text-xs text-slate-500 font-bold">Giá tạm tính</p>
            <p className="text-xl font-black text-[#f97316]">{money(unitPrice)}</p>
          </div>
          <button
            type="button"
            disabled={!variant}
            onClick={() =>
              variant && onConfirm({ variant, modifiers, note: note.trim(), unitPrice })
            }
            className="rounded-lg bg-[#f97316] px-5 py-2 font-bold text-white disabled:opacity-50"
          >
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </div>
  );
}
