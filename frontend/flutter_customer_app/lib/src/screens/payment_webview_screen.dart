import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../core/payment_constants.dart';
import '../core/theme.dart';

/// Represents the current state of the payment WebView flow.
enum PaymentFlowState { idle, loading, webviewOpen, success, failure }

/// A screen that displays the payment page in an in-app WebView.
///
/// Accepts a [paymentUrl] (the payment link) and [paymentDomain] (the
/// allowed payment domain for navigation whitelisting).
///
/// Pops with:
/// - `true` on payment success
/// - `false` on payment failure
/// - `null` on user cancellation
class PaymentWebViewScreen extends StatefulWidget {
  const PaymentWebViewScreen({
    super.key,
    required this.paymentUrl,
    required this.paymentDomain,
  });

  /// The payment URL to load in the WebView.
  final String paymentUrl;

  /// The allowed payment domain.
  /// Navigation outside this domain (and justfiber domains) is blocked.
  final String paymentDomain;

  @override
  State<PaymentWebViewScreen> createState() => _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends State<PaymentWebViewScreen> {
  late final WebViewController _controller;
  PaymentFlowState _state = PaymentFlowState.loading;
  Timer? _sessionTimer;
  Timer? _pageLoadTimer;
  bool _isTimedOut = false;
  bool _isPageLoadTimedOut = false;

  @override
  void initState() {
    super.initState();
    _initWebView();
    _startSessionTimeout();
    _startPageLoadTimeout();
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    _pageLoadTimer?.cancel();
    super.dispose();
  }

  void _initWebView() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(NavigationDelegate(
        onNavigationRequest: _onNavigationRequest,
        onPageFinished: _onPageFinished,
        onWebResourceError: _onWebResourceError,
      ))
      ..loadRequest(Uri.parse(widget.paymentUrl));
  }

  /// Starts the 10-minute session timeout (Req 6.6).
  void _startSessionTimeout() {
    _sessionTimer = Timer(
      const Duration(minutes: kPaymentSessionTimeoutMinutes),
      _handleSessionTimeout,
    );
  }

  /// Starts the 15-second page load timeout (Req 1.7).
  void _startPageLoadTimeout() {
    _pageLoadTimer = Timer(
      const Duration(seconds: kPaymentPageLoadTimeoutSeconds),
      _handlePageLoadTimeout,
    );
  }

  /// Handles the 10-minute session timeout.
  void _handleSessionTimeout() {
    if (!mounted) return;
    if (_state == PaymentFlowState.loading ||
        _state == PaymentFlowState.webviewOpen) {
      setState(() {
        _isTimedOut = true;
        _state = PaymentFlowState.failure;
      });
    }
  }

  /// Handles the 15-second page load timeout.
  void _handlePageLoadTimeout() {
    if (!mounted) return;
    if (_state == PaymentFlowState.loading) {
      setState(() {
        _isPageLoadTimedOut = true;
        _state = PaymentFlowState.failure;
      });
    }
  }

  /// Called when a page finishes loading in the WebView.
  void _onPageFinished(String url) {
    if (!mounted) return;
    _pageLoadTimer?.cancel();
    if (_state == PaymentFlowState.loading) {
      setState(() => _state = PaymentFlowState.webviewOpen);
    }
  }

  /// Called when a web resource error occurs.
  void _onWebResourceError(WebResourceError error) {
    if (!mounted) return;
    // Only treat main frame errors as failures
    if (error.isForMainFrame ?? true) {
      _pageLoadTimer?.cancel();
      setState(() => _state = PaymentFlowState.failure);
    }
  }

  /// Navigation delegate that enforces HTTPS-only (Req 6.1),
  /// domain whitelisting (Req 6.3), and detects payment
  /// success/failure via URL pattern matching (Req 1.4).
  NavigationDecision _onNavigationRequest(NavigationRequest request) {
    final uri = Uri.tryParse(request.url);
    if (uri == null) {
      return NavigationDecision.prevent;
    }

    // Block non-HTTPS URLs (Req 6.1)
    if (uri.scheme != 'https') {
      setState(() => _state = PaymentFlowState.failure);
      return NavigationDecision.prevent;
    }

    // Domain whitelist check (Req 6.3)
    // Allow navigation to JustFiber-owned payment pages and payment gateways.
    final host = uri.host.toLowerCase();
    if (!host.contains(widget.paymentDomain.toLowerCase()) &&
        !host.contains('justfiber') &&
        !host.contains('razorpay') &&
        !host.contains('paytm') &&
        !host.contains('phonepe') &&
        !host.contains('upi')) {
      // Silently block navigation outside allowed domains
      return NavigationDecision.prevent;
    }

    // Detect payment success via URL pattern matching (Req 1.4)
    final urlString = request.url;
    for (final pattern in kPaymentSuccessPatterns) {
      if (urlString.contains(pattern)) {
        setState(() => _state = PaymentFlowState.success);
        _closeWithResult(true);
        return NavigationDecision.prevent;
      }
    }

    // Detect payment failure via URL pattern matching (Req 1.4)
    for (final pattern in kPaymentFailurePatterns) {
      if (urlString.contains(pattern)) {
        setState(() => _state = PaymentFlowState.failure);
        _closeWithResult(false);
        return NavigationDecision.prevent;
      }
    }

    return NavigationDecision.navigate;
  }

  /// Closes the WebView, clears cookies/session data (Req 6.7),
  /// and pops with the given result.
  Future<void> _closeWithResult(bool? success) async {
    _sessionTimer?.cancel();
    _pageLoadTimer?.cancel();
    // Clear cookies and session data (Req 6.7)
    await WebViewCookieManager().clearCookies();
    await _controller.clearCache();
    await _controller.clearLocalStorage();
    if (!mounted) return;
    Navigator.of(context).pop(success);
  }

  /// Retries loading the payment page (used after page load timeout or error).
  void _retryLoad() {
    setState(() {
      _state = PaymentFlowState.loading;
      _isPageLoadTimedOut = false;
      _isTimedOut = false;
    });
    _startPageLoadTimeout();
    _controller.loadRequest(Uri.parse(widget.paymentUrl));
  }

  /// Restarts the entire payment flow (used after session timeout).
  void _restartPaymentFlow() {
    _sessionTimer?.cancel();
    setState(() {
      _state = PaymentFlowState.loading;
      _isTimedOut = false;
      _isPageLoadTimedOut = false;
    });
    _startSessionTimeout();
    _startPageLoadTimeout();
    _controller.loadRequest(Uri.parse(widget.paymentUrl));
  }

  /// Shows a confirmation dialog when the user presses back (Req 6.4, 6.5).
  Future<bool> _onWillPop() async {
    // If payment is already complete, allow pop without dialog
    if (_state == PaymentFlowState.success ||
        _state == PaymentFlowState.failure) {
      return true;
    }

    final shouldCancel = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: kSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: kBorder),
        ),
        title: Text(
          'Cancel Payment?',
          style: GoogleFonts.inter(
            fontWeight: FontWeight.w700,
            fontSize: 18,
            color: kText,
          ),
        ),
        content: Text(
          'Are you sure you want to cancel this payment? '
          'Your payment will not be processed.',
          style: GoogleFonts.inter(
            color: kMuted,
            fontSize: 14,
            height: 1.5,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(
              'Continue Payment',
              style: GoogleFonts.inter(
                color: kPrimaryLight,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(
              'Yes, Cancel',
              style: GoogleFonts.inter(
                color: const Color(0xFFEF4444),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );

    if (shouldCancel == true) {
      await _closeWithResult(null);
      return false; // We handle the pop ourselves
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    // ignore: deprecated_member_use
    return WillPopScope(
      onWillPop: _onWillPop,
      child: Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          backgroundColor: kSurface,
          leading: IconButton(
            icon: const Icon(Icons.close_rounded, color: kText),
            onPressed: () => _onWillPop(),
          ),
          title: Text(
            'Payment',
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w700,
              fontSize: 17,
              color: kText,
            ),
          ),
          centerTitle: true,
        ),
        body: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    // Show timeout message with restart option (Req 6.6)
    if (_isTimedOut) {
      return _buildMessageOverlay(
        icon: Icons.timer_off_rounded,
        iconColor: const Color(0xFFFBBF24),
        title: 'Session Timed Out',
        message:
            'Your payment session has expired after $kPaymentSessionTimeoutMinutes minutes. '
            'Please restart the payment to try again.',
        actionLabel: 'Restart Payment',
        onAction: _restartPaymentFlow,
      );
    }

    // Show page load timeout with retry option (Req 1.7)
    if (_isPageLoadTimedOut) {
      return _buildMessageOverlay(
        icon: Icons.wifi_off_rounded,
        iconColor: const Color(0xFFEF4444),
        title: 'Page Load Failed',
        message:
            'The payment page could not be loaded within $kPaymentPageLoadTimeoutSeconds seconds. '
            'Please check your internet connection and try again.',
        actionLabel: 'Retry',
        onAction: _retryLoad,
      );
    }

    // Show error state for web resource errors
    if (_state == PaymentFlowState.failure && !_isTimedOut && !_isPageLoadTimedOut) {
      return _buildMessageOverlay(
        icon: Icons.error_outline_rounded,
        iconColor: const Color(0xFFEF4444),
        title: 'Payment Error',
        message:
            'Something went wrong while loading the payment page. '
            'Please try again.',
        actionLabel: 'Retry',
        onAction: _retryLoad,
      );
    }

    // Show WebView with loading indicator overlay
    return Stack(
      children: [
        WebViewWidget(controller: _controller),
        if (_state == PaymentFlowState.loading) _buildLoadingOverlay(),
      ],
    );
  }

  /// Loading indicator overlay shown while the page loads (Req 6.2).
  Widget _buildLoadingOverlay() {
    return Container(
      color: kBg,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(
              color: kPrimary,
              strokeWidth: 2.5,
            ),
            const SizedBox(height: 20),
            Text(
              'Loading payment page...',
              style: GoogleFonts.inter(
                color: kMuted,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Builds a full-screen message overlay with an icon, title, message,
  /// and action button.
  Widget _buildMessageOverlay({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String message,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Container(
      color: kBg,
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Icon(icon, color: iconColor, size: 32),
            ),
            const SizedBox(height: 24),
            Text(
              title,
              style: GoogleFonts.inter(
                fontWeight: FontWeight.w700,
                fontSize: 20,
                color: kText,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              style: GoogleFonts.inter(
                color: kMuted,
                fontSize: 14,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: onAction,
                child: Text(actionLabel),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => _closeWithResult(null),
                child: const Text('Cancel'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
