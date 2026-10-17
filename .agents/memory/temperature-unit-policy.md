---
name: Temperature unit policy
description: Why ambiguous temperature readings must not be guessed or retroactively reinterpreted.
---

Do not infer temperature input units from the numeric value. A generic reading of 22 was observed, but its real unit was not established.

**Why:** A plausible Celsius value is not proof of Celsius; treating every generic reading as Fahrenheit caused misleading labels.

**How to apply:** Require an explicit device input-unit choice for generic fields. Unit-bearing fields take precedence. Device input-unit settings affect future ingestion only; historical values and labels must not be silently rewritten. Display preferences may convert readings with known source units between Celsius and Fahrenheit without changing stored data. Unknown units remain unknown. Any historical correction needs verified device units, a defined time range, and explicit approval.
