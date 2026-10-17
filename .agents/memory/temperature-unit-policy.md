---
name: Temperature unit policy
description: Why ambiguous temperature readings must not be guessed or retroactively reinterpreted.
---

Do not infer temperature input units from the numeric value. A generic reading of 22 was observed, but its real unit was not established.

**Why:** A plausible Celsius value is not proof of Celsius; treating every generic reading as Fahrenheit caused misleading labels.

**How to apply:** Require an explicit device input-unit choice for generic fields. Unit-bearing fields take precedence. Device input-unit settings affect future ingestion only; historical values and labels must not be silently rewritten. Display preferences may convert readings with known source units between Celsius and Fahrenheit without changing stored data. Unknown units remain unknown. Any historical correction needs verified device units, a defined time range, and explicit approval.

The display-unit choice must be consistent even before the user saves a preference; use one common default rather than deriving defaults from each sensor's source unit.

**Why:** Sharing only explicit selections still leaves first-time users seeing conflicting selected units across Dashboard, PCB details, and History.

**How to apply:** Treat source units as conversion metadata, not display preferences. Preserve the shared default when adding temperature channels or moving preferences to account settings.
