# Final UAT Checklist

Use this sheet for final pass across customer app, admin panel, installer app, and backend-connected flows.

Legend:
- `PASS`
- `FAIL`
- `BLOCKED`
- `NA`

Record every failed item with:
- exact screen/flow
- device/browser
- error text
- screenshot or video
- fix commit

---

## 1. Customer App

### 1.1 Authentication

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | OTP send | OTP request succeeds |  |  |
|  | OTP verify | Login succeeds |  |  |
|  | Session restore | App opens with saved session |  |  |
|  | Logout | Session cleared |  |  |
|  | Multi-connection switch | Selected connection changes dashboard/billing/support data |  |  |

### 1.2 Booking

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Address form | Name, mobile, email, address, pin save correctly |  |  |
|  | Current location | Map centers on live location |  |  |
|  | Manual pin drop | Pin updates location |  |  |
|  | Feasible area | User reaches plan selection |  |  |
|  | Not feasible area | Full-page unavailable message shows |  |  |
|  | Feasibility lead | Lead visible in admin/sales |  |  |
|  | Plan selection | Active admin plan appears |  |  |
|  | Duration selection | 1/3/6/12 month pricing correct |  |  |
|  | Checkout page | Full summary visible |  |  |
|  | Razorpay payment success | Booking payment succeeds |  |  |
|  | Razorpay payment failure | Retry flow works |  |  |
|  | Slot confirmation | Slot saves successfully |  |  |
|  | Booking tracking | Booking ID and progress visible |  |  |

### 1.3 Billing

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Billing checkout | Bill details visible before payment |  |  |
|  | Bill payment success | Receipt page opens |  |  |
|  | Bill payment failure | Retry payment works |  |  |
|  | Paid status | Billing status updates to paid |  |  |
|  | Service resume | Suspended service resumes after payment |  |  |
|  | Receipt share | Receipt share/back actions work |  |  |

### 1.4 Support

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Support chat open | Chat screen opens |  |  |
|  | Internet issue | Smart diagnosis appears |  |  |
|  | Wi-Fi issue | Smart diagnosis appears |  |  |
|  | Slow speed | Smart diagnosis appears |  |  |
|  | Bill issue | Billing diagnosis appears |  |  |
|  | Plan issue | FUP/data-limit diagnosis appears |  |  |
|  | Follow-up prompt | `still not resolved` handled properly |  |  |
|  | Human handoff | `human` / `agent` escalation works |  |  |
|  | Complaint raise | Ticket creates successfully |  |  |
|  | Ticket card | Latest ticket context visible in chat |  |  |

### 1.5 Wi-Fi Controls

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Pause/resume Wi-Fi | State updates |  |  |
|  | Rename SSID/password | Save succeeds |  |  |
|  | Guest Wi-Fi | Toggle/save works |  |  |
|  | Connected devices | Device list loads |  |  |
|  | Device block/unblock | Access control works |  |  |
|  | Diagnostics | Metrics load correctly |  |  |
|  | Parental rules | Add/remove rules works |  |  |

### 1.6 Notifications and Home

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Home dashboard | Current connection and summary load |  |  |
|  | Book now CTA | Booking opens |  |  |
|  | Pay bill CTA | Billing checkout opens |  |  |
|  | Notification list | Notifications visible |  |  |
|  | Payment/booking alerts | Correct alerts received |  |  |

---

## 2. Admin Panel

### 2.1 Login and Dashboard

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Login page | UI loads correctly |  |  |
|  | Login success | Redirect to dashboard |  |  |
|  | Dashboard widgets | No client-side exception |  |  |
|  | OTP fetch | OTP route works |  |  |

### 2.2 Plans

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Existing plans list | Plans visible on landing |  |  |
|  | New plan button | Create form opens only on click |  |  |
|  | Draft save | Incomplete plan saves as draft |  |  |
|  | Activate plan | Active status updates |  |  |
|  | Edit plan | Changes persist |  |  |
|  | Copy plan | Clone creates correctly |  |  |
|  | Delete plan | Archived/removed from apps |  |  |
|  | Duration pricing | Monthly/quarterly/half-yearly/yearly save correctly |  |  |
|  | Active plan in app | Same plan shows in customer app |  |  |

### 2.3 Customers and Billing

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Customer list | Loads correctly |  |  |
|  | Customer detail | Billing/support/usage visible |  |  |
|  | Billing export | PDF/export links work |  |  |
|  | Upgrade recommendation | Visible for high-usage customers |  |  |

### 2.4 Devices and Support Ops

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Genie sync | Device cache sync works |  |  |
|  | Device online status | Online/offline updates correctly |  |  |
|  | Ticket visibility | Support tickets visible with correct context |  |  |

---

## 3. Installer App

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Login | Installer login works |  |  |
|  | Dashboard | Jobs summary visible |  |  |
|  | Jobs list | Active jobs load |  |  |
|  | Job detail | Workflow pages load |  |  |
|  | Preview/diagnostics refresh | Buttons refresh real values |  |  |
|  | OTP completion | Completion OTP flow works |  |  |
|  | Install completion | Job completes successfully |  |  |
|  | Queue refresh | Completed job leaves active queue |  |  |

---

## 4. Backend and Provisioning

| Status | Flow | Expected | Notes | Fix Commit |
|---|---|---|---|---|
|  | Plan catalog sync | Admin active plan visible in customer/sales |  |  |
|  | PPPoE provisioning | Username/password/profile generated correctly |  |  |
|  | VLAN apply | VLAN info persists and activates |  |  |
|  | Wi-Fi naming | SSID template applies correctly |  |  |
|  | Billing payment webhook | Success and failure update correctly |  |  |
|  | Booking payment verify | Booking status updates correctly |  |  |
|  | Service resume after payment | Suspended account resumes |  |  |
|  | FUP/hard-cap handling | Policy changes visible |  |  |
|  | SMS dispatch | Success notifications sent |  |  |
|  | Push notification dispatch | App notifications received |  |  |

---

## 5. Release Sign-off

Release can be marked ready only if all critical flows are `PASS`:

- Customer login
- Booking payment success/failure
- Slot confirmation
- Billing payment success/failure
- Support complaint raise
- Admin plan activation -> customer app visibility
- Installer completion
- PPPoE provisioning
- Service activation/resume
- Real notifications

Final release result:

| Item | Result | Notes |
|---|---|---|
| Customer app |  |  |
| Admin panel |  |  |
| Installer app |  |  |
| Backend |  |  |
| Release ready |  |  |
