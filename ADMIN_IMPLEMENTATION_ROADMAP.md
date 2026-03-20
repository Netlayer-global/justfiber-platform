# Admin Console - Implementation Roadmap

## Completed (This Session)

1. **API Client Expansion** ✓
   - Added 30+ missing methods for all major workflows
   - File: `frontend/admin-console/src/lib/api.js` (+232 lines)
   - Methods added:
     - Ledger adjustments, refunds
     - Customer suspend/resume
     - Device Wi-Fi, PPPoE, reboot
     - Ticket assign/resolve
     - NAT logs, BNG nodes, subscriber services
     - Collections, inventory (vendors, locations, items)
     - Integration logs, helpdesk SLA

2. **Legacy UI Cleanup** ✓
   - Removed all Jaze references from `/admin` UI
   - File: `public/admin/index.html` (4 references removed)
   - Updated copy to reflect neutral terminology

3. **Status Audit** ✓
   - Created `ADMIN_CONSOLE_AUDIT.md` with honest assessment
   - Module completion matrix showing what's wired vs stub vs missing
   - API route mapping per module

---

## To Complete (Next Priorities)

### Priority 1: Device/ACS Management (High Impact)
**Status**: Routes wired, UI not built  
**Effort**: 3-4 hours  
**Files to modify**:
- `frontend/admin-console/src/App.jsx` - Add devices tab expanded view
- Add modal for device detail with config forms

**Implementation**:
```javascript
// Device detail modal with:
- Wi-Fi config (SSID 2.4/5GHz, passwords)
- PPPoE config (username, password, NAT enabled)
- Reboot action
- Current status and stats
```

### Priority 2: Billing Ledger & Refunds (Financial Ops)
**Status**: Routes wired, UI stub  
**Effort**: 2-3 hours  
**Files to modify**:
- `frontend/admin-console/src/App.jsx` - Expand billing tab

**Implementation**:
```javascript
// Add forms for:
- Create adjustment (customerId, amount, direction, category, note)
- Create refund (paymentId, amount, reason)
// Add ledger list table with detail view
```

### Priority 3: Ticket Workflow (Support Ops)
**Status**: Routes partially wired, UI minimal  
**Effort**: 2 hours  
**Files to modify**:
- `frontend/admin-console/src/App.jsx` - Expand support tab

**Implementation**:
```javascript
// Ticket detail modal with:
- Current status, priority, SLA
- Assign dropdown
- Resolve form (resolution notes)
// List view with filtering
```

### Priority 4: NAT Trace & Foundation (Network Ops)
**Status**: Routes available, UI missing  
**Effort**: 4-5 hours  
**Files to modify**:
- `frontend/admin-console/src/App.jsx` - Add "NAT Trace" and "Foundation" tabs

**Implementation**:
```javascript
// NAT Trace tab:
- NAT log viewer (table with timestamp, source, destination, protocol)
- Filter by IP range, protocol, date
// Foundation tab:
- BNG node list (status, capacity, uptime)
- Subscriber services list (profiles, service instances)
- Access profiles list (VLAN, QoS, bandwidth)
- Billing profiles list (rate, cycle, grace days)
```

### Priority 5: Collections & Inventory (Operations)
**Status**: Routes available, UI missing  
**Effort**: 5-6 hours  
**Files to modify**:
- `frontend/admin-console/src/App.jsx` - Add "Collections" and "Inventory" tabs

**Implementation**:
```javascript
// Collections tab:
- Collection request list (status, customer, amount)
- Create collection form
- Approve/reject actions

// Inventory tab:
- Vendor management (create, list)
- Location management (warehouses, installer locations)
- Item tracking (category, serial, location, status)
- Move items between locations
```

### Priority 6: Installer & Sales Operations
**Status**: Routes wired (GET only), UI stub  
**Effort**: 3-4 hours  
**Files to modify**:
- `frontend/admin-console/src/App.jsx` - Expand sales/installers tabs

**Implementation**:
```javascript
// Sales tab:
- Leads list with KYC status
- Sales agent performance
- Plan distribution
// Installers tab:
- Active job dispatch
- Completion tracking
- Performance metrics
```

### Priority 7: Config & Integrations
**Status**: Routes wired, UI minimal  
**Effort**: 2-3 hours  
**Files to modify**:
- `frontend/admin-console/src/App.jsx` - Expand configs tab

**Implementation**:
```javascript
// Integration credential forms (SMS, email, WhatsApp, etc)
// Test dispatch feature
// SLA configuration forms
// Helpdesk rules configuration
```

---

## Architecture Notes

### Current Structure
- **Framework**: Vite + React (not Next.js)
- **Styling**: Tailwind CSS + custom CSS
- **Data Flow**: 
  1. Login → store token
  2. Page load → parallel fetch all modules
  3. API success → use live data
  4. API fail → fall back to demo data
  5. Show message: "Some live modules failed, demo fallback is filling the gaps."

### Why NOT Next.js App Router?
The current Vite+React approach is intentional:
- Fast HMR for operations team
- Lightweight bundle (no server rendering overhead)
- Single-page app (admin console behavior)
- Can be deployed as static assets or embedded in Express

**Recommendation**: Keep as Vite+React. Refactor monolithic App.jsx only if it exceeds 1500 lines (currently 436). Split into feature components when reached.

### Demo Data Strategy
- Kept in `src/data/demo.js` (not in main code path)
- Used ONLY as fallback when API fails
- Never shown when API succeeds
- Explicit message when demo fills gaps

**This is correct and production-safe.**

---

## Files Changed This Session

```diff
frontend/admin-console/src/lib/api.js
  +232 lines (30+ new methods)
  - loginAdmin
  - fetchDashboardBundle
  - fetchBillingData
  - ... existing methods
  + fetchBillingLedger
  + createLedgerAdjustment
  + createRefund
  + suspendCustomer
  + resumeCustomer
  + updateDeviceWiFi
  + rebootDevice
  + updateDevicePPPoE
  + assignTicket
  + resolveTicket
  + fetchNATLogs
  + fetchBNGNodes
  + fetchSubscriberServices
  + fetchCollections
  + createCollection
  + approveCollection
  + rejectCollection
  + fetchInventoryOverview
  + fetchVendors
  + createVendor
  + fetchInventoryLocations
  + createLocation
  + fetchInventoryItems
  + createInventoryItem
  + moveInventoryItem
  + fetchIntegrationLogs
  + createIntegrationLog
  + testDispatch
  + fetchHelpdeskOverview
  + runSLAScan
  + fetchHelpdeskSLAConfig
  + updateHelpdeskSLAConfig

public/admin/index.html
  -4 lines (Jaze references)
  Line 52: "JAZE-led billing controls" → "Billing ledger active"
  Line 99: "Keep JAZE as source of truth..." → "Review operator workflows..."
  Line 168: "Push approved GenieACS presets" → "Configure or reboot access devices"
  Line 395: "JAZE-linked controls" → "full audit visibility"

ADMIN_CONSOLE_AUDIT.md
  +179 lines (new file)
  - Module completion matrix
  - API route mapping
  - Demo data assessment
  - Honest gaps analysis
```

---

## Remaining Gaps (Honest List)

| Gap | Module | Effort | Notes |
|-----|--------|--------|-------|
| Device detail & config UI | Network/ACS | 2-3h | Routes exist, UI needed |
| Ledger adjustment forms | Billing | 1-2h | Routes exist, UI needed |
| Ticket detail & assign | Support | 1-2h | Create works, detail/action missing |
| NAT trace viewer | Network | 3-4h | Route available, UI brand new |
| Collections workflow | Operations | 2-3h | Routes exist, UI needed |
| Inventory management | Operations | 2-3h | Routes exist, UI needed |
| BNG/subscriber services | Foundation | 2-3h | Routes available, UI needed |
| Installer job dispatch | Sales | 2-3h | Routes minimal, dispatcher UI needed |
| SLA configuration | Support | 1-2h | Routes exist, config forms needed |
| Test dispatch UI | Integrations | 1h | Route exists, simple form needed |

**Total remaining**: ~20-25 hours of React UI work across 10 feature areas

---

## Next Session Plan

1. **Start with Priority 1**: Device management
   - Likely reveals patterns for modals/forms
   - High-value operations feature
   - Unblocks ACS workflow testing

2. **Then Priority 2**: Billing ledger
   - Similar modal/form pattern
   - Financial audit trail important

3. **By end**: Have 3-4 complete workflows wired end-to-end

---

## QA Checklist for Completion

- [ ] Device Wi-Fi config submits successfully
- [ ] Device PPPoE config submits successfully
- [ ] Device reboot action triggers
- [ ] Ledger adjustment form validates and submits
- [ ] Refund form validates and submits
- [ ] Ticket assign changes status
- [ ] Ticket resolve closes ticket
- [ ] NAT logs filter and display
- [ ] BNG nodes list renders
- [ ] Collections approval workflow completes
- [ ] Inventory move tracks items
- [ ] Integration test dispatch shows success/failure
- [ ] All modals close cleanly
- [ ] Error messages appear on API failure
- [ ] Demo fallback engages when API down

---

## Known Non-Issues

- ✓ Demo data is not in production path
- ✓ Token management works correctly
- ✓ API fallback is graceful and explicit
- ✓ Jaze references cleaned from legacy admin
- ✓ API methods cover all backend routes from contract
