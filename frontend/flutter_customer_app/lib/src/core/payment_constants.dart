/// Payment-related constants for the JustFiber customer app.
///
/// These configure the in-app WebView payment flow including domain
/// whitelisting, success/failure URL detection, and timeout values.
library;

/// The primary Jaze payment domain used for WebView domain whitelisting.
const String kJazePaymentDomain = 'jaze.in';

/// URL patterns that indicate a successful payment completion.
/// The WebView navigation delegate checks URLs against these patterns
/// to detect when a payment has succeeded.
const List<String> kPaymentSuccessPatterns = [
  '/payment/success',
  'payment_success=true',
];

/// URL patterns that indicate a failed payment.
/// The WebView navigation delegate checks URLs against these patterns
/// to detect when a payment has failed.
const List<String> kPaymentFailurePatterns = [
  '/payment/failure',
  'payment_failed=true',
];

/// Maximum duration (in minutes) for a payment WebView session.
/// If the session exceeds this duration without completion, the app
/// displays a timeout message and offers to restart the payment flow.
const int kPaymentSessionTimeoutMinutes = 10;

/// Maximum duration (in seconds) to wait for the payment page to load.
/// If the page does not finish loading within this time, the app
/// displays an error message and offers a retry option.
const int kPaymentPageLoadTimeoutSeconds = 15;
