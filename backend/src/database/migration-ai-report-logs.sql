CREATE TABLE IF NOT EXISTS ai_report_logs (
  id CHAR(36) PRIMARY KEY,
  report_type VARCHAR(50) NOT NULL DEFAULT 'business_report',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  data_quality_score INT NOT NULL DEFAULT 0,
  confidence VARCHAR(20) NOT NULL DEFAULT 'thap',
  input_context JSON NOT NULL,
  ai_result JSON NOT NULL,
  is_fallback TINYINT(1) NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_report_logs_period (start_date, end_date),
  INDEX idx_ai_report_logs_created_by (created_by),
  INDEX idx_ai_report_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
