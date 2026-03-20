# Admin UI Execution Checklist

## Phase 1: Foundation & API Setup (0.5 hours)

- [ ] Verify all 8 API methods exist in `@/lib/api.js`
- [ ] Add missing API methods for new modules
- [ ] Add error logging to all API calls (console.log for debugging)
- [ ] Verify demo fallback only triggers on explicit error (not just no data)
- [ ] Remove any Jaze references from App.jsx tab labels/descriptions

## Phase 2: Module Implementation (8-10 hours)

### 2.1 Subscriber Services Tab (1.5h)
- [ ] Create `SubscriberServices` component in App.jsx or extract to separate file
- [ ] API: `GET /api/v1/admin/foundation/subscriber-services`
- [ ] Render service list table with columns: name, bandwidth, QoS, status
- [ ] Add "Create New" button → form modal
- [ ] API: `POST /api/v1/admin/foundation/subscriber-services`
- [ ] Add row click → detail panel with update form
- [ ] API: `PATCH /api/v1/admin/foundation/subscriber-services/:serviceId`
- [ ] Add delete button with confirmation
- [ ] API: `DELETE /api/v1/admin/foundation/subscriber-services/:serviceId`
- [ ] Test all CRUD flows end-to-end

### 2.2 Access Profiles Tab (1.5h)
- [ ] Create `AccessProfiles` component
- [ ] API: `GET /api/v1/admin/foundation/access-profiles`
- [ ] Render profile list table: name, DL/UL speed, VLAN, VLAN priority
- [ ] Add "Create New" → form with bandwidth/QoS editor
- [ ] API: `POST /api/v1/admin/foundation/access-profiles`
- [ ] Add detail panel / update form
- [ ] API: `PATCH /api/v1/admin/foundation/access-profiles/:profileId`
- [ ] Add delete functionality
- [ ] API: `DELETE /api/v1/admin/foundation/access-profiles/:profileId`
- [ ] Test CRUD

### 2.3 Billing Profiles Tab (1h)
- [ ] Create `BillingProfiles` component
- [ ] API: `GET /api/v1/admin/foundation/billing-profiles`
- [ ] Render profile list: name, monthly charge, tax rate, activation fee
- [ ] Add create form with pricing fields
- [ ] API: `POST /api/v1/admin/foundation/billing-profiles`
- [ ] Add update panel
- [ ] API: `PATCH /api/v1/admin/foundation/billing-profiles/:profileId`
- [ ] Add delete
- [ ] API: `DELETE /api/v1/admin/foundation/billing-profiles/:profileId`
- [ ] Test CRUD

### 2.4 BNG Nodes Tab (1.5h)
- [ ] Create `BNGNodes` component
- [ ] API: `GET /api/v1/admin/foundation/bng-nodes`
- [ ] Render node list: name, IP, uptime, active sessions
- [ ] Add "Add Node" form
- [ ] API: `POST /api/v1/admin/foundation/bng-nodes`
- [ ] Add detail panel with update form (IP, RADIUS secret)
- [ ] API: `PATCH /api/v1/admin/foundation/bng-nodes/:nodeId`
- [ ] Add remove button
- [ ] API: `DELETE /api/v1/admin/foundation/bng-nodes/:nodeId`
- [ ] Test CRUD

### 2.5 NAT Trace Tab (1.5h)
- [ ] Create `NATTrace` component
- [ ] Add search form: source IP, dest IP, protocol filter
- [ ] API: `GET /api/v1/admin/foundation/nat-logs` (query with filters)
- [ ] Render results table: source IP, dest IP, protocol, state, timestamp
- [ ] Add "Trace" button for real-time trace
- [ ] API: `POST /api/v1/admin/foundation/nat-trace` (if available)
- [ ] Show trace results / session details
- [ ] Add pagination if result set large

### 2.6 Billing Ledger / Adjustments / Refunds (1.5h)
- [ ] Enhance billing tab with sub-tabs: overview, invoices, payments, ledger
- [ ] API: `GET /api/v1/admin/billing/ledger`
- [ ] Render ledger table: date, type, amount, customer, notes
- [ ] Add "New Adjustment" button → form
  - Fields: customer ID, amount, direction (credit/debit), category, note
  - API: `POST /api/v1/admin/billing/ledger/adjustment`
- [ ] Add "New Refund" button → form
  - Fields: payment ID, amount, reason
  - API: `POST /api/v1/admin/billing/refunds`
- [ ] Add approval workflow if required
- [ ] Test both workflows

### 2.7 Device ACS Actions (1.5h)
- [ ] Enhance devices tab detail panel
- [ ] Add "Wi-Fi Settings" button → modal form
  - Fields: SSID 2.4GHz, SSID 5GHz, password 2.4GHz, password 5GHz
  - API: `PATCH /api/v1/admin/network/device-management/:deviceId/wifi`
- [ ] Add "PPPoE Settings" button → modal form
  - Fields: PPPoE username, PPPoE password, NAT enabled
  - API: `POST /api/v1/admin/network/device-management/:deviceId/pppoe`
- [ ] Add "Reboot" button with confirmation
  - API: `POST /api/v1/admin/network/device-management/:deviceId/reboot`
- [ ] Test all device actions

### 2.8 Installer Ops Visibility (1.5h)
- [ ] Create `Installers` tab component
- [ ] API: `GET /api/v1/admin/installers`
- [ ] Render installer list: name, completion %, pending jobs, earnings
- [ ] Add detail panel on row click
- [ ] API: `GET /api/v1/admin/installers/:installerId`
- [ ] Show pending bookings queue
- [ ] API: `GET /api/v1/admin/sales/bookings`
- [ ] Add "Assign Booking" form in installer detail
- [ ] API: `POST /api/v1/admin/installers/:installerId/assign-booking`
- [ ] Test assignment workflow

## Phase 3: Polish & Testing (1-2 hours)

- [ ] Verify all tabs load without console errors
- [ ] Verify Network tab shows real API calls (not demo data by default)
- [ ] Verify error messages display on API failures
- [ ] Verify forms properly validate/submit
- [ ] Verify pagination works where applicable
- [ ] Search/filter functionality working
- [ ] Check for any remaining Jaze references
- [ ] Test with real backend (not mock)

## Phase 4: Final Audit (0.5 hours)

- [ ] Generate completion matrix:
  - Fully wired: X modules
  - Partially wired: Y modules
  - Backend-blocked: Z modules
- [ ] Verify demo data only activates on API errors (not default)
- [ ] Verify Jaze removed from active paths (can appear in comments/docs)
- [ ] Document all files changed
- [ ] Document all backend APIs used per module
- [ ] Create final report

## Time Estimate

- Foundation: 0.5h
- Modules (8 x 1-1.5h): 9h
- Polish: 1.5h
- Audit: 0.5h
- **Total: 11.5 hours**

## Success Criteria

✓ All 8 modules have working CRUD  
✓ Real backend API data (demo only on error)  
✓ No Jaze references in UI  
✓ All forms validate and submit  
✓ Error handling throughout  
✓ No console errors  
✓ Network tab shows real API calls
