-- Chạy tệp này CHỈ khi migration-product-recipes-v1.sql phiên bản cũ
-- (có product_type và combo_items) đã được áp dụng cho cơ sở dữ liệu.
-- Không tác động đến combo khuyến mãi trong promotions/promotion_rules.

DROP TABLE IF EXISTS combo_items;

ALTER TABLE products
  DROP CHECK chk_products_product_type;

ALTER TABLE products
  DROP COLUMN product_type;
