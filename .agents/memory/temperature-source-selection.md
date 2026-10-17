---
name: Temperature source selection
description: Explicit per-user temperature sources must not silently switch hardware.
---

The dedicated Temperature card can be pinned to a user's chosen reporting device or set to Automatic. Keep the saved explicit choice when the hardware becomes unavailable.

**Why:** A newer value from a different board is not a substitute for the physical location the user chose to monitor.

**How to apply:** A pinned source must not fall back to other hardware. Apply the existing one-hour reporting and dashboard visibility requirements, hide unavailable measurements, and retain a way to change or reset the source. This affects presentation only, not stored readings or their units.

History should default to the temperature source selected on the front panel, with manual device/channel browsing still available. Automatic must resolve the same physical board as the Dashboard, not the first board in History.

**Why:** The user asked History to show whatever temperature source is selected on the front panel.

**How to apply:** Follow source changes until the user switches to manual browsing, and offer a return to following. Use the canonical Temperature channel for the chosen board. History retains its 24-hour device eligibility window, so a pinned board can still have an archive after live readings expire; never substitute another board when the chosen source is unavailable.
