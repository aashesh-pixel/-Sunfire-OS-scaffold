CREATE TABLE IF NOT EXISTS telemetry_events (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  signal_name TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS telemetry_events_signal_observed_idx
  ON telemetry_events (signal_name, observed_at DESC);
