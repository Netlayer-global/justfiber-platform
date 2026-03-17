# Phase 1 Foundation

This phase establishes the base ISP control-plane entities needed to replace JAZE-dependent service control over time.

## Added models

- `AccessProfile`
  - Speed and Radius attribute catalog
- `BillingProfile`
  - Prepaid/postpaid cycle rules and Razorpay eligibility
- `BngNode`
  - MikroTik BNG/NAS inventory
- `SubscriberService`
  - Service inventory with Radius username/profile/node mapping
- `NatLogEntry`
  - Searchable CGNAT/NAT compliance logs

## Added admin APIs

Base path: `/api/v1/admin/foundation`

- `GET /overview`
- `GET/POST /access-profiles`
- `GET/POST /billing-profiles`
- `GET/POST /bng-nodes`
- `GET/POST /subscriber-services`
- `GET /subscriber-services/:serviceId`
- `POST /subscriber-services/:serviceId/provision`
- `POST /subscriber-services/:serviceId/suspend`
- `POST /subscriber-services/:serviceId/resume`
- `GET/POST /nat-logs`

## Intended stack

- AAA: FreeRADIUS
- BNG/NAS: MikroTik
- Payment: Razorpay
- Device control: GenieACS
- Apps: Flutter customer + installer

## Recommended next phase

1. Seed at least one live `AccessProfile`, `BillingProfile`, and `BngNode`
2. Backfill `SubscriberService` for existing customers
3. Integrate Razorpay payment order + webhook
4. Add Radius SQL schema and MikroTik client onboarding
5. Build admin UI around these APIs

## Service control provider

Set `SERVICE_CONTROL_PROVIDER=radius` to use FreeRADIUS-backed subscriber create/suspend/resume in worker and foundation APIs.

## Test script

Run:

`node src/scripts/testRadiusModules.js`
