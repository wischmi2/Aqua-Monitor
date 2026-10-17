---
name: History hardware visibility
description: User-approved activity window and device separation for the History tab.
---

History offers currently claimed devices that have actually reported in the last 24 hours, with separate device and reported-reading selection.

**Why:** The user approved a longer activity window for History to avoid inactive hardware and mixed-device readings without losing access to historical measurements.

**How to apply:** Determine activity using source measurement timestamps, not receipt time. The 24-hour rule selects devices; retain the selected device's older readings for the existing 7- and 30-day ranges. Preserve stored history. Dashboard visibility remains governed separately by its one-hour rule.
