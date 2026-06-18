USE pos_system;

-- Tạo các quyền mặc định cho hệ thống nếu chưa có
INSERT INTO roles (id, name, description)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Quản trị viên toàn quyền hệ thống'),
  ('00000000-0000-0000-0000-000000000002', 'manager', 'Quản lý cửa hàng (có thể quản lý nhân viên, kho, khuyến mãi)'),
  ('00000000-0000-0000-0000-000000000003', 'staff', 'Nhân viên bán hàng (chỉ có quyền bán hàng POS)')
ON DUPLICATE KEY UPDATE
  description = VALUES(description);

-- Admin user (nếu chưa có) đã có trong admin-bootstrap, nhưng có thể bổ sung 1 tài khoản manager mẫu
INSERT INTO users (id, full_name, email, password_hash, role_id, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000102',
  'Quản lý Cửa hàng',
  'manager@example.com',
  -- Mật khẩu mặc định: 123456
  '$2a$10$0zX7fA6X.Gj5j1j.V1Zp6e5/u4O8y7V3e3f4y5V6x7y8z9A0B1C2D', 
  '00000000-0000-0000-0000-000000000002',
  TRUE
)
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);
