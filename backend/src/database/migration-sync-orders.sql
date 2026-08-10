-- MVP POS offline: lưu khóa idempotency cho mỗi thao tác đồng bộ.
-- Chạy migration này sau khi bảng `orders` đã tồn tại.

CREATE TABLE IF NOT EXISTS pos_sync_operations (
  operation_id VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  terminal_id VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  local_order_id VARCHAR(160) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  server_order_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  status VARCHAR(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PROCESSING',
  response_payload JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (operation_id),
  UNIQUE KEY uq_pos_sync_terminal_local_order (terminal_id, local_order_id),
  KEY idx_pos_sync_status_created_at (status, created_at),
  KEY idx_pos_sync_server_order (server_order_id),
  CONSTRAINT fk_pos_sync_server_order
    FOREIGN KEY (server_order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT chk_pos_sync_status
    CHECK (status IN ('PROCESSING', 'SYNCED', 'REJECTED', 'CONFLICT_STOCK'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

