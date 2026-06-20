USE pos_system;

INSERT INTO roles (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'Quản trị viên') AS new_role
ON DUPLICATE KEY UPDATE
  name = new_role.name,
  description = new_role.description;

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
  'Quản trị viên',
  'admin@example.com',
  '$2b$10$9tUFu9TM1ge5iv3Uluug4OuIyrVetVSvdhHQDTRD9uWltV1wpRXBG',
  '00000000-0000-0000-0000-000000000001',
  TRUE
) AS new_user
ON DUPLICATE KEY UPDATE
  full_name = new_user.full_name,
  password_hash = new_user.password_hash,
  role_id = new_user.role_id,
  is_active = new_user.is_active;