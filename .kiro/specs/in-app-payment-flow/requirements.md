# Requirements Document

## Introduction

In-app payment flow for the JustFiber customer app that eliminates external redirects to the Jaze portal. Customers pay via UPI through an in-app WebView (using Jaze payment links), and installers/admins record cash collections through the Jaze `makePayment` API. Jaze remains the single source of truth for all billing and payment data — JustFiber acts as a thin UI layer facilitating payments without owning payment processing.

## Glossary

- **Customer_App**: The Flutter mobile application used by JustFiber customers to view billing, make payments, and manage their account.
- **Admin_UI**: The Next.js 14 admin dashboard used by JustFiber staff and installers.
- **Payment_Backend**: The Node.js + Express backend module that proxies payment requests between JustFiber apps and the Jaze API.
- **Jaze_API**: The external billing platform API that is the single source of truth for payments, invoices, and billing state.
- **Payment_WebView**: An in-app WebView component within the Customer_App that renders the Jaze payment page without leaving the app.
- **Cash_Collection**: A payment recorded by an installer or admin when a customer pays in cash, registered via the Jaze makePayment API.
- **Payment_Link**: A URL returned by the Jaze `getPaymentLink` API that opens a UPI-enabled payment page.
- **Installer**: A JustFiber field staff member who can collect cash payments from customers and record them in the system.

## Requirements

### Requirement 1: UPI Payment via In-App WebView

**User Story:** As a customer, I want to pay my bill via UPI without leaving the JustFiber app, so that I have a seamless payment experience.

#### Acceptance Criteria

1. WHEN a customer initiates a UPI payment, THE Payment_Backend SHALL request a Payment_Link from the Jaze_API using the customer's jazeUserId.
2. WHEN the Jaze_API returns a Payment_Link that is a non-empty HTTPS URL, THE Customer_App SHALL open the Payment_WebView displaying the Jaze payment page.
3. WHILE the Payment_WebView is open, THE Customer_App SHALL remain in the foreground without redirecting to an external browser or the Jaze portal.
4. WHEN the Payment_WebView navigates to a URL indicating payment success or the Jaze payment page dispatches a completion callback, THE Customer_App SHALL close the Payment_WebView and proceed to refresh the billing summary.
5. WHEN the Payment_WebView is closed after a payment attempt, THE Customer_App SHALL refresh the billing summary from the Jaze_API within 5 seconds to reflect the updated payment status.
6. IF the Jaze_API fails to return a Payment_Link or returns an empty or non-HTTPS URL, THEN THE Payment_Backend SHALL return an error response with HTTP status 502 and a message indicating the payment link could not be generated.
7. IF the Payment_WebView does not finish loading the payment page within 15 seconds or receives an HTTP error response, THEN THE Customer_App SHALL display an error message indicating the page could not be loaded and offer a retry option.
8. IF the customer dismisses the Payment_WebView without completing payment, THEN THE Customer_App SHALL return the customer to the billing screen without refreshing the billing summary.

### Requirement 2: Cash Collection Recording

**User Story:** As an installer, I want to record a cash payment collected from a customer, so that the payment is registered in Jaze and the customer's billing is updated.

#### Acceptance Criteria

1. WHEN an installer submits a cash collection, THE Payment_Backend SHALL call the Jaze_API makePayment endpoint with the customer's jazeUserId, amount, method set to "cash", and notes describing the collection.
2. WHEN the Jaze_API confirms the cash payment, THE Payment_Backend SHALL return a success response containing the payment transaction ID, the recorded amount, the payment method, and a timestamp.
3. THE Admin_UI SHALL provide a cash collection form that requires the installer to enter the customer identifier (customerId as displayed in the system) and the amount collected as a positive number between 1 and 999,999 inclusive with up to two decimal places.
4. WHEN a cash collection is submitted, THE Admin_UI SHALL display a confirmation dialog showing the customer name, amount, and payment method before sending the request.
5. IF the Jaze_API rejects the cash payment request, THEN THE Payment_Backend SHALL return the error details to the calling application with the HTTP status code received from the Jaze_API or HTTP 502 if the Jaze_API is unreachable.
6. IF the amount is zero or negative, THEN THE Payment_Backend SHALL reject the request with HTTP status 400 and a validation error message indicating that a positive amount is required.
7. IF the submitted customer identifier does not correspond to a customer with a linked jazeUserId, THEN THE Payment_Backend SHALL reject the request with HTTP status 404 and an error message indicating the customer was not found or is not activated.

### Requirement 3: Payment Status Synchronization

**User Story:** As a customer, I want my billing screen to reflect payments immediately after they are made, so that I can confirm my payment was successful.

#### Acceptance Criteria

1. WHEN a payment is completed (UPI or cash) and the Customer_App returns to the billing screen, THE Customer_App SHALL call the Jaze billing summary endpoint within 5 seconds of payment confirmation and display a loading indicator until the response is received or a 10-second timeout elapses.
2. WHEN the billing summary response is received successfully, THE Customer_App SHALL update the outstanding amount, last payment date, and payment status fields on the billing screen with the values returned from the Jaze_API.
3. IF the Jaze billing summary response still shows the pre-payment outstanding amount (stale data), THEN THE Customer_App SHALL display the refreshed data as returned and show a note indicating that payment processing may take up to 2 minutes to reflect, along with a manual refresh button.
4. IF the billing refresh fails due to a network error or the 10-second timeout elapses without a response, THEN THE Customer_App SHALL display a message indicating the payment was submitted but billing status is temporarily unavailable, retain the previously displayed billing data, and offer a manual refresh button.
5. WHEN the customer taps the manual refresh button, THE Customer_App SHALL re-fetch the billing summary from the Jaze_API with the same 10-second timeout and update the screen upon success or re-display the failure message upon failure.

### Requirement 4: Payment Backend API Endpoints

**User Story:** As a developer, I want well-defined backend endpoints for payment operations, so that both the Customer_App and Admin_UI can initiate payments through a consistent interface.

#### Acceptance Criteria

1. THE Payment_Backend SHALL expose a POST endpoint for generating a Jaze payment link, accessible only to requests bearing a valid customer JWT token.
2. THE Payment_Backend SHALL expose a POST endpoint for recording cash payments, accessible only to requests bearing a valid JWT token with role "installer" or "admin".
3. WHEN a payment link request is received from an authenticated customer with a linked jazeUserId, THE Payment_Backend SHALL call the Jaze_API and return the generated payment link URL in the response body within 10 seconds.
4. IF a customer does not have a linked jazeUserId, THEN THE Payment_Backend SHALL return HTTP status 400 with a message indicating the customer must be activated via an installer first.
5. IF the Jaze_API does not return a payment link or the call fails, THEN THE Payment_Backend SHALL return HTTP status 502 with a message indicating the payment link could not be generated.
6. WHEN a cash payment request is received, THE Payment_Backend SHALL validate that the request includes a customerId matching an existing customer record, a numeric amount between 0.01 and 999999.99, and a payment method value from the set ["cash", "onlinePayment", "manualCollection"].
7. IF a cash payment request fails validation, THEN THE Payment_Backend SHALL return HTTP status 400 with a message indicating which field is missing or invalid, without creating any payment record.

### Requirement 5: Admin Cash Collection Interface

**User Story:** As an admin, I want to record cash payments on behalf of customers from the admin dashboard, so that I can update billing records when customers pay at the office.

#### Acceptance Criteria

1. THE Admin_UI SHALL provide a cash collection section within the customer detail view's Billing tab, accessible via a "Collect Cash" button.
2. WHEN an admin opens the cash collection section, THE Admin_UI SHALL display the customer's name, current outstanding amount (from the billing snapshot), and jazeUserId.
3. IF the entered amount is not a positive number between 1 and the customer's current outstanding amount (inclusive), THEN THE Admin_UI SHALL keep the submit button disabled.
4. WHEN a cash collection is successfully recorded, THE Admin_UI SHALL display a success notification showing the transaction ID, collected amount, and settlement mode returned by the Payment_Backend.
5. IF the cash collection request fails, THEN THE Admin_UI SHALL display the error message returned by the Payment_Backend without navigating away from the form and SHALL preserve all entered field values.
6. THE Admin_UI SHALL provide a notes field (maximum 500 characters) in the cash collection form allowing the admin to add context about the payment (e.g., receipt number, collector name).
7. WHEN an admin submits the cash collection form, THE Admin_UI SHALL send the customer ID, amount, method as "cash", and notes to the Payment_Backend collect endpoint.

### Requirement 6: Payment WebView Security and UX

**User Story:** As a customer, I want the in-app payment experience to be secure and reliable, so that I can trust making payments within the app.

#### Acceptance Criteria

1. IF the Payment_WebView encounters a URL that does not use HTTPS, THEN THE Customer_App SHALL block the navigation and display an error message indicating that the connection is not secure.
2. WHILE the Payment_WebView is loading, THE Customer_App SHALL display a loading indicator (spinner or progress bar) until the page content is fully rendered or a load failure occurs.
3. IF the Payment_WebView attempts to navigate to a URL outside the configured Jaze payment domain, THEN THE Customer_App SHALL block the navigation and remain on the current payment page without displaying an error to the customer.
4. WHEN the customer presses the back button while the Payment_WebView is open, THE Customer_App SHALL show a confirmation dialog asking whether to cancel the payment.
5. WHEN the customer confirms cancellation in the back-button dialog, THE Customer_App SHALL close the Payment_WebView, clear session data, and navigate the customer back to the screen from which the payment was initiated.
6. IF the Payment_WebView session exceeds 10 minutes without completion, THEN THE Customer_App SHALL display a timeout message and offer to restart the payment flow.
7. WHEN the payment flow completes or is cancelled, THE Payment_WebView SHALL clear all cookies and session data before the WebView is dismissed.
8. IF the payment page fails to load due to a network error or server error within 30 seconds, THEN THE Customer_App SHALL dismiss the loading indicator, display an error message indicating the payment page could not be loaded, and offer a retry option.

### Requirement 7: Payment History Visibility

**User Story:** As a customer, I want to see both UPI and cash payments in my payment history, so that I have a complete record of all payments made.

#### Acceptance Criteria

1. WHEN a customer views payment history, THE Customer_App SHALL fetch payment records from the Jaze_API that include both UPI and cash payment entries, displaying a maximum of 50 entries per request sorted by date descending (newest first).
2. THE Customer_App SHALL display the payment method (UPI or Cash) for each payment entry in the history list, derived from the payment transaction's method field.
3. WHEN a cash payment is recorded by an installer, THE payment entry in Jaze SHALL include the notes provided during collection so the customer can see the context, with notes truncated to 200 characters if longer.
4. IF the Jaze_API is unreachable or returns an error when fetching payment history, THEN THE Customer_App SHALL display an error message indicating that payment history could not be loaded and retain any previously cached entries on screen.
5. IF a payment entry has no method value or an unrecognized method value, THEN THE Customer_App SHALL display "Online" as the default payment method label.
