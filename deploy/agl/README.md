# AGL Preparation

These files prepare the Sunfire OS scaffold for later AGL deployment work. They are not production deployment instructions.

Current assumptions:

- Phase 1 runs as a local development service.
- The telemetry API is display-only and read-only from a vehicle perspective.
- No hardware interface, CAN write path, OTA updater, or firmware flashing workflow is present.

Future AGL work should define:

- Target AGL version
- Hardware profile
- Network policy
- Service user and sandboxing policy
- Logging and retention policy
- Packaging format
