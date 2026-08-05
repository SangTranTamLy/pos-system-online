-- Giá vốn theo đơn vị tồn (ml, g...) có thể là số lẻ VND.
-- Lưu 6 chữ số thập phân để không mất giá khi quy đổi từ đơn vị nhập.

START TRANSACTION;

ALTER TABLE raw_materials
  MODIFY COLUMN import_price DECIMAL(14,6) NOT NULL DEFAULT 0.000000;

-- Đồng bộ giá vốn hiện tại từ đơn giá của phiếu nhập gần nhất.
-- Đơn giá phiếu nhập vẫn là giá theo đơn vị nhập; import_price là giá theo đơn vị tồn.
UPDATE raw_materials rm
JOIN (
  SELECT grmd.material_id, grmd.unit_price, grmd.conversion_factor
  FROM goods_receipt_material_details grmd
  JOIN (
    SELECT material_id, MAX(created_at) AS latest_created_at
    FROM goods_receipt_material_details
    WHERE unit_price > 0 AND conversion_factor > 0
    GROUP BY material_id
  ) latest
    ON latest.material_id = grmd.material_id
   AND latest.latest_created_at = grmd.created_at
  WHERE grmd.unit_price > 0 AND grmd.conversion_factor > 0
) latest_price ON latest_price.material_id = rm.id
SET rm.import_price = latest_price.unit_price / latest_price.conversion_factor;

COMMIT;
