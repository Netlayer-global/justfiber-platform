# Admin UI Vercel Final Prompt

## Objective
Complete 8 missing React tab modules in `frontend/admin-console` with real backend API wiring. No demo/mock data in default runtime paths. Remove Jaze references from active flows.

## Source of Truth
This document + `admin-ui-gap-map.md` + `admin-ui-execution-checklist.md`

## Non-Negotiables

1. **No overclaiming** - Only mark modules "complete" when all CRUD flows work with real API
2. **No demo data in production paths** - Demo only activates on explicit API failure (not default)
3. **No Jaze in active UI** - Legacy system references removed from user workflows
4. **Real API wiring** - Every form/action calls backend endpoint per `ADMIN_BACKEND_CONTRACT.md`
5. **Truthful matrix** - Final report shows exactly what works, what's partial, what's blocked

## 8 Missing Modules

### 1. Subscriber Services Tab
- **Current**: Stub or missing
- **Backend APIs**:
  - `GET /api/v1/admin/foundation/subscriber-services` - List services
  - `POST /api/v1/admin/foundation/subscriber-services` - Create service profile
  - `PATCH /api/v1/admin/foundation/subscriber-services/:serviceId` - Update
  - `DELETE /api/v1/admin/foundation/subscriber-services/:serviceId` - Delete
- **UI Elements**: Service list table, detail panel, create form
- **Real data**: Service name, bandwidth profile, QoS settings, enabled status

### 2. Access Profiles Tab  
- **Current**: Stub or missing
- **Backend APIs**:
  - `GET /api/v1/admin/foundation/access-profiles` - List profiles
  - `POST /api/v1/admin/foundation/access-profiles` - Create profile
  - `PATCH /api/v1/admin/foundation/access-profiles/:profileId` - Update
  - `DELETE /api/v1/admin/foundation/access-profiles/:profileId` - Delete
- **UI Elements**: Profile list, detail panel, form with bandwidth/QoS editor
- **Real data**: Profile name, DL/UL speed, VLAN, VLAN priority

### 3. Billing Profiles Tab
- **Current**: Stub or missing  
- **Backend APIs**:
  - `GET /api/v1/admin/foundation/billing-profiles` - List profiles
  - `POST /api/v1/admin/foundation/billing-profiles` - Create profile
  - `PATCH /api/v1/admin/foundation/billing-profiles/:profileId` - Update
  - `DELETE /api/v1/admin/foundation/billing-profiles/:profileId` - Delete
- **UI Elements**: Profile list, detail panel, pricing form
- **Real data**: Profile name, monthly charge, tax rate, activation fee

### 4. BNG Nodes Tab
- **Current**: Stub or missing
- **Backend APIs**:
  - `GET /api/v1/admin/foundation/bng-nodes` - List nodes
  - `POST /api/v1/admin/foundation/bng-nodes` - Add node
  - `PATCH /api/v1/admin/foundation/bng-nodes/:nodeId` - Update
  - `DELETE /api/v1/admin/foundation/bng-nodes/:nodeId` - Remove
- **UI Elements**: Node list, detail panel, IP/credentials form
- **Real data**: Node name, IP, RADIUS secret, uptime, active sessions

### 5. NAT Trace Tab
- **Current**: Stub or missing
- **Backend APIs**:
  - `GET /api/v1/admin/foundation/nat-logs` - Query NAT logs
  - `POST /api/v1/admin/foundation/nat-trace` - Trace connection
- **UI Elements**: Trace form (IP/port), results table, session details
- **Real data**: Source IP, dest IP, protocol, state, timestamp

### 6. Billing Cycle / Ledger Adjustments / Refunds
- **Current**: Partial (overview exists)
- **Backend APIs**:
  - `GET /api/v1/admin/billing/ledger` - List entries
  - `POST /api/v1/admin/billing/ledger/adjustment` - Create adjustment
  - `POST /api/v1/admin/billing/refunds` - Create refund
  - `GET /api/v1/admin/billing/invoices` - List invoices (enhance)
- **UI Elements**: Ledger table, adjustment form, refund form, invoice detail
- **Real data**: Entry date, type, amount, customer, notes, approval status

### 7. Device/ACS Actions
- **Current**: Partial (device list exists)
- **Backend APIs**:
  - `PATCH /api/v1/admin/network/device-management/:deviceId/wifi` - Update Wi-Fi
  - `POST /api/v1/admin/network/device-management/:deviceId/reboot` - Reboot
  - `POST /api/v1/admin/network/device-management/:deviceId/pppoe` - Update PPPoE
- **UI Elements**: Device detail panel, Wi-Fi config form, PPPoE form, action buttons
- **Real data**: SSID, password, PPPoE credentials, reboot confirmation

### 8. Installer Ops Visibility
- **Current**: Stub or missing
- **Backend APIs**:
  - `GET /api/v1/admin/installers` - List installers
  - `GET /api/v1/admin/installers/:installerId` - Installer detail
  - `GET /api/v1/admin/sales/bookings` - Pending installations
  - `POST /api/v1/admin/installers/:installerId/assign-booking` - Assign booking
- **UI Elements**: Installer list, booking queue, assignment form, performance KPIs
- **Real data**: Installer name, completion rate, pending jobs, earnings

## Key Patterns

- Use existing `SectionCard`, `DataTable` components from App.jsx
- Error states: Show `error.message` in red banner
- Loading states: Show spinner, disable buttons
- Forms: Collect data, POST/PATCH to backend, refresh list on success
- No hardcoded data except in `@data/demo` with explicit fallback logic

## Verification Checklist

Before marking complete:
- [ ] All tab content renders (no console errors)
- [ ] API calls execute with real backend (can see in Network tab)
- [ ] Error handling works (show errors from failed requests)
- [ ] Demo fallback ONLY activates on API failure (not default)
- [ ] No Jaze references in rendered HTML
- [ ] Forms submit and refresh data
- [ ] Pagination works if applicable
