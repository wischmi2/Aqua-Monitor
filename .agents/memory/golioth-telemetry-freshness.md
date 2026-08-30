---
name: Golioth telemetry freshness
description: How to determine whether LightDB stream telemetry is current or delayed.
---

Use the authoritative Golioth CloudEvent source timestamp when deciding whether telemetry is current. Do not treat webhook receipt time as measurement time for device-health or stale-data UI.

**Why:** Delayed or replayed events can arrive now but contain old measurements. Using receipt time makes stale values appear live.

**How to apply:** Parse the `ce-time` header, including timestamps with nanosecond precision, persist it with each reading, and reject timestamp-less device-health payloads unless the UI can explicitly represent unknown timestamp provenance.