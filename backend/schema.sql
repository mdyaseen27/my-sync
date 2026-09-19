CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE pins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clipboard_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('text', 'image')),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_clipboard_items_expires_at ON clipboard_items(expires_at);
CREATE INDEX idx_clipboard_items_created_at ON clipboard_items(created_at DESC);

ALTER TABLE clipboard_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON clipboard_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON pins FOR ALL USING (auth.role() = 'service_role');