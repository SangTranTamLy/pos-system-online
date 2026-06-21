-- =========================================================================
-- ĐỒ ÁN CƠ SỞ: HỆ THỐNG QUẢN LÝ BÁN HÀNG & KHO F&B (QUICKSERVE POS)
-- SCRIPT KHỞI TẠO DỮ LIỆU MẪU (SEED DATA) CHO PHÂN HỆ ĐỊNH LƯỢNG KHO F&B
-- =========================================================================

-- Tạm thời tắt Safe Update Mode để cho phép xóa/cập nhật hàng loạt dữ liệu mẫu
SET SQL_SAFE_UPDATES = 0;

-- 1. KHỞI TẠO DANH SÁCH NHÀ CUNG CẤP (SUPPLIERS)
INSERT IGNORE INTO suppliers (id, name, phone, contact_name, email, address) VALUES
('sup-1111-1111-1111-111111111111', 'Công ty Cà phê Trung Nguyên', '0901234567', 'Nguyễn Văn A', 'trungnguyen@cafe.com', 'Buôn Ma Thuột, Đắk Lắk'),
('sup-2222-2222-2222-222222222222', 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)', '0907654321', 'Trần Thị B', 'vinamilk@milk.com', 'Quận 7, TP. Hồ Chí Minh'),
('sup-3333-3333-3333-333333333333', 'Tổng kho Đường cát Biên Hòa', '0911223344', 'Lê Văn C', 'bienhoa@sugar.com', 'Biên Hòa, Đồng Nai');

-- 2. CẬP NHẬT CẢNH BÁO TỒN TỐI THIỂU (MIN_STOCK) & NCC CHO NGUYÊN LIỆU CÓ SẴN
UPDATE raw_materials SET min_stock = 5.00, supplier_id = 'sup-1111-1111-1111-111111111111' WHERE sku = 'NL-CAFE-HAT';
UPDATE raw_materials SET min_stock = 10.00, supplier_id = 'sup-2222-2222-2222-222222222222' WHERE sku = 'NL-SUA-DAC';
UPDATE raw_materials SET min_stock = 3.00, supplier_id = 'sup-3333-3333-3333-333333333333' WHERE sku = 'NL-DUONG-CAT';
UPDATE raw_materials SET min_stock = 15.00, supplier_id = 'sup-1111-1111-1111-111111111111' WHERE sku = 'NL-ROBUSTA';
UPDATE raw_materials SET min_stock = 20.00, supplier_id = 'sup-3333-3333-3333-333333333333' WHERE sku = 'NL-TRAN-CHAU';

-- 3. KHỞI TẠO BẢNG CÔNG THỨC ĐỊNH LƯỢNG (RECIPES)
-- Xóa dữ liệu định lượng cũ để chạy lại không bị lỗi trùng khóa UNIQUE
DELETE FROM recipes;

-- -------------------------------------------------------------------------
-- MÓN 1: Cà phê sữa đá pha máy (SKU: CF02)
-- Định lượng: 0.025 kg Hạt cà phê (NL-CAFE-HAT) & 0.040 lon Sữa đặc (NL-SUA-DAC)
-- -------------------------------------------------------------------------
INSERT INTO recipes (id, product_id, ingredient_id, quantity_needed)
SELECT 
  UUID(), 
  (SELECT id FROM products WHERE sku = 'CF02' LIMIT 1), 
  (SELECT id FROM raw_materials WHERE sku = 'NL-CAFE-HAT' LIMIT 1), 
  0.0250
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'CF02') 
  AND EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-CAFE-HAT');

INSERT INTO recipes (id, product_id, ingredient_id, quantity_needed)
SELECT 
  UUID(), 
  (SELECT id FROM products WHERE sku = 'CF02' LIMIT 1), 
  (SELECT id FROM raw_materials WHERE sku = 'NL-SUA-DAC' LIMIT 1), 
  0.0400
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'CF02') 
  AND EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-SUA-DAC');

-- -------------------------------------------------------------------------
-- MÓN 2: Cà phê đen đá nguyên chất (SKU: CF01)
-- Định lượng: 0.025 kg Hạt cà phê (NL-CAFE-HAT) & 0.015 kg Đường cát (NL-DUONG-CAT)
-- -------------------------------------------------------------------------
INSERT INTO recipes (id, product_id, ingredient_id, quantity_needed)
SELECT 
  UUID(), 
  (SELECT id FROM products WHERE sku = 'CF01' LIMIT 1), 
  (SELECT id FROM raw_materials WHERE sku = 'NL-CAFE-HAT' LIMIT 1), 
  0.0250
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'CF01') 
  AND EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-CAFE-HAT');

INSERT INTO recipes (id, product_id, ingredient_id, quantity_needed)
SELECT 
  UUID(), 
  (SELECT id FROM products WHERE sku = 'CF01' LIMIT 1), 
  (SELECT id FROM raw_materials WHERE sku = 'NL-DUONG-CAT' LIMIT 1), 
  0.0150
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'CF01') 
  AND EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-DUONG-CAT');

-- -------------------------------------------------------------------------
-- MÓN 3: Trà sữa thái xanh vị thanh (SKU: TRA05)
-- Định lượng: 0.050 kg Trân châu đen (NL-TRAN-CHAU) & 0.030 lon Sữa đặc (NL-SUA-DAC)
-- -------------------------------------------------------------------------
INSERT INTO recipes (id, product_id, ingredient_id, quantity_needed)
SELECT 
  UUID(), 
  (SELECT id FROM products WHERE sku = 'TRA05' LIMIT 1), 
  (SELECT id FROM raw_materials WHERE sku = 'NL-TRAN-CHAU' LIMIT 1), 
  0.0500
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'TRA05') 
  AND EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-TRAN-CHAU');

INSERT INTO recipes (id, product_id, ingredient_id, quantity_needed)
SELECT 
  UUID(), 
  (SELECT id FROM products WHERE sku = 'TRA05' LIMIT 1), 
  (SELECT id FROM raw_materials WHERE sku = 'NL-SUA-DAC' LIMIT 1), 
  0.0300
WHERE EXISTS (SELECT 1 FROM products WHERE sku = 'TRA05') 
  AND EXISTS (SELECT 1 FROM raw_materials WHERE sku = 'NL-SUA-DAC');

-- Bật lại Safe Update Mode sau khi hoàn thành chạy dữ liệu mẫu
SET SQL_SAFE_UPDATES = 1;
