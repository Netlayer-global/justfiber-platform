# Implementation Plan: In-App Payment Flow

## Overview

Implement an in-app payment flow for the JustFiber platform that enables UPI payments via an in-app WebView (Flutter customer app) and cash collection recording (admin/installer via Next.js admin UI). The Node.js backend proxies all payment operations to the Jaze API, which remains the single source of truth. Implementation spans three codebases: Express backend, Flutter customer app, and Next.js admin dashboard.

## Tasks

- [x] 1. Backend: Payment Link Endpoint
  - [x] 1.1 Create the POST `/api/v1/customer/billing/jaze/payment-link` route
    - Add the route to `src/modules/customerPortal/routes.js`
    - Apply `requireCustomerAuth` middleware
    - Resolve the customer's `jazeUserId` from linked customer records
    - Return 400 if no linked customer or missing `jazeUserId`
    - Call `generatePaymentLink(jazeUserId)` from `jazeBillingAdapter.js`
    - Validate the returned link is non-empty and starts with `https://`
    - Return 502 if Jaze API fails or returns invalid link
    - Return 200 with `{ paymentLink, customerId }` on success
    - _Requirements: 1.1, 1.6, 4.1, 4.3, 4.4, 4.5_

  - [ ]* 1.2 Write unit tests for the payment link endpoint
    - Test successful payment link generation
    - Test 400 when customer has no linked `jazeUserId`
    - Test 502 when Jaze API returns empty or non-HTTPS link
    - Test 401 when JWT is missing or invalid
    - _Requirements: 1.1, 1.6, 4.1, 4.4, 4.5_

- [x] 2. Backend: Cash Collection Endpoint
  - [x] 2.1 Create `src/modules/adminOps/paymentRoutes.js` with the POST `/api/v1/admin/payments/collect-cash` route
    - Implement `requireAdminOrInstaller` combined auth middleware
    - Validate `customerId` (required, must exist with `jazeUserId`)
    - Validate `amount` (number, 0.01 ≤ amount ≤ 999999.99)
    - Validate `method` (one of: cash, onlinePayment, manualCollection)
    - Validate `notes` (optional, max 500 characters)
    - Return 400 for validation failures with specific field error messages
    - Return 404 if customer not found or not activated
    - Call `jazeClient.makePayment()` with userId, amount, method, notes
    - Return 502 if Jaze API is unreachable or rejects payment
    - Return 200 with transactionId, customerId, amount, method, notes, recordedAt
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 4.2, 4.6, 4.7_

  - [x] 2.2 Register the payment routes in the Express app
    - Import `paymentRouter` from `paymentRoutes.js`
    - Mount at `/api/v1/admin/payments` in the main app or admin router
    - _Requirements: 4.2_

  - [ ]* 2.3 Write unit tests for the cash collection endpoint
    - Test successful cash payment recording
    - Test 400 for missing customerId, invalid amount, invalid method, notes too long
    - Test 404 for non-existent customer and customer without jazeUserId
    - Test 502 when Jaze API call fails
    - Test 401 for missing/invalid JWT
    - Test combined auth accepts both admin and installer tokens
    - _Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 4.2, 4.6, 4.7_

- [x] 3. Checkpoint - Backend endpoints verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Flutter: Payment WebView Screen
  - [x] 4.1 Add `webview_flutter` dependency to `pubspec.yaml`
    - Add `webview_flutter: ^4.x` to dependencies
    - Run `flutter pub get`
    - _Requirements: 6.1, 6.2_

  - [x] 4.2 Create `lib/src/screens/payment_webview_screen.dart`
    - Implement `PaymentWebViewScreen` StatefulWidget accepting `paymentUrl` and `jazeDomain`
    - Implement `PaymentFlowState` enum (idle, loading, webviewOpen, success, failure)
    - Show loading indicator while page loads
    - Implement `NavigationDelegate` to block non-HTTPS URLs (Req 6.1)
    - Implement domain whitelist to block navigation outside Jaze payment domain (Req 6.3)
    - Detect payment success/failure via URL pattern matching (Req 1.4)
    - Implement 10-minute session timeout with timeout message and restart option (Req 6.6)
    - Implement 15-second page load timeout with error and retry option (Req 1.7)
    - Implement back-button confirmation dialog for payment cancellation (Req 6.4, 6.5)
    - Clear cookies and session data on WebView dismiss (Req 6.7)
    - Pop with `true` on success, `false` on failure, `null` on cancellation
    - _Requirements: 1.2, 1.3, 1.4, 1.7, 1.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 4.3 Write widget tests for PaymentWebViewScreen
    - Test loading indicator is shown initially
    - Test back-button shows confirmation dialog
    - Test non-HTTPS URL is blocked
    - Test session timeout triggers after 10 minutes
    - _Requirements: 6.1, 6.2, 6.4, 6.6_

- [x] 5. Flutter: Payment Link API Integration
  - [x] 5.1 Add `requestPaymentLink()` method to the API client
    - Add method in `lib/src/core/api_client.dart`
    - POST to `/api/v1/customer/billing/jaze/payment-link` with customer JWT
    - Return the payment link URL string on success
    - Handle and propagate errors (400, 401, 502)
    - _Requirements: 1.1, 4.1, 4.3_

  - [x] 5.2 Modify `billing_history_screen.dart` to use WebView payment flow
    - Replace existing `_payNow` method logic that shows SnackBar with URL
    - Request payment link from backend via `requestPaymentLink()`
    - Navigate to `PaymentWebViewScreen` with the payment link
    - On success result: call `appState.loadJazeBilling()` to refresh billing
    - On failure/cancellation: return to billing screen without refresh (Req 1.8)
    - Show SnackBar error if payment link request fails
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.8, 3.1_

- [x] 6. Flutter: Payment Status Synchronization
  - [x] 6.1 Implement post-payment billing refresh logic
    - After successful payment, call billing summary endpoint within 5 seconds
    - Show loading indicator during refresh
    - Apply 10-second timeout on the refresh call
    - If response shows stale data (same outstanding amount), display note: "Payment processing may take up to 2 minutes" with manual refresh button
    - If refresh fails or times out, show "Payment submitted, billing temporarily unavailable" with retry button and retain previous billing data
    - Implement manual refresh button that re-fetches with same 10-second timeout
    - _Requirements: 1.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 6.2 Write unit tests for billing refresh logic
    - Test successful refresh updates billing fields
    - Test stale data shows processing note and refresh button
    - Test timeout shows unavailable message with retry
    - Test manual refresh re-fetches billing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7. Checkpoint - Flutter payment flow verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Flutter: Payment History
  - [x] 8.1 Update payment history display to show payment method
    - Fetch payment records from Jaze API (max 50 entries, sorted by date descending)
    - Display payment method label (UPI or Cash) for each entry
    - Display "Online" as default if method is missing or unrecognized
    - Show notes for cash payments (truncated to 200 characters)
    - Handle Jaze API errors: show error message, retain cached entries
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 8.2 Write unit tests for payment history display
    - Test method label displays correctly for UPI, Cash, and unknown methods
    - Test notes truncation at 200 characters
    - Test error state retains cached entries
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [x] 9. Admin UI: Cash Collection Interface
  - [x] 9.1 Create `collectCashPayment` API function in the admin API layer
    - Add function to `lib/api.ts` (or equivalent)
    - POST to `/api/v1/admin/payments/collect-cash` with Bearer token
    - Accept `customerId`, `amount`, `method`, `notes` parameters
    - Return parsed JSON response
    - _Requirements: 4.2, 5.7_

  - [x] 9.2 Create `CashCollectionSection` component in the customer detail Billing tab
    - Add "Collect Cash" button/section within the customer detail view's Billing tab
    - Display customer name, current outstanding amount, and jazeUserId
    - Implement amount input (number, min 1, max outstanding, step 0.01)
    - Implement notes input (text, max 500 characters, optional)
    - Disable submit button if amount is invalid or customer has no jazeUserId
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 9.3 Implement confirmation dialog and submission flow
    - Show confirmation dialog before submission with customer name, amount, method
    - On confirm: call `collectCashPayment` API
    - On success: show success notification with transaction ID, amount, settlement mode; clear form
    - On failure: show error message inline, preserve entered field values
    - Send customerId, amount, method as "cash", and notes to the backend
    - _Requirements: 2.4, 5.4, 5.5, 5.7_

  - [ ]* 9.4 Write unit/integration tests for CashCollectionSection
    - Test form validation (amount range, notes length)
    - Test confirmation dialog displays correct info
    - Test success notification and form reset
    - Test error display preserves field values
    - Test submit button disabled when amount invalid or jazeUserId missing
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 10. Configuration and Environment Setup
  - [x] 10.1 Add payment-related environment variables
    - Add `JAZE_PAYMENT_DOMAINS` and `JAZE_PAYMENT_LINK_TIMEOUT` to `.env.example`
    - Add Flutter app constants for payment domain, success/failure URL patterns, session timeout, and page load timeout
    - _Requirements: 6.1, 6.3, 6.6_

- [x] 11. Final Checkpoint - Full integration verified
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design does not include a Correctness Properties section, so no property-based tests are included
- Unit tests and integration tests are complementary and cover edge cases
- Jaze API is the single source of truth — no local payment state is stored
- The backend uses existing `jazeClient.js` and `jazeBillingAdapter.js` — no new external dependencies needed
- Flutter uses `webview_flutter` ^4.x as the only new dependency
- Admin UI uses existing component library and API patterns

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1", "10.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "4.2"] },
    { "id": 3, "tasks": ["4.3", "5.1", "9.1"] },
    { "id": 4, "tasks": ["5.2", "9.2"] },
    { "id": 5, "tasks": ["6.1", "9.3"] },
    { "id": 6, "tasks": ["6.2", "8.1", "9.4"] },
    { "id": 7, "tasks": ["8.2"] }
  ]
}
```
