---
name: Dashboard hardware visibility
description: User's one-hour definition of connected hardware for dashboard sensor cards.
---

Dashboard hardware sensor cards should appear only when the hardware has reported data in the last hour.

**Why:** When asked whether "connected" meant claimed or reporting within five minutes, the user specified "only when it has reported data in the last hour."

**How to apply:** Apply this rule to all dashboard sensor cards, not just pH and Solar boards. Preserve history and saved device settings when cards disappear. Use source measurement time, not webhook receipt time.
