# Phase 6 Connection Pool / Session Fixes

Included in this build:

- Session `lastActivityAt` is no longer written on every authenticated request; it is refreshed at most once per minute.
- Heartbeat interval increased from 30 seconds to 60 seconds.
- Heartbeat requests are deduplicated so overlapping requests are not created.
- Temporary Prisma database errors (P1001/P2024/P1008) from the heartbeat return HTTP 503 instead of incorrectly logging the user out.
- Client heartbeat retries have a 10-second cooldown after a failed request.
- Prisma interactive transaction defaults are set to `maxWait: 10s` and `timeout: 15s`, carrying forward the Phase 4 purchase transaction timeout fix.
- POS serial/IMEI requests are deduplicated and cached for 30 seconds per branch/variant.
- Serial-device GET now queries only `AVAILABLE` devices, reducing database rows returned to the POS/transfer UI.

No Prisma major-version upgrade is included.
