USE pos_system;

CREATE TABLE IF NOT EXISTS inventory_audits (
  id CHAR(36) PRIMARY KEY,
  created_by CHAR(36) NOT NULL,
  status VARCHAR(30) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_audits_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_audit_details (
  id CHAR(36) PRIMARY KEY,
  audit_id CHAR(36) NOT NULL,
  material_id CHAR(36) NOT NULL,
  system_quantity DECIMAL(12, 2) NOT NULL,
  actual_quantity DECIMAL(12, 2) NOT NULL,
  variance DECIMAL(12, 2) NOT NULL,
  note TEXT NULL,
  CONSTRAINT fk_inventory_audit_details_audit_id FOREIGN KEY (audit_id) REFERENCES inventory_audits(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_audit_details_material_id FOREIGN KEY (material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT
);
