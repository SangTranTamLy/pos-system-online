CREATE TABLE IF NOT EXISTS shifts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expected_start_time DATETIME NOT NULL,
  expected_end_time DATETIME NOT NULL,
  actual_start_time DATETIME NULL,
  actual_end_time DATETIME NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  
  -- Tracking roles
  approved_by CHAR(36) NULL,
  opened_by CHAR(36) NULL,
  closed_by CHAR(36) NULL,
  
  -- Financial tracking
  opening_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
  actual_closing_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_sales_cash DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_sales_qr DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_sales DECIMAL(12, 2) NOT NULL DEFAULT 0,
  variance DECIMAL(12, 2) NOT NULL DEFAULT 0,
  
  -- Notes
  closing_note TEXT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_shifts_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_shifts_approved_by FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT fk_shifts_opened_by FOREIGN KEY (opened_by) REFERENCES users(id),
  CONSTRAINT fk_shifts_closed_by FOREIGN KEY (closed_by) REFERENCES users(id),
  CONSTRAINT chk_shifts_status CHECK (status IN ('PENDING', 'APPROVED', 'OPEN', 'CLOSING_REQUEST', 'CLOSED', 'CANCELLED')),
  CONSTRAINT chk_shifts_cash CHECK (opening_cash >= 0),
  CONSTRAINT chk_shifts_sales CHECK (total_sales_cash >= 0 AND total_sales_qr >= 0 AND total_sales >= 0)
);

-- Thêm trường shift_id vào bảng orders để theo dõi hóa đơn thuộc ca nào (tuỳ chọn nhưng rất tốt cho đối soát)
-- Vì hệ thống đang chạy, chúng ta dùng ALTER TABLE IF NOT EXISTS nếu có hỗ trợ, hoặc script đơn giản.
-- Lưu ý: MariaDB/MySQL cũ không có ALTER TABLE IF NOT EXISTS column. Ta tạo PROCEDURE để check và add column an toàn.

DROP PROCEDURE IF EXISTS add_shift_id_to_orders;
DELIMITER //
CREATE PROCEDURE add_shift_id_to_orders()
BEGIN
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'shift_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN shift_id CHAR(36) NULL AFTER customer_id;
    ALTER TABLE orders ADD CONSTRAINT fk_orders_shift_id FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
  END IF;
END//
DELIMITER ;
CALL add_shift_id_to_orders();
DROP PROCEDURE IF EXISTS add_shift_id_to_orders;

-- Bổ sung index để tối ưu query
CALL create_index_if_missing('shifts', 'idx_shifts_user_id', 'user_id');
CALL create_index_if_missing('shifts', 'idx_shifts_status', 'status');
CALL create_index_if_missing('shifts', 'idx_shifts_time', 'expected_start_time,expected_end_time');
CALL create_index_if_missing('orders', 'idx_orders_shift_id', 'shift_id');
