-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clipboard items table
CREATE TABLE clipboard_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('text', 'image')),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_last_active_at ON sessions(last_active_at);
CREATE INDEX idx_devices_session_id ON devices(session_id);
CREATE INDEX idx_clipboard_items_session_id ON clipboard_items(session_id);
CREATE INDEX idx_clipboard_items_expires_at ON clipboard_items(expires_at);
CREATE INDEX idx_clipboard_items_created_at ON clipboard_items(created_at DESC);

-- Row Level Security (optional, for additional protection)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE clipboard_items ENABLE ROW LEVEL SECURITY;

-- Policies (service role bypasses RLS, but good for defense in depth)
CREATE POLICY "Service role full access" ON sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON devices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON clipboard_items FOR ALL USING (auth.role() = 'service_role');