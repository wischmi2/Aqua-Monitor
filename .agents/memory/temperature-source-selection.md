---
name: Temperature source selection
description: Explicit per-user temperature sources must not silently switch hardware.
---

The dedicated Temperature card can be pinned to a user's chosen reporting device or set to Automatic. Keep the saved explicit choice when the hardware becomes unavailable.

**Why:** A newer value from a different board is not a substitute for the physical location the user chose to monitor.

**How to apply:** A pinned source must not fall back to other hardware. Apply the existing one-hour reporting and dashboard visibility requirements, hide unavailable measurements, and retain a way to change or reset the source. This affects presentation only, not stored readings or their units.
