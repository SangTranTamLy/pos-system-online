USE pos_system;

-- Seed sample audit logs
INSERT INTO audit_logs (id, user_id, action, entity_name, entity_id, metadata, created_at)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'login', 'users', '00000000-0000-0000-0000-000000000101', '{"ip": "192.168.1.15", "device": "Chrome / Windows 11"}', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000102', 'login', 'users', '00000000-0000-0000-0000-000000000102', '{"ip": "192.168.1.16", "device": "Safari / macOS"}', DATE_SUB(NOW(), INTERVAL 1 HOUR)),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000102', 'open_shift', 'shifts', 's0000000-0000-0000-0000-000000000001', '{"openingCash": 500000, "note": "Mở ca sáng đầu ngày"}', DATE_SUB(NOW(), INTERVAL 55 MINUTE)),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000102', 'create_product', 'products', 'p0000000-0000-0000-0000-000000000001', '{"name": "Trà Sữa Matcha", "sku": "TS-MATCHA", "price": 45000}', DATE_SUB(NOW(), INTERVAL 45 MINUTE)),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000101', 'update_product', 'products', 'p0000000-0000-0000-0000-000000000001', '{"name": "Trà Sữa Matcha Đậu Đỏ", "oldPrice": 45000, "newPrice": 49000}', DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000102', 'cancel_invoice', 'orders', 'o0000000-0000-0000-0000-000000000001', '{"reason": "Khách đổi món khác", "orderTotal": 125000}', DATE_SUB(NOW(), INTERVAL 15 MINUTE)),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000102', 'adjust_stock', 'raw_materials', 'm0000000-0000-0000-0000-000000000001', '{"material": "Hạt cà phê Robusta", "quantity": -2, "reason": "Hao hụt rang xay"}', DATE_SUB(NOW(), INTERVAL 5 MINUTE))
AS new_logs
ON DUPLICATE KEY UPDATE action = new_logs.action;
