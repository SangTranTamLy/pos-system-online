-- Quy ước sau migration:
--   raw_materials.unit: đơn vị tồn kho và định mức công thức (ml, g, cái...)
--   raw_materials.purchase_unit: đơn vị nhà cung cấp bán (lon, bịch, chai...)
--   purchase_to_stock_factor: 1 đơn vị nhập tương ứng bao nhiêu đơn vị tồn.
-- Chạy một lần trên cơ sở dữ liệu đã có migration-product-recipes-v1.sql.

START TRANSACTION;

ALTER TABLE raw_materials
  ADD COLUMN purchase_unit VARCHAR(30) NULL AFTER unit,
  ADD COLUMN purchase_to_stock_factor DECIMAL(14,3) NOT NULL DEFAULT 1.000 AFTER purchase_unit,
  MODIFY COLUMN stock_quantity DECIMAL(14,3) NOT NULL DEFAULT 0.000,
  MODIFY COLUMN min_stock DECIMAL(14,3) NOT NULL DEFAULT 0.000;

UPDATE raw_materials
SET purchase_unit = unit
WHERE purchase_unit IS NULL OR TRIM(purchase_unit) = '';

ALTER TABLE raw_materials
  MODIFY COLUMN purchase_unit VARCHAR(30) NOT NULL;

ALTER TABLE goods_receipt_material_details
  MODIFY COLUMN quantity DECIMAL(14,3) NOT NULL,
  ADD COLUMN purchase_unit VARCHAR(30) NULL AFTER material_id,
  ADD COLUMN conversion_factor DECIMAL(14,3) NULL AFTER purchase_unit,
  ADD COLUMN stock_quantity DECIMAL(14,3) NULL AFTER quantity;

UPDATE goods_receipt_material_details grmd
JOIN raw_materials rm ON rm.id = grmd.material_id
SET grmd.purchase_unit = rm.unit,
    grmd.conversion_factor = 1.000,
    grmd.stock_quantity = grmd.quantity
WHERE grmd.purchase_unit IS NULL
   OR grmd.conversion_factor IS NULL
   OR grmd.stock_quantity IS NULL;

ALTER TABLE goods_receipt_material_details
  MODIFY COLUMN purchase_unit VARCHAR(30) NOT NULL,
  MODIFY COLUMN conversion_factor DECIMAL(14,3) NOT NULL,
  MODIFY COLUMN stock_quantity DECIMAL(14,3) NOT NULL;

ALTER TABLE inventory_audit_details
  MODIFY COLUMN system_quantity DECIMAL(14,3) NOT NULL,
  MODIFY COLUMN actual_quantity DECIMAL(14,3) NOT NULL,
  MODIFY COLUMN variance DECIMAL(14,3) NOT NULL;

COMMIT;
