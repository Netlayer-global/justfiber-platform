# Technical Design: In-App Payment Flow

## 1. Architecture Overview

JustFiber follows a **Backend → Jaze API proxy** pattern. The Node.js backend never owns payment state — it validates requests, proxies them to the Jaze API, and adapts responses for client consumption. The existing `jazeClient.js` already exposes `getPaymentLink()` and `makePayment()` methods; the `jazeBillingAdapter.js` already has a `generatePaymentLink()` adapter function.

```
┌─────────────────┐       ┌──────────────────┐       ┌───────────────┐
│  Flutter App    │──JWT──▶│  Express Backend  │──API──▶│   Jaze API    │
│  (Customer)     │◀──────│  (Proxy/Adapter)  │◀──────│  (Source of   │
└─────────────────┘       └──────────────────┘       │   Truth)      │
                                                      └───────────────┘
┌─────────────────┐       │
│  Next.js Admin  │──JWT──▶│
│  (Admin/Install)│◀──────│
└─────────────────┘
```

**Key principle:** JustFiber is a thin UI layer. Jaze owns billing, invoicing, and payment processing. The backend adds auth, validation, and response shaping.

---

## 2. Backend Design

### 2.1 New Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/customer/billing/jaze/payment-link` | POST | Customer JWT (`requireCustomerAuth`) | Generate Jaze UPI payment link |
| `/api/v1/admin/payments/collect-cash` | POST | Admin/Installer JWT (`requireAuth` or `requireInstallerAuth`) | Record cash collection via Jaze |

### 2.2 Payment Link Endpoint

**Route:** `POST /api/v1/customer/billing/jaze/payment-link`

**Auth middleware:** `requireCustomerAuth` (from `src/common/customerAuth.js`)

**Request:** No body required — the customer's `jazeUserId` is resolved from their linked customer record.

```js
// src/modules/customerPortal/routes.js (add to existing router)

customerPortalRouter.post(
  "/billing/jaze/payment-link",
  requireCustomerAuth,
  asyncHandler(async (req, res) => {
    const customerUser = req.customerUser;
    const linkedIds = customerUser.linkedCustomerIds || [];
    if (!linkedIds.length) {
      throw new ApiError(400, "No linked customer account found. Contact support.");
    }

    // Resolve the first linked customer with a jazeUserId
    const customer = await Customer.findOne({
      customerId: { $in: linkedIds },
      jazeUserId: { $exists: true, $ne: "" }
    }).lean();

    if (!customer?.jazeUserId) {
      throw new ApiError(400, "Customer must be activated via an installer first.");
    }

    const { paymentLink } = await generatePaymentLink(customer.jazeUserId);

    if (!paymentLink || !paymentLink.startsWith("https://")) {
      throw new ApiError(502, "Payment link could not be generated. Try again later.");
    }

    return ok(res, { paymentLink, customerId: customer.customerId });
  })
);
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "paymentLink": "https://payments.jaze.in/pay/abc123",
    "customerId": "CUST-001"
  }
}
```

**Error responses:**
| Status | Condition |
|--------|-----------|
| 400 | No linked customer or missing `jazeUserId` |
| 401 | Invalid/missing customer JWT |
| 502 | Jaze API failure or empty/non-HTTPS link returned |

### 2.3 Cash Collection Endpoint

**Route:** `POST /api/v1/admin/payments/collect-cash`

**Auth middleware:** `requireAuth` (admin) OR `requireInstallerAuth` (installer) — use a combined middleware.

**Request body:**
```json
{
  "customerId": "CUST-001",
  "amount": 599.00,
  "method": "cash",
  "notes": "Collected at customer premises, receipt #R-4521"
}
```

**Validation rules:**
- `customerId` — required, must match an existing Customer with a linked `jazeUserId`
- `amount` — required, number, `0.01 ≤ amount ≤ 999999.99`
- `method` — required, one of `["cash", "onlinePayment", "manualCollection"]`
- `notes` — optional, string, max 500 characters

```js
// src/modules/adminOps/paymentRoutes.js (new file)

import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.js";
import { ok } from "../../common/response.js";
import { ApiError } from "../../common/ApiError.js";
import { requireAuth } from "../../common/auth.js";
import { requireInstallerAuth } from "../../common/installerAuth.js";
import { Customer } from "../../models/Customer.js";
import { jazeClient } from "../../integrations/jazeClient.js";

export const paymentRouter = Router();

// Combined auth: accept either admin or installer JWT
function requireAdminOrInstaller(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required"));
  }
  // Try admin first, fall back to installer
  requireAuth(req, res, (err) => {
    if (!err) return next();
    requireInstallerAuth(req, res, next);
  });
}

const VALID_METHODS = ["cash", "onlinePayment", "manualCollection"];

paymentRouter.post(
  "/collect-cash",
  requireAdminOrInstaller,
  asyncHandler(async (req, res) => {
    const { customerId, amount, method = "cash", notes = "" } = req.body;

    // Validation
    if (!customerId) {
      throw new ApiError(400, "customerId is required");
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0.01 || numAmount > 999999.99) {
      throw new ApiError(400, "Amount must be between 0.01 and 999,999.99");
    }
    if (!VALID_METHODS.includes(method)) {
      throw new ApiError(400, `Method must be one of: ${VALID_METHODS.join(", ")}`);
    }
    if (notes && notes.length > 500) {
      throw new ApiError(400, "Notes must be 500 characters or fewer");
    }

    // Resolve customer
    const customer = await Customer.findOne({ customerId }).lean();
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    if (!customer.jazeUserId) {
      throw new ApiError(404, "Customer is not activated (no Jaze account linked)");
    }

    // Call Jaze makePayment
    const collectorName = req.admin?.name || req.installer?.name || "System";
    const fullNotes = notes
      ? `${notes} | Collected by: ${collectorName}`
      : `Cash collected by: ${collectorName}`;

    let jazeResponse;
    try {
      jazeResponse = await jazeClient.makePayment({
        userId: customer.jazeUserId,
        amount: numAmount,
        method,
        notes: fullNotes
      });
    } catch (err) {
      throw new ApiError(502, `Jaze payment failed: ${err.message}`);
    }

    return ok(res, {
      transactionId: jazeResponse?.transactionId || jazeResponse?.id || null,
      customerId,
      amount: numAmount,
      method,
      notes: fullNotes,
      recordedAt: new Date().toISOString(),
      jazeRaw: jazeResponse
    });
  })
);
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "transactionId": "TXN-98765",
    "customerId": "CUST-001",
    "amount": 599.00,
    "method": "cash",
    "notes": "Collected at premises | Collected by: Ravi Kumar",
    "recordedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error responses:**
| Status | Condition |
|--------|-----------|
| 400 | Missing/invalid fields (customerId, amount, method, notes) |
| 401 | Invalid/missing JWT |
| 404 | Customer not found or not activated |
| 502 | Jaze API unreachable or rejects the payment |

---

## 3. Flutter Customer App Design

### 3.1 Payment WebView Screen

New screen: `lib/src/screens/payment_webview_screen.dart`

**Package:** `webview_flutter` (already standard for Flutter WebView)

```dart
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class PaymentWebViewScreen extends StatefulWidget {
  final String paymentUrl;
  final String jazeDomain; // e.g., "payments.jaze.in"

  const PaymentWebViewScreen({
    super.key,
    required this.paymentUrl,
    required this.jazeDomain,
  });

  @override
  State<PaymentWebViewScreen> createState() => _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends State<PaymentWebViewScreen> {
  late final WebViewController _controller;
  PaymentFlowState _state = PaymentFlowState.loading;
  DateTime? _startedAt;

  @override
  void initState() {
    super.initState();
    _startedAt = DateTime.now();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: _onNavigationRequest,
        onPageFinished: (_) => setState(() => _state = PaymentFlowState.webviewOpen),
        onWebResourceError: (_) => setState(() => _state = PaymentFlowState.failure),
      ))
      ..loadRequest(Uri.parse(widget.paymentUrl));

    // 10-minute session timeout
    Future.delayed(const Duration(minutes: 10), _handleTimeout);
  }

  NavigationDecision _onNavigationRequest(NavigationRequest request) {
    final uri = Uri.parse(request.url);

    // Block non-HTTPS
    if (uri.scheme != 'https') {
      setState(() => _state = PaymentFlowState.failure);
      return NavigationDecision.prevent;
    }

    // Domain whitelist
    if (!uri.host.contains(widget.jazeDomain) && !uri.host.contains('justfiber')) {
      return NavigationDecision.prevent;
    }

    // Detect success/failure callbacks
    if (uri.path.contains('/payment/success') || uri.queryParameters.containsKey('payment_success')) {
      setState(() => _state = PaymentFlowState.success);
      _closeWithResult(true);
      return NavigationDecision.prevent;
    }
    if (uri.path.contains('/payment/failure') || uri.queryParameters.containsKey('payment_failed')) {
      setState(() => _state = PaymentFlowState.failure);
      _closeWithResult(false);
      return NavigationDecision.prevent;
    }

    return NavigationDecision.navigate;
  }

  void _handleTimeout() {
    if (_state == PaymentFlowState.webviewOpen || _state == PaymentFlowState.loading) {
      setState(() => _state = PaymentFlowState.failure);
      // Show timeout dialog
    }
  }

  void _closeWithResult(bool success) {
    _controller.clearCache();
    Navigator.of(context).pop(success);
  }

  // ... build method with loading indicator, back-button confirmation dialog
}

enum PaymentFlowState { idle, loading, webviewOpen, success, failure }
```

### 3.2 Payment Flow State Machine

```
┌──────┐   initiate    ┌─────────┐   page loaded   ┌──────────────┐
│ idle │──────────────▶│ loading │────────────────▶│ webview_open │
└──────┘               └─────────┘                 └──────┬───────┘
                            │                             │
                       load error                    ┌────┴────┐
                            │                        │         │
                            ▼                  success URL  failure URL / timeout / dismiss
                       ┌─────────┐                   │         │
                       │ failure │◀──────────────────┘         │
                       └─────────┘                             ▼
                                                         ┌─────────┐
                            ┌────────────────────────────│ success │
                            │                            └─────────┘
                            ▼
                    [auto-refresh billing]
```

### 3.3 Integration with billing_history_screen.dart

The existing `_payNow` method in `BillingHistoryScreen` currently shows a SnackBar with the payment URL. Replace with WebView navigation:

```dart
Future<void> _payNow(BuildContext context, AppState appState, JazeBillingView? jazeBilling) async {
  final messenger = ScaffoldMessenger.of(context);

  // Request payment link from backend
  String? paymentUrl;
  if (jazeBilling?.payment?.paymentLink.isNotEmpty ?? false) {
    paymentUrl = jazeBilling!.payment!.paymentLink;
  } else {
    // Fetch fresh payment link from backend
    paymentUrl = await appState.api.requestPaymentLink(appState.session!);
  }

  if (paymentUrl == null || paymentUrl.isEmpty) {
    messenger.showSnackBar(const SnackBar(content: Text('Unable to generate payment link.')));
    return;
  }

  if (!context.mounted) return;

  // Open WebView
  final success = await Navigator.of(context).push<bool>(
    MaterialPageRoute(
      builder: (_) => PaymentWebViewScreen(
        paymentUrl: paymentUrl!,
        jazeDomain: 'jaze.in', // configurable
      ),
    ),
  );

  // Auto-refresh billing on success
  if (success == true) {
    await appState.loadJazeBilling();
    if (context.mounted) {
      messenger.showSnackBar(const SnackBar(content: Text('Payment successful! Refreshing billing...')));
    }
  }
}
```

### 3.4 Payment Completion Detection

URL pattern matching for Jaze payment callbacks:

| Pattern | Result |
|---------|--------|
| URL path contains `/payment/success` | Payment succeeded |
| URL query has `payment_success=true` | Payment succeeded |
| URL path contains `/payment/failure` | Payment failed |
| URL query has `payment_failed=true` | Payment failed |

These patterns should be configurable via a constant or remote config to adapt if Jaze changes their callback URLs.

### 3.5 Auto-Refresh Billing After Payment

After `PaymentWebViewScreen` pops with `true`:
1. Call `appState.loadJazeBilling()` (existing method)
2. Show loading indicator on billing screen
3. If response still shows old outstanding (stale), display note: "Payment processing may take up to 2 minutes" + manual refresh button
4. 10-second timeout on the refresh call — if exceeded, show "Billing temporarily unavailable" with retry button

---

## 4. Admin UI Design (Next.js)

### 4.1 Cash Collection Component

Add a "Collect Cash" section to the existing `BillingTab` in `customers/[customerId]/page.tsx`:

```tsx
// Component within BillingTab
function CashCollectionSection({ customer }: { customer: Customer }) {
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const outstanding = customer.billingSnapshot?.outstanding ?? 0
  const numAmount = parseFloat(amount) || 0
  const isValid = numAmount >= 1 && numAmount <= outstanding && customer.jazeUserId

  async function handleSubmit() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/v1/admin/payments/collect-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId: customer.customerId,
          amount: numAmount,
          method: 'cash',
          notes
        })
      })
      const data = await res.json()
      if (data.success) {
        setResult({ success: true, message: `Payment recorded. TXN: ${data.data.transactionId}` })
        setAmount('')
        setNotes('')
      } else {
        setResult({ success: false, message: data.message || 'Payment failed' })
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Collect Cash Payment</CardTitle></CardHeader>
      <div className="p-4 space-y-4">
        <div className="text-sm text-slate-500">
          Customer: <strong>{customer.fullName}</strong> |
          Outstanding: <strong>Rs {outstanding.toFixed(2)}</strong> |
          Jaze ID: <code>{customer.jazeUserId || 'Not linked'}</code>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Amount (Rs)" type="number" value={amount} onChange={setAmount}
                 min={1} max={outstanding} step="0.01" />
          <Input label="Notes (optional)" value={notes} onChange={setNotes}
                 maxLength={500} placeholder="Receipt #, collector name..." />
        </div>

        <Button onClick={() => setShowConfirm(true)} disabled={!isValid || loading}>
          {loading ? 'Processing...' : 'Collect Cash'}
        </Button>

        {result && <Alert variant={result.success ? 'success' : 'error'}>{result.message}</Alert>}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <ConfirmDialog
          title="Confirm Cash Collection"
          message={`Record Rs ${numAmount.toFixed(2)} cash payment for ${customer.fullName}?`}
          onConfirm={handleSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </Card>
  )
}
```

### 4.2 Form Fields

| Field | Type | Validation | Required |
|-------|------|-----------|----------|
| Amount | number input | 1 ≤ value ≤ outstanding, max 2 decimal places | Yes |
| Notes | text input | max 500 chars | No |

### 4.3 Confirmation Dialog

Before submission, display:
- Customer name
- Amount to collect
- Payment method ("Cash")
- Notes (if provided)

Two buttons: "Confirm" and "Cancel"

### 4.4 API Integration

```ts
// lib/api.ts
export async function collectCashPayment(token: string, payload: {
  customerId: string
  amount: number
  method: 'cash' | 'onlinePayment' | 'manualCollection'
  notes?: string
}) {
  const res = await fetch(`${API_BASE}/api/v1/admin/payments/collect-cash`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  })
  return res.json()
}
```

---

## 5. Data Flow Diagrams

### 5.1 UPI Payment Flow

```
Customer App                    Backend                         Jaze API
    │                              │                               │
    │  POST /billing/jaze/         │                               │
    │  payment-link                │                               │
    │─────────────────────────────▶│                               │
    │                              │  Validate JWT                 │
    │                              │  Resolve jazeUserId           │
    │                              │                               │
    │                              │  POST /get_payment_link       │
    │                              │──────────────────────────────▶│
    │                              │                               │
    │                              │◀──────────────────────────────│
    │                              │  { payment_link: "..." }      │
    │◀─────────────────────────────│                               │
    │  { paymentLink: "https://.."}│                               │
    │                              │                               │
    │  Open WebView ───────────────┼───────────────────────────────┼──▶ Jaze Payment Page
    │                              │                               │
    │  [Customer completes UPI]    │                               │
    │                              │                               │
    │  ◀── Redirect to success URL │                               │
    │                              │                               │
    │  Close WebView               │                               │
    │                              │                               │
    │  GET /billing/jaze/summary   │                               │
    │─────────────────────────────▶│  GET /get_details/:userId     │
    │                              │──────────────────────────────▶│
    │                              │◀──────────────────────────────│
    │◀─────────────────────────────│                               │
    │  [Updated billing displayed] │                               │
```

### 5.2 Cash Collection Flow

```
Admin UI                        Backend                         Jaze API
    │                              │                               │
    │  POST /admin/payments/       │                               │
    │  collect-cash                │                               │
    │  { customerId, amount,       │                               │
    │    method: "cash", notes }   │                               │
    │─────────────────────────────▶│                               │
    │                              │  Validate JWT (admin/installer)│
    │                              │  Validate request body         │
    │                              │  Lookup Customer → jazeUserId  │
    │                              │                               │
    │                              │  POST /make_payment            │
    │                              │  { userId, amount, method,     │
    │                              │    notes }                     │
    │                              │──────────────────────────────▶│
    │                              │                               │
    │                              │◀──────────────────────────────│
    │                              │  { transactionId, ... }       │
    │◀─────────────────────────────│                               │
    │  { success, transactionId,   │                               │
    │    amount, recordedAt }      │                               │
    │                              │                               │
    │  [Show success notification] │                               │
```

---

## 6. Security Considerations

### 6.1 WebView Security

| Control | Implementation |
|---------|---------------|
| HTTPS-only | `NavigationDelegate` blocks any `http://` URL |
| Domain whitelist | Only allow navigation to `*.jaze.in` and `*.justfiber.*` domains |
| Session isolation | Clear cookies/cache on WebView dismiss |
| Session timeout | 10-minute max session; auto-close with timeout message |
| Back-button guard | Confirmation dialog before dismissing mid-payment |

### 6.2 Backend Security

| Control | Implementation |
|---------|---------------|
| JWT validation | `requireCustomerAuth` for payment-link; `requireAuth`/`requireInstallerAuth` for cash |
| Input sanitization | Validate types, ranges, and enum values before Jaze call |
| No credential exposure | Jaze API keys stay server-side; never sent to client |
| Rate limiting | Apply existing Express rate limiter to payment endpoints |
| Audit trail | Cash collections include collector name in notes |

### 6.3 Admin UI Security

| Control | Implementation |
|---------|---------------|
| Role-based access | Only admin/installer roles can access cash collection |
| Confirmation step | Mandatory dialog before submitting payment |
| Amount cap | Cannot exceed customer's outstanding balance |

---

## 7. Error Handling Strategy

### 7.1 Backend Error Mapping

| Scenario | HTTP Status | Client Message |
|----------|-------------|----------------|
| Jaze API timeout (>10s) | 502 | "Payment service temporarily unavailable" |
| Jaze API returns error | 502 | "Payment could not be processed: {jaze error}" |
| Missing/invalid `jazeUserId` | 400 | "Customer must be activated via an installer first" |
| Customer not found | 404 | "Customer not found or not activated" |
| Invalid amount | 400 | "Amount must be between 0.01 and 999,999.99" |
| Invalid method | 400 | "Method must be one of: cash, onlinePayment, manualCollection" |
| Auth failure | 401 | "Authentication required" / "Invalid token" |

### 7.2 Flutter App Error Handling

| Scenario | Behavior |
|----------|----------|
| Payment link request fails | Show SnackBar with error, stay on billing screen |
| WebView fails to load (15s) | Show error overlay with "Retry" button |
| WebView HTTP error | Show error message, offer retry |
| Network loss during WebView | Detect via `onWebResourceError`, show offline message |
| Payment status refresh fails | Show "Payment submitted, billing temporarily unavailable" + manual refresh |
| Stale billing data after refresh | Show note "Processing may take up to 2 minutes" + refresh button |

### 7.3 Retry Strategy (Flutter)

```dart
Future<T> withRetry<T>(Future<T> Function() fn, {int maxAttempts = 3}) async {
  for (int attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt == maxAttempts) rethrow;
      await Future.delayed(Duration(seconds: pow(2, attempt).toInt())); // 2s, 4s, 8s
    }
  }
  throw Exception('Unreachable');
}
```

Apply to:
- Payment link generation (retry up to 2 times)
- Billing summary refresh after payment (retry up to 3 times)

### 7.4 Admin UI Error Handling

| Scenario | Behavior |
|----------|----------|
| API returns 400/404 | Show inline error below form, preserve field values |
| API returns 502 | Show "Jaze service unavailable, try again" |
| Network failure | Show "Network error. Please try again." |
| Success | Show success toast with transaction ID, clear form |

---

## 8. File Structure (New/Modified)

```
src/
├── modules/
│   ├── adminOps/
│   │   └── paymentRoutes.js          ← NEW: cash collection endpoint
│   └── customerPortal/
│       └── routes.js                  ← MODIFIED: add payment-link endpoint
│
frontend/
├── flutter_customer_app/lib/src/
│   ├── screens/
│   │   └── payment_webview_screen.dart  ← NEW: WebView payment screen
│   ├── screens/
│   │   └── billing_history_screen.dart  ← MODIFIED: wire up WebView flow
│   └── core/
│       └── api_client.dart              ← MODIFIED: add requestPaymentLink()
│
├── admin-basic/app/(dashboard)/customers/[customerId]/
│   └── page.tsx                         ← MODIFIED: add CashCollectionSection
```

---

## 9. Dependencies

| Component | Package | Version | Purpose |
|-----------|---------|---------|---------|
| Flutter | `webview_flutter` | ^4.x | In-app WebView for payment page |
| Backend | (existing) | — | No new backend dependencies |
| Admin UI | (existing) | — | No new admin dependencies |

---

## 10. Configuration

Add to environment/config:

```env
# Payment WebView domain whitelist (comma-separated)
JAZE_PAYMENT_DOMAINS=jaze.in,payments.jaze.in

# Payment link request timeout (ms)
JAZE_PAYMENT_LINK_TIMEOUT=10000
```

Flutter app config (can be in remote config or constants):

```dart
const kJazePaymentDomain = 'jaze.in';
const kPaymentSuccessPatterns = ['/payment/success', 'payment_success=true'];
const kPaymentFailurePatterns = ['/payment/failure', 'payment_failed=true'];
const kPaymentSessionTimeoutMinutes = 10;
const kPaymentPageLoadTimeoutSeconds = 15;
```
