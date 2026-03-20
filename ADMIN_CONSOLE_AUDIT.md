# Admin Console - Truthful Status Audit

## Current State

**Platform**: Vite + React  
**Entry Point**: `frontend/admin-console/src/App.jsx` (monolithic, 436 lines)  
**Status**: Partially wired to real backend APIs with demo data fallback  
**Legacy**: `public/admin/index.html` + `public/admin/app.js` with Jaze references (legacy, not actively used)

---

## Module Completion Matrix

| Module | Status | API Wired | Demo Fallback | Gap |
|--------|--------|-----------|---------------|-----|
| **Dashboard/Overview** | PARTIAL | ✓ | ✓ | Missing: Foundation overview, KPI analytics, trend analysis |
| **Billing** | PARTIAL | ✓ | ✓ | Missing: Ledger adjustments, refunds workflow, cycle run detail, payment links |
| **Network/NOC** | PARTIAL | ✓ | ✓ | Missing: BNG node detail, subscriber services, NAT trace/review, ACS device detail |
| **Customers/CRM** | PARTIAL | ✓ | ✓ | Missing: Customer detail view, suspend/resume actions, billing snapshot per customer |
| **Tickets/Support** | PARTIAL | ✓ | ~ | Missing: Ticket detail, assignment, resolution workflows, SLA tracking |
| **Sales/Installers** | STUB | ~ | ~ | Missing: Full sales pipeline, KYC workflow, installer job dispatch, job tracking |
| **Devices/ACS** | STUB | ~ | ~ | Missing: Device detail, Wi-Fi config, PPPoE config, reboot action, presets |
| **Configs/Integrations** | STUB | ~ | ~ | Missing: Config form UX, integration credential management, test dispatch |
| **Audit/Logs** | STUB | ~ | ~ | Missing: Log filtering, detail view, integration event logs |
| **Platform Foundation** | MISSING | ✗ | ✗ | Missing: Access Profiles, Billing Profiles, BNG Nodes, Subscriber Services |
| **NAT Trace** | MISSING | ✗ | ✗ | Missing: NAT log viewer, trace playback, packet analysis view |

---

## API Route Mapping (from contract)

### Fully Wired
- `GET /api/v1/admin/dashboard/executive` → Dashboard KPIs
- `GET /api/v1/admin/dashboard/billing` → Billing overview
- `GET /api/v1/admin/dashboard/network` → Network overview
- `GET /api/v1/admin/customers` → Customer list (search supported)
- `GET /api/v1/admin/customers/:customerId` → Customer detail
- `GET /api/v1/admin/billing/overview` → Billing summary
- `GET /api/v1/admin/billing/invoices` → Invoice list
- `GET /api/v1/admin/billing/payments` → Payment list
- `GET /api/v1/admin/network/overview` → Network KPIs
- `GET /api/v1/admin/network/nodes` → Node list
- `GET /api/v1/admin/devices` → Device list
- `GET /api/v1/admin/devices/:deviceId` → Device detail
- `GET /api/v1/admin/tickets` → Ticket list
- `POST /api/v1/admin/tickets` → Create ticket
- `GET /api/v1/admin/installers` → Installer list
- `GET /api/v1/admin/integrations` → Integrations list
- `GET /api/v1/admin/audit/logs` → Audit logs
- `GET /api/v1/admin/configs` → Configs list

### Partially Wired (Missing Detail/Action)
- `GET /api/v1/admin/customers/:customerId/suspend` (marked as POST in contract, not implemented)
- `GET /api/v1/admin/customers/:customerId/resume` (marked as POST in contract, not implemented)

### Not Wired (Routes exist but no UI)
- `GET /api/v1/admin/billing/ledger` → Ledger list
- `POST /api/v1/admin/billing/ledger/adjustment` → Create adjustment
- `POST /api/v1/admin/billing/refunds` → Create refund
- `PATCH /api/v1/admin/network/device-management/:deviceId/wifi` → Update Wi-Fi config
- `POST /api/v1/admin/network/device-management/:deviceId/reboot` → Reboot device
- `POST /api/v1/admin/network/device-management/:deviceId/pppoe` → Update PPPoE config
- `GET /api/v1/admin/foundation/nat-logs` → NAT trace logs
- `GET /api/v1/admin/foundation/bng-nodes` → BNG nodes (foundation)
- `GET /api/v1/admin/foundation/subscriber-services` → Subscriber services (foundation)
- `POST /api/v1/admin/tickets/:ticketId/assign` → Assign ticket
- `POST /api/v1/admin/tickets/:ticketId/resolve` → Resolve ticket
- `POST /api/v1/admin/foundation/collections/*` → Collections workflow
- `POST /api/v1/admin/foundation/franchises/*` → Franchise management
- `GET /api/v1/admin/foundation/inventory/*` → Inventory management
- `GET /api/v1/admin/foundation/logs/*` → All log types
- `POST /api/v1/admin/foundation/dispatch/test-message` → Test integration dispatch

---

## Files to Modify

| File | Changes | Reason |
|------|---------|--------|
| `frontend/admin-console/src/App.jsx` | Expand tabs, add modal/drawer UX, wire device/customer detail actions | Currently has basic tab UI, missing action workflows |
| `frontend/admin-console/src/lib/api.js` | Add 20+ new API methods for missing workflows | Only 18 methods exist, need: adjustments, refunds, device actions, ticket actions, collections, inventory, etc |
| `frontend/admin-console/src/data/demo.js` | Expand demo data for missing modules | Currently thin, need: ledger items, device configs, SLA rules, collections, inventory |
| `public/admin/index.html` | Remove Jaze references from sidebar/body copy | Lines 52, 99, 168, 172, 395 mention JAZE |
| `public/admin/app.js` | Remove or verify if still active | May be legacy, need to verify if used |

---

## Demo Data Still Present

Live data falls back to demo when API fails:

```javascript
// Lines 42-50 in App.jsx
import {
  brandDistribution,
  demoCustomers,
  demoDevices,
  demoInvoices,
  demoNodes,
  demoOverview,
  demoPayments,
  demoSales,
  trendSeries
} from "@/data/demo";
```

State initialization uses demo as default (line 115-127):

```javascript
const [data, setData] = useState({
  overview: demoOverview,
  billing: { overview: demoOverview.billing, invoices: demoInvoices, ... },
  // etc - all default to demo
});
```

This is correct behavior (graceful fallback), but should be explicit with a flag.

---

## Jaze References in Legacy Admin

File: `public/admin/index.html`

- Line 52: "JAZE-led billing controls"
- Line 99: "Keep JAZE as the source of truth, drive ACS writes through controlled workflows"
- Line 168: "Suspend or resume customer service" (ACS action, not JAZE-specific)
- Line 172: "Push approved GenieACS presets"
- Line 395: "while keeping JAZE-linked controls visible"

**Status**: This is the legacy `/admin` route, separate from React app at `/admin-preview`. Can clean up references or deprecate entirely.

---

## Next Steps to Complete

1. **Expand API Client** (`lib/api.js`): Add 20+ missing methods
2. **Add Device/Customer Detail Modals** (`App.jsx`): Wire customer suspend/resume, device Wi-Fi/PPPoE config
3. **Add Ledger/Refund Forms** (`App.jsx`): Billing adjustments and refunds workflow
4. **Add Device Management UI** (`App.jsx`): Device detail, config forms, reboot action
5. **Add NAT Trace Tab** (`App.jsx`): NAT log viewer (new tab)
6. **Add Foundation Module** (`App.jsx`): BNG nodes, subscriber services, access/billing profiles
7. **Expand Ticket Workflow** (`App.jsx`): Ticket detail modal, assign/resolve actions
8. **Add Collections Workflow** (`App.jsx`): Collections request creation/approval (franchise integration)
9. **Add Inventory Module** (`App.jsx`): Vendor/location/item management
10. **Clean Jaze References**: Update `public/admin/index.html` to remove outdated copy

---

## Demo Fallback Behavior (CORRECT)

The current pattern (App.jsx lines 144-158) properly handles API failures:

```javascript
setData((current) => ({
  ...current,
  overview: jobs[0].status === "fulfilled" ? jobs[0].value : current.overview,
  // ... fallback to current (demo) if API fails
}));

if (jobs.some((job) => job.status === "rejected")) {
  setMessage("Some live modules failed, demo fallback is filling the gaps.");
}
```

This is production-safe: API-first, demo fallback on failure.

---

## Honest Assessment

- **What works**: Dashboard, billing overview, customer search, device list, ticket creation, audit logs list
- **What's incomplete**: All detail/action workflows, ledger/refund forms, device configuration, NAT tracing, collections, inventory
- **What's missing**: Platform Foundation (Access/Billing Profiles, BNG mgmt), NAT trace viewer, installer job dispatch UI
- **Demo data**: Correctly gated behind API failures, not in production path
- **Legacy cruft**: `public/admin` has Jaze references; `public/admin/app.js` likely unused

This is a foundation that needs workflow expansion, not a complete solution.
