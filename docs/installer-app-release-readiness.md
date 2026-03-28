# Installer App Release Readiness

Use this sheet after running the QA checklist.

## Release Decision

- Status: `NOT READY`
- Build tested on:
  - Android emulator
  - Android field device
- API environment:
  - Staging
  - Production

## Critical Gates

- Auth and session restore verified
- Jobs queue loads correctly
- Installation flow completes end-to-end
- Complaint flow resolves end-to-end
- Proof upload persists correctly
- OTP flows work reliably
- ONT replacement saves serial audit
- Notifications deep-link correctly
- Leave / availability controls work
- No blocking crash found in manual QA

## Blockers

| Severity | Area | Issue | Repro | Owner | Status |
|---|---|---|---|---|---|
| P0 |  |  |  |  | Open |
| P1 |  |  |  |  | Open |

## High Priority Fixes

| Area | Fix needed | Owner | ETA | Status |
|---|---|---|---|---|
| Auth |  |  |  | Open |
| Jobs |  |  |  | Open |
| Install workflow |  |  |  | Open |
| Complaint workflow |  |  |  | Open |
| Proof / OTP |  |  |  | Open |

## Signoff Matrix

| Area | Tester | Result | Notes |
|---|---|---|---|
| Auth |  | Pending |  |
| Dashboard |  | Pending |  |
| Jobs queue |  | Pending |  |
| Installation workflow |  | Pending |  |
| Complaint workflow |  | Pending |  |
| Notifications |  | Pending |  |
| Profile / availability |  | Pending |  |
| Backend sync |  | Pending |  |

## Final Go / No-Go

- Product: `Pending`
- Operations: `Pending`
- Backend: `Pending`
- QA: `Pending`

## Release Notes Draft

- Clean light installer console UI
- Guided job detail workflow
- Complaint resolution workflow
- Proof capture and OTP completion flow
- Notifications queue with mark-all-read
- Availability and leave controls
- Safer session/logout handling

