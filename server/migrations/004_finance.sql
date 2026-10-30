-- 004 · Finanzas: series de facturación, facturas, líneas, cobros, pagos recurrentes y gastos.
-- Las facturas emitidas son inmutables a nivel de base de datos (solo cambian estado y cobros).

CREATE TABLE invoice_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT '{PREFIX}{YYYY}-{NUM}',
  padding INTEGER NOT NULL DEFAULT 4 CHECK (padding BETWEEN 1 AND 10),
  reset_yearly INTEGER NOT NULL DEFAULT 1 CHECK (reset_yearly IN (0, 1)),
  kind TEXT NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard', 'rectifying')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO invoice_series (code, name, prefix, kind, is_default) VALUES
  ('F', 'Serie general', 'F', 'standard', 1),
  ('R', 'Facturas rectificativas', 'R', 'rectifying', 0);

CREATE TABLE invoice_series_counters (
  series_id INTEGER NOT NULL REFERENCES invoice_series(id),
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (series_id, year)
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  series_id INTEGER NOT NULL REFERENCES invoice_series(id),
  number TEXT,
  sequence INTEGER,
  year INTEGER,
  kind TEXT NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard', 'rectifying')),
  rectifies_invoice_id INTEGER REFERENCES invoices(id),
  rectification_reason TEXT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  project_id INTEGER REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  issue_date TEXT,
  due_date TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  global_discount_pct REAL NOT NULL DEFAULT 0 CHECK (global_discount_pct BETWEEN 0 AND 100),
  withholding_pct REAL NOT NULL DEFAULT 0 CHECK (withholding_pct BETWEEN 0 AND 100),
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  withholding_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  footer TEXT,
  client_snapshot TEXT,
  issuer_snapshot TEXT,
  issued_at TEXT,
  sent_at TEXT,
  cancelled_at TEXT,
  verifactu_status TEXT NOT NULL DEFAULT 'not_configured',
  record_hash TEXT,
  prev_record_hash TEXT,
  record_payload TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (series_id, year, sequence)
);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status, due_date);
CREATE INDEX idx_invoices_issue ON invoices(issue_date);
CREATE INDEX idx_invoices_project ON invoices(project_id);

CREATE TRIGGER trg_invoices_issued_immutable
BEFORE UPDATE OF series_id, client_id, number, sequence, year, kind, issue_date, currency, global_discount_pct,
  withholding_pct, subtotal_cents, discount_cents, tax_cents, withholding_cents, total_cents, client_snapshot,
  issuer_snapshot, record_hash, record_payload ON invoices
WHEN OLD.status <> 'draft' AND OLD.is_demo = 0
BEGIN SELECT RAISE(ABORT, 'Una factura emitida no puede modificarse: emite una factura rectificativa'); END;

CREATE TRIGGER trg_invoices_issued_no_delete BEFORE DELETE ON invoices
WHEN OLD.status <> 'draft' AND OLD.is_demo = 0
BEGIN SELECT RAISE(ABORT, 'Una factura emitida no puede eliminarse'); END;

CREATE TABLE invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  discount_pct REAL NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  tax_rate REAL NOT NULL DEFAULT 21 CHECK (tax_rate BETWEEN 0 AND 100),
  base_cents INTEGER NOT NULL,
  discount_cents INTEGER NOT NULL,
  tax_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

CREATE TRIGGER trg_invoice_items_lock_insert BEFORE INSERT ON invoice_items
WHEN (SELECT status FROM invoices WHERE id = NEW.invoice_id) <> 'draft' AND (SELECT is_demo FROM invoices WHERE id = NEW.invoice_id) = 0
BEGIN SELECT RAISE(ABORT, 'Las líneas de una factura emitida no pueden modificarse'); END;
CREATE TRIGGER trg_invoice_items_lock_update BEFORE UPDATE ON invoice_items
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft' AND (SELECT is_demo FROM invoices WHERE id = OLD.invoice_id) = 0
BEGIN SELECT RAISE(ABORT, 'Las líneas de una factura emitida no pueden modificarse'); END;
CREATE TRIGGER trg_invoice_items_lock_delete BEFORE DELETE ON invoice_items
WHEN (SELECT status FROM invoices WHERE id = OLD.invoice_id) <> 'draft' AND (SELECT is_demo FROM invoices WHERE id = OLD.invoice_id) = 0
BEGIN SELECT RAISE(ABORT, 'Las líneas de una factura emitida no pueden modificarse'); END;

CREATE TABLE recurring_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  client_service_id INTEGER REFERENCES client_services(id),
  project_id INTEGER REFERENCES projects(id),
  concept TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('hosting', 'maintenance', 'subscription', 'fee', 'renewal', 'other')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly')),
  start_date TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  end_date TEXT,
  reminder_days INTEGER NOT NULL DEFAULT 7 CHECK (reminder_days BETWEEN 0 AND 90),
  auto_generate INTEGER NOT NULL DEFAULT 1 CHECK (auto_generate IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  last_generated_at TEXT,
  notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_recurring_due ON recurring_payments(status, next_due_date);
CREATE INDEX idx_recurring_client ON recurring_payments(client_id);

-- Cobros: importes esperados o recibidos. Si invoice_id está informado, son abonos contra esa factura.
CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  project_id INTEGER REFERENCES projects(id),
  invoice_id INTEGER REFERENCES invoices(id),
  recurring_payment_id INTEGER REFERENCES recurring_payments(id),
  period_date TEXT,
  concept TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  amount_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_paid_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  issued_on TEXT NOT NULL,
  due_date TEXT,
  paid_at TEXT,
  method TEXT CHECK (method IS NULL OR method IN ('transfer', 'card', 'stripe', 'paypal', 'cash', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded')),
  external_ref TEXT,
  notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (recurring_payment_id, period_date)
);
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_status ON payments(status, due_date);
CREATE INDEX idx_payments_paid ON payments(paid_at);

CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier TEXT NOT NULL,
  concept TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hosting', 'domains', 'software', 'hardware', 'marketing', 'freelance', 'taxes', 'office', 'training', 'other')),
  client_id INTEGER REFERENCES clients(id),
  project_id INTEGER REFERENCES projects(id),
  server_id INTEGER REFERENCES servers(id),
  document_id INTEGER REFERENCES documents(id),
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('transfer', 'card', 'stripe', 'paypal', 'cash', 'other')),
  notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_client ON expenses(client_id);
