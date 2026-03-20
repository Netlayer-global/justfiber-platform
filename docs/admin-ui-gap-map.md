# Admin UI Gap Map

Current state of admin tabs (before implementation):

## Tab Completion Matrix

| Tab | Status | Missing |
|-----|--------|---------|
| overview | 80% | Dashboard charts exist, foundation module links missing |
| billing | 60% | Invoice/payments partial, ledger adjustments missing, no refund form |
| network | 70% | Nodes list exists, device config forms missing, NAT trace missing |
| customers | 80% | Customer list exists, detail panel mostly done |
| sales | 40% | List exists, booking queue missing, installer assignment missing |
| installers | 20% | Stub only, full workflow missing |
| support | 80% | Ticket list exists, detail/assign/resolve forms missing |
| devices | 50% | Device list exists, Wi-Fi/PPPoE config forms missing |
| configs | 60% | Config list exists, edit forms partially missing |
| audit | 95% | Mostly complete, may need minor refinements |

## Module-by-Module Gaps

### 1. Subscriber Services
- **Current**: ❌ Missing entirely
- **Needed**: List, create, update, delete forms + real API
- **Blocked by**: None (backend ready)
- **Effort**: 1-2 hours

### 2. Access Profiles
- **Current**: ❌ Missing entirely  
- **Needed**: List, CRUD forms, bandwidth/QoS editor
- **Blocked by**: None (backend ready)
- **Effort**: 1.5-2 hours

### 3. Billing Profiles
- **Current**: ❌ Missing entirely
- **Needed**: List, CRUD forms, pricing editor
- **Blocked by**: None (backend ready)
- **Effort**: 1-1.5 hours

### 4. BNG Nodes
- **Current**: ❌ In overview, not as full tab
- **Needed**: Dedicated tab with full CRUD, detail panel
- **Blocked by**: None (backend ready)
- **Effort**: 1-1.5 hours

### 5. NAT Trace
- **Current**: ❌ Missing entirely
- **Needed**: Trace query form, results table, session details
- **Blocked by**: None (backend ready)
- **Effort**: 1-2 hours

### 6. Billing Ledger Adjustments / Refunds
- **Current**: Ledger read-only, adjustments/refunds stub
- **Needed**: Adjustment form (amount, category, note), refund form
- **Blocked by**: None (backend ready)
- **Effort**: 1.5-2 hours

### 7. Device ACS Actions
- **Current**: Device list only, no config forms
- **Needed**: Wi-Fi config form, PPPoE form, reboot button
- **Blocked by**: None (backend ready)
- **Effort**: 1-1.5 hours

### 8. Installer Ops Visibility
- **Current**: Stub tab with no real data
- **Needed**: Installer list, booking queue, assignment form, KPIs
- **Blocked by**: None (backend ready)
- **Effort**: 1.5-2 hours

## Shared Infrastructure Gaps

- [ ] API methods for all 8 modules need to be callable from `@/lib/api.js`
- [ ] Form validation helpers for billing amounts, network configs
- [ ] Status badge component for various states (pending, active, error, etc)
- [ ] Confirmation modal for destructive actions (delete, reboot)

## Demo/Mock Data Status

**Current state**: `@data/demo.js` exports demo objects that activate when API calls fail

**Issue**: Some tabs may be showing demo data even though API succeeded (false negative)

**Action**: Wrap demo fallback in explicit error check - only show demo if `error` is truthy

## Jaze References Audit

**Current locations**:
- [ ] App.jsx tabs or content
- [ ] @data/demo.js  
- [ ] Component names/descriptions
- [ ] API endpoint comments

**Target**: Remove all Jaze terminology from active UI flows (keep in comments/docs only if needed)
