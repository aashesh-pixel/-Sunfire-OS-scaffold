const SIGNAL_MAP = Object.freeze({
  "ARDUN.Vehicle.Speed": { name: "Vehicle.Speed", unit: "km/h", min: 0, max: 260 },
  "ARDUN.Powertrain.Engine.Speed": { name: "Powertrain.Engine.Speed", unit: "rpm", min: 0, max: 9000 },
  "ARDUN.Powertrain.FuelSystem.Level": { name: "Powertrain.FuelSystem.Level", unit: "percent", min: 0, max: 100 },
  "ARDUN.Body.Lights.IsHighBeamOn": { name: "Body.Lights.IsHighBeamOn", unit: "boolean", min: 0, max: 1 },
  "ARDUN.Cabin.HVAC.AmbientAirTemperature": { name: "Cabin.HVAC.AmbientAirTemperature", unit: "celsius", min: -50, max: 80 }
});

export class AdapterValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "AdapterValidationError";
    this.details = details;
  }
}

export function listSupportedSignals() {
  return Object.entries(SIGNAL_MAP).map(([inputName, metadata]) => ({
    inputName,
    signalName: metadata.name,
    unit: metadata.unit
  }));
}

export function normalizeArdunSignal(payload, now = new Date()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new AdapterValidationError("Signal payload must be an object.");
  }

  const source = String(payload.source || "mock-ardun-feed");
  const inputName = String(payload.name || "");
  const mapping = SIGNAL_MAP[inputName];

  if (!mapping) {
    throw new AdapterValidationError("Unsupported ARDUN signal.", { inputName });
  }

  const value = normalizeValue(payload.value, mapping.unit);

  if (value < mapping.min || value > mapping.max) {
    throw new AdapterValidationError("Signal value is outside the accepted range.", {
      inputName,
      value,
      min: mapping.min,
      max: mapping.max
    });
  }

  const observedAt = payload.timestamp ? new Date(payload.timestamp) : now;

  if (Number.isNaN(observedAt.getTime())) {
    throw new AdapterValidationError("Signal timestamp is invalid.", { timestamp: payload.timestamp });
  }

  return {
    source,
    signalName: mapping.name,
    value,
    unit: mapping.unit,
    observedAt: observedAt.toISOString(),
    receivedAt: now.toISOString(),
    rawPayload: payload
  };
}

function normalizeValue(value, unit) {
  if (unit === "boolean") {
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }

    if (value === 0 || value === 1) {
      return value;
    }

    throw new AdapterValidationError("Boolean signals must be true, false, 0, or 1.", { value });
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new AdapterValidationError("Signal value must be numeric.", { value });
  }

  return number;
}
