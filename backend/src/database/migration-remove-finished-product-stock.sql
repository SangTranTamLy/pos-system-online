-- Chạy SAU migration-product-recipes-v1.sql trên MySQL 8.0.46.
-- CẢNH BÁO: Hai bảng dưới đây là dữ liệu tồn kho thành phẩm cũ.
-- Sao lưu cơ sở dữ liệu trước khi chạy nếu cần lưu lịch sử đó.
-- Không dùng START TRANSACTION vì ALTER/DROP TABLE trong MySQL tự động COMMIT.

DROP TABLE IF EXISTS waste_transactions;
DROP TABLE IF EXISTS stock_transactions;

ALTER TABLE products
  DROP COLUMN stock_quantity,
  DROP COLUMN is_tracked_stock;

ALTER TABLE categories
  DROP COLUMN is_tracked_stock;
