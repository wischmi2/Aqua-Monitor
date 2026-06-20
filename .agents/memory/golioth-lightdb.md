---
name: Golioth LightDB State control
description: Correct API format for writing device state via Golioth REST API for solenoid control
---

# Golioth LightDB State — Correct API Format

## The Rule
`PUT https://api.golioth.io/v1/projects/{projectId}/devices/{deviceId}/data/desired`
Body: `{"solenoid": true}` (flat JSON, no wrapper)
Header: `x-api-key: {GOLIOTH_API_KEY}`

**Why:** `/lightdb/` endpoints return 404 for this account. `/data/desired` is the correct path. `/data/state` won't trigger device-side listeners. Key must be in body, not path.

**How to apply:**
- Device ID must be the internal Golioth ObjectId (24 lowercase hex chars), NOT the hardware ID or device name
- Filter candidate devices using regex `/^[0-9a-f]{24}$/` to skip fake test entries in DB
- Real device for this project: `6a34816d3f236bf1dbf8c75b` (esp32-c6-1)
- API key stored as `GOLIOTH_API_KEY` Replit secret, project as `GOLIOTH_PROJECT_ID`
