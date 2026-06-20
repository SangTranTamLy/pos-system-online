USE pos_system;

-- 1. Xóa bảng cũ nếu tồn tại và tạo lại theo cấu trúc mới chuẩn POS F&B
DROP TABLE IF EXISTS audit_logs;

CREATE TABLE audit_logs (
  id VARCHAR(50) PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id VARCHAR(50) NULL,
  user_name VARCHAR(120) NULL,
  role VARCHAR(50) NULL, -- 'TN' (Thu ngân) hoặc 'QL' (Quản lý)
  action_type VARCHAR(50) NOT NULL, -- 'HUY_MON', 'GIAM_GIA', 'MO_KET', 'HOAN_TIEN', 'DANG_NHAP', 'DANG_XUAT', 'SUA_GIA', 'SUA_KHO'
  target_object VARCHAR(100) NULL, -- Mã đơn / Bàn / Két / Kho
  description TEXT NULL,
  old_values JSON NULL,
  new_values JSON NULL
);

-- 2. Chèn dữ liệu mẫu tiếng Việt chuẩn để giao diện hiển thị trực quan
INSERT INTO audit_logs (id, timestamp, user_id, user_name, role, action_type, target_object, description)
VALUES 
  ('a0000001', DATE_SUB(NOW(), INTERVAL 5 MINUTE), '00000000-0000-0000-0000-000000000102', 'Hoài Nam', 'TN', 'HUY_MON', 'Đơn #1024 (Bàn 5)', 'Hủy: 1 Trà sữa Trân châu đường đen. Lý do: Khách đổi món.'),
  ('a0000002', DATE_SUB(NOW(), INTERVAL 12 MINUTE), '00000000-0000-0000-0000-000000000102', 'Hoài Nam', 'TN', 'GIAM_GIA', 'Đơn #1023', 'Áp dụng mã giảm giá 15% WELCOME15 cho khách hàng mới.'),
  ('a0000003', DATE_SUB(NOW(), INTERVAL 25 MINUTE), '00000000-0000-0000-0000-000000000102', 'Hoài Nam', 'TN', 'MO_KET', 'Két tiền quầy chính', 'Yêu cầu mở két thủ công để thối tiền lẻ cho khách.'),
  ('a0000004', DATE_SUB(NOW(), INTERVAL 35 MINUTE), '00000000-0000-0000-0000-000000000101', 'Quản trị viên', 'QL', 'HOAN_TIEN', 'Đơn #1019 (Bàn 2)', 'Hoàn tiền 120,000đ. Lý do: Cà phê bị chua, khách không hài lòng.'),
  ('a0000005', DATE_SUB(NOW(), INTERVAL 45 MINUTE), '00000000-0000-0000-0000-000000000101', 'Quản trị viên', 'QL', 'SUA_GIA', 'Món: Trà đào cam sả', 'Điều chỉnh giá bán món từ 45,000đ tăng lên 49,000đ.'),
  ('a0000006', DATE_SUB(NOW(), INTERVAL 55 MINUTE), '00000000-0000-0000-0000-000000000102', 'Hoài Nam', 'TN', 'DANG_NHAP', 'Thiết bị POS 1', 'Thu ngân đăng nhập bắt đầu ca trực.'),
  ('a0000007', DATE_SUB(NOW(), INTERVAL 65 MINUTE), '00000000-0000-0000-0000-000000000101', 'Quản trị viên', 'QL', 'SUA_KHO', 'Sữa đặc Ngôi sao', 'Điều chỉnh kho nguyên liệu: -5 hộp. Lý do: Hết hạn sử dụng.')
AS new_logs
ON DUPLICATE KEY UPDATE action_type = new_logs.action_type;

