const apiBaseUrl = process.env.SUNFIRE_API_URL || "http://localhost:8080";

const sequence = [
  { name: "ARDUN.Vehicle.Speed", value: 0, unit: "km/h" },
  { name: "ARDUN.Powertrain.Engine.Speed", value: 850, unit: "rpm" },
  { name: "ARDUN.Powertrain.FuelSystem.Level", value: 72, unit: "percent" },
  { name: "ARDUN.Body.Lights.IsHighBeamOn", value: false, unit: "boolean" },
  { name: "ARDUN.Cabin.HVAC.AmbientAirTemperature", value: 21.5, unit: "celsius" },
  { name: "ARDUN.Vehicle.Speed", value: 42, unit: "km/h" },
  { name: "ARDUN.Powertrain.Engine.Speed", value: 2400, unit: "rpm" }
];

for (const sample of sequence) {
  const payload = {
    source: "mock-ardun-feed",
    timestamp: new Date().toISOString(),
    ...sample
  };

  const response = await fetch(`${apiBaseUrl}/signals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to publish ${sample.name}: ${response.status} ${await response.text()}`);
  }

  console.log(`published ${sample.name}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
}
