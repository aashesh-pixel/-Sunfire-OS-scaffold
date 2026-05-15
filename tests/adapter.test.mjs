import assert from "node:assert/strict";
import test from "node:test";
import { normalizeArdunSignal, AdapterValidationError, listSupportedSignals } from "../services/adapter/sunfire-adapter.mjs";

test("normalizes supported ARDUN signal to VSS-like telemetry event", () => {
  const event = normalizeArdunSignal({
    source: "fixture",
    name: "ARDUN.Vehicle.Speed",
    value: "42",
    timestamp: "2026-05-13T10:00:00.000Z"
  }, new Date("2026-05-13T10:00:01.000Z"));

  assert.equal(event.signalName, "Vehicle.Speed");
  assert.equal(event.value, 42);
  assert.equal(event.unit, "km/h");
  assert.equal(event.source, "fixture");
  assert.equal(event.observedAt, "2026-05-13T10:00:00.000Z");
});

test("normalizes boolean signal to numeric display value", () => {
  const event = normalizeArdunSignal({
    name: "ARDUN.Body.Lights.IsHighBeamOn",
    value: true
  }, new Date("2026-05-13T10:00:01.000Z"));

  assert.equal(event.signalName, "Body.Lights.IsHighBeamOn");
  assert.equal(event.value, 1);
  assert.equal(event.unit, "boolean");
});

test("rejects unsupported signal names", () => {
  assert.throws(() => normalizeArdunSignal({
    name: "ARDUN.Experimental.Control.Command",
    value: 1
  }), AdapterValidationError);
});

test("lists supported signal contract", () => {
  assert.ok(listSupportedSignals().some((signal) => signal.inputName === "ARDUN.Vehicle.Speed"));
});
