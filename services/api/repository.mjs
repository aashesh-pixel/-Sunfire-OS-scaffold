export function createTelemetryRepository(options = {}) {
  const databaseUrl = options.databaseUrl || getEnv("DATABASE_URL");
  if (databaseUrl) {
    return new PostgresTelemetryRepository(databaseUrl);
  }

  return new InMemoryTelemetryRepository();
}

function getEnv(name) {
  return typeof process === "undefined" ? undefined : process.env[name];
}

export class InMemoryTelemetryRepository {
  constructor() {
    this.events = [];
    this.nextId = 1;
  }

  async init() {}

  async insert(event) {
    const stored = {
      id: this.nextId++,
      ...event
    };
    this.events.push(stored);
    return stored;
  }

  async latest() {
    const bySignal = new Map();

    for (const event of this.events) {
      const existing = bySignal.get(event.signalName);
      if (!existing || new Date(event.observedAt) > new Date(existing.observedAt)) {
        bySignal.set(event.signalName, event);
      }
    }

    return [...bySignal.values()].sort((a, b) => a.signalName.localeCompare(b.signalName));
  }

  async history(signalName, limit = 50) {
    return this.events
      .filter((event) => !signalName || event.signalName === signalName)
      .sort((a, b) => new Date(b.observedAt) - new Date(a.observedAt))
      .slice(0, limit);
  }

  async close() {}
}

export class PostgresTelemetryRepository {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.pool = null;
  }

  async init() {
    const { Pool } = await import("pg");
    this.pool = new Pool({ connectionString: this.databaseUrl });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id BIGSERIAL PRIMARY KEY,
        source TEXT NOT NULL,
        signal_name TEXT NOT NULL,
        value DOUBLE PRECISION NOT NULL,
        unit TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL,
        received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        raw_payload JSONB NOT NULL
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS telemetry_events_signal_observed_idx
      ON telemetry_events (signal_name, observed_at DESC)
    `);
  }

  async insert(event) {
    const result = await this.pool.query(
      `INSERT INTO telemetry_events
        (source, signal_name, value, unit, observed_at, received_at, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, source, signal_name, value, unit, observed_at, received_at, raw_payload`,
      [
        event.source,
        event.signalName,
        event.value,
        event.unit,
        event.observedAt,
        event.receivedAt,
        event.rawPayload
      ]
    );

    return mapRow(result.rows[0]);
  }

  async latest() {
    const result = await this.pool.query(`
      SELECT DISTINCT ON (signal_name)
        id, source, signal_name, value, unit, observed_at, received_at, raw_payload
      FROM telemetry_events
      ORDER BY signal_name, observed_at DESC
    `);
    return result.rows.map(mapRow);
  }

  async history(signalName, limit = 50) {
    const boundedLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const params = signalName ? [signalName, boundedLimit] : [boundedLimit];
    const where = signalName ? "WHERE signal_name = $1" : "";
    const limitPlaceholder = signalName ? "$2" : "$1";
    const result = await this.pool.query(
      `SELECT id, source, signal_name, value, unit, observed_at, received_at, raw_payload
       FROM telemetry_events
       ${where}
       ORDER BY observed_at DESC
       LIMIT ${limitPlaceholder}`,
      params
    );
    return result.rows.map(mapRow);
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

function mapRow(row) {
  return {
    id: row.id,
    source: row.source,
    signalName: row.signal_name,
    value: Number(row.value),
    unit: row.unit,
    observedAt: new Date(row.observed_at).toISOString(),
    receivedAt: new Date(row.received_at).toISOString(),
    rawPayload: row.raw_payload
  };
}
