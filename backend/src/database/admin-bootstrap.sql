USE pos_system;

INSERT INTO roles (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'System administrator')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT INTO users (
  id,
  full_name,
  email,
  password_hash,
  role_id,
  is_active
)
VALUES (
  '00000000-0000-0000-0000-000000000101',
  'Administrator',
  'admin@example.com',
  '$2b$10$9tUFu9TM1ge5iv3Uluug4OuIyrVetVSvdhHQDTRD9uWltV1wpRXBG',
  '00000000-0000-0000-0000-000000000001',
  TRUE
)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  role_id = VALUES(role_id),
  is_active = VALUES(is_active);