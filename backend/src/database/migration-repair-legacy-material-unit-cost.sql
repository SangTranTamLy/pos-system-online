-- Sửa dữ liệu cũ được nhập trước khi có cơ chế đơn vị nhập/quy đổi tồn.
-- Chỉ tác động các dòng chi tiết cũ có conversion_factor = 1 nhưng nguyên liệu
-- hiện đã được cấu hình hệ số quy đổi khác 1. Có thể chạy một lần.

START TRANSACTION;

CREATE TEMPORARY TABLE legacy_material_unit_repairs AS
SELECT DISTINCT rm.id, rm.purchase_to_stock_factor AS conversion_factor
FROM raw_materials rm
JOIN goods_receipt_material_details grmd ON grmd.material_id = rm.id
WHERE rm.purchase_to_stock_factor <> 1
  AND grmd.conversion_factor = 1
  AND grmd.purchase_unit = rm.purchase_unit
  AND grmd.unit_price > 0
  AND rm.import_price >= grmd.unit_price * 0.99;

-- Tồn và giá vốn hiện tại vẫn đang theo đơn vị nhập cũ, nên quy đổi về đơn vị tồn.
UPDATE raw_materials rm
JOIN legacy_material_unit_repairs repair ON repair.id = rm.id
SET rm.stock_quantity = rm.stock_quantity * repair.conversion_factor,
    rm.import_price = rm.import_price / repair.conversion_factor;

-- Sửa lịch sử phiếu nhập để phần quy đổi hiển thị nhất quán.
UPDATE goods_receipt_material_details grmd
JOIN raw_materials rm ON rm.id = grmd.material_id
JOIN legacy_material_unit_repairs repair ON repair.id = rm.id
SET grmd.conversion_factor = repair.conversion_factor,
    grmd.stock_quantity = grmd.quantity * repair.conversion_factor
WHERE grmd.conversion_factor = 1
  AND grmd.purchase_unit = rm.purchase_unit;

DROP TEMPORARY TABLE legacy_material_unit_repairs;

COMMIT;
