USE pos_system;

-- TẮT KIỂM TRA KHÓA NGOẠI ĐỂ CÓ THỂ RESET DỮ LIỆU
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================================
-- PHẦN 1: DỌN SẠCH DỮ LIỆU GIAO DỊCH (Lịch sử bán hàng, ca làm, log hệ thống, nhập kho)
-- (Giữ lại danh sách sản phẩm, danh mục, khách hàng, nhà cung cấp, nguyên liệu)
-- =========================================================================

-- 1. Xóa chi tiết hóa đơn và hóa đơn
TRUNCATE TABLE order_details;
TRUNCATE TABLE orders;

-- 2. Xóa thông tin thanh toán
TRUNCATE TABLE payments;

-- 3. Xóa lịch sử ca làm việc (Shifts)
TRUNCATE TABLE shifts;

-- 4. Xóa lịch sử giao dịch kho và hao hụt nguyên liệu
TRUNCATE TABLE stock_transactions;
TRUNCATE TABLE waste_transactions;

-- 5. Xóa nhật ký hoạt động hệ thống (Audit Logs)
TRUNCATE TABLE audit_logs;

-- 6. Xóa chi tiết và phiếu nhập kho hàng hóa/nguyên liệu
TRUNCATE TABLE goods_receipt_material_details;
TRUNCATE TABLE goods_receipt_details;
TRUNCATE TABLE goods_receipts;

-- 7. Reset thống kê mua hàng của khách hàng về 0
UPDATE customers SET total_spent = 0, order_count = 0, last_order_at = NULL;


-- =========================================================================
-- PHẦN 2 (TÙY CHỌN): RESET HOÀN TOÀN HỆ THỐNG VỀ TRẠNG THÁI MỚI TINH
-- (Nếu muốn xóa luôn sản phẩm, nguyên liệu, khách hàng, tài khoản nhân viên...
-- Hãy BỎ DẤU COMMENT (--) trước các dòng dưới đây để chạy)
-- =========================================================================

-- -- Xóa khuyến mãi
-- TRUNCATE TABLE promotions;
-- TRUNCATE TABLE promotion_rules;

-- -- Xóa sản phẩm và danh mục sản phẩm
-- TRUNCATE TABLE products;
-- TRUNCATE TABLE categories;

-- -- Xóa nguyên liệu và nhà cung cấp
-- TRUNCATE TABLE raw_materials;
-- TRUNCATE TABLE suppliers;

-- -- Xóa danh sách khách hàng
-- TRUNCATE TABLE customers;

-- -- Dọn dẹp tài khoản (giữ lại role và user mặc định)
-- TRUNCATE TABLE users;
-- TRUNCATE TABLE roles;

-- -- Nạp lại Roles mặc định
-- INSERT INTO roles (id, name, description) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'admin', 'Quản trị viên toàn quyền hệ thống'),
--   ('00000000-0000-0000-0000-000000000002', 'manager', 'Quản lý cửa hàng (có thể quản lý nhân viên, kho, khuyến mãi)'),
--   ('00000000-0000-0000-0000-000000000003', 'staff', 'Nhân viên bán hàng (chỉ có quyền bán hàng POS)');

-- -- Nạp lại Users mặc định (Mật khẩu đăng nhập đều là: 123456)
-- INSERT INTO users (id, full_name, email, password_hash, role_id, is_active) VALUES
--   ('00000000-0000-0000-0000-000000000101', 'Quản trị viên', 'admin@example.com', '$2b$10$9tUFu9TM1ge5iv3Uluug4OuIyrVetVSvdhHQDTRD9uWltV1wpRXBG', '00000000-0000-0000-0000-000000000001', TRUE),
--   ('00000000-0000-0000-0000-000000000102', 'Quản lý Cửa hàng', 'manager@example.com', '$2a$10$0zX7fA6X.Gj5j1j.V1Zp6e5/u4O8y7V3e3f4y5V6x7y8z9A0B1C2D', '00000000-0000-0000-0000-000000000002', TRUE);

-- =========================================================================

-- BẬT LẠI KIỂM TRA KHÓA NGOẠI
SET FOREIGN_KEY_CHECKS = 1;
