import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'service_tracking_screen.dart';
import 'support_history_screen.dart';

enum _Phase { checkout, launching, verifying, success, failure }

class BookingPaymentScreen extends StatefulWidget {
  const BookingPaymentScreen({
    super.key,
    required this.bookingNumber,
    required this.paymentOrder,
    this.planName,
    this.durationLabel,
    this.customerAddress,
  });

  final String bookingNumber;
  final BillingPaymentOrder paymentOrder;
  final String? planName;
  final String? durationLabel;
  final String? customerAddress;

  @override
  State<BookingPaymentScreen> createState() => _BookingPaymentScreenState();
}

class _BookingPaymentScreenState extends State<BookingPaymentScreen> {
  late final Razorpay _razorpay;
  _Phase _phase = _Phase.checkout;
  String? _paymentError;
  String? _walletHint;
  bool _helping = false;
  int _retryCount = 0;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  void _openCheckout() {
    if (_phase == _Phase.launching || _phase == _Phase.verifying) return;
    setState(() {
      _phase = _Phase.launching;
      _paymentError = null;
      _walletHint = null;
    });
    try {
      _razorpay.open({
        'key': widget.paymentOrder.keyId,
        'amount': widget.paymentOrder.amountPaise,
        'currency': widget.paymentOrder.currency,
        'name': 'JustFiber',
        'description': widget.planName?.isNotEmpty == true
            ? widget.planName!
            : 'Booking payment',
        'order_id': widget.paymentOrder.orderId,
        'prefill': {
          'contact': widget.paymentOrder.customerPhone,
          'email': widget.paymentOrder.customerEmail,
          'name': widget.paymentOrder.customerName,
        },
        'theme': {'color': '#8224E3'},
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _phase = _Phase.failure;
        _paymentError = 'Unable to launch checkout. Please retry.';
      });
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final appState = AppStateScope.of(context);
    setState(() {
      _phase = _Phase.verifying;
      _paymentError = null;
    });
    final ok = await appState.verifyBookingPayment(
      bookingNumber: widget.bookingNumber,
      orderId: response.orderId ?? widget.paymentOrder.orderId,
      paymentId: response.paymentId ?? '',
      signature: response.signature ?? '',
      amount: widget.paymentOrder.amount,
    );
    if (!mounted) return;
    if (ok) {
      await appState.refresh(silent: true);
      if (!mounted) return;
      setState(() => _phase = _Phase.success);
    } else {
      setState(() {
        _phase = _Phase.failure;
        _paymentError = appState.bookingError ?? 'Payment verification failed.';
      });
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() {
      _phase = _Phase.failure;
      _paymentError = response.message ?? 'Payment failed';
      _retryCount += 1;
    });
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    setState(() {
      _phase = _Phase.checkout;
      _walletHint =
          'Continue payment in ${response.walletName ?? 'wallet'} and return here after completion.';
    });
  }

  Future<void> _requestPaymentHelp() async {
    if (_helping) return;
    final appState = AppStateScope.of(context);
    setState(() => _helping = true);
    final ticketNumber = await appState.raiseComplaint(
      category: 'booking',
      subject: 'Booking payment failed',
      description:
          'Payment failed while trying to pay Rs ${widget.paymentOrder.amount.toStringAsFixed(0)} for booking ${widget.bookingNumber}. Please assist.',
    );
    if (!mounted) return;
    setState(() => _helping = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ticketNumber == null
          ? (appState.error ?? 'Unable to create support request')
          : 'Support ticket created: $ticketNumber'),
    ));
  }

  Future<void> _copyOrderReference() async {
    await Clipboard.setData(ClipboardData(text: widget.paymentOrder.orderId));
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Order reference copied')));
  }

  @override
  Widget build(BuildContext context) {
    return switch (_phase) {
      _Phase.checkout => _CheckoutPage(
          bookingNumber: widget.bookingNumber,
          order: widget.paymentOrder,
          planName: widget.planName ?? '',
          durationLabel: widget.durationLabel ?? '',
          customerAddress: widget.customerAddress ?? '',
          walletHint: _walletHint,
          retryCount: _retryCount,
          onPay: _openCheckout,
        ),
      _Phase.launching => const _LoadingPage(
          message: 'Launching secure checkout…',
          sub: 'Keep this screen open while Razorpay loads.',
          color: kPrimary,
        ),
      _Phase.verifying => const _LoadingPage(
          message: 'Verifying payment…',
          sub: 'Hold on while your booking is being confirmed.',
          color: Color(0xFF16A34A),
        ),
      _Phase.success => _SuccessPage(
          bookingNumber: widget.bookingNumber,
          planName: widget.planName ?? '',
          amount: widget.paymentOrder.amount,
          onViewTracking: () async {
            await Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                  builder: (_) => const ServiceTrackingScreen()),
            );
          },
          onDone: () => Navigator.of(context).pop(true),
        ),
      _Phase.failure => _FailurePage(
          bookingNumber: widget.bookingNumber,
          order: widget.paymentOrder,
          error: _paymentError ?? 'Something went wrong.',
          helping: _helping,
          retryCount: _retryCount,
          onRetry: _openCheckout,
          onCopyRef: _copyOrderReference,
          onHelp: _requestPaymentHelp,
          onSupportCenter: () => Navigator.of(context).push(
              MaterialPageRoute(
                  builder: (_) => const SupportHistoryScreen())),
        ),
    };
  }
}

// ─── Checkout Page ─────────────────────────────────────────────────────────────

class _CheckoutPage extends StatelessWidget {
  const _CheckoutPage({
    required this.bookingNumber,
    required this.order,
    required this.planName,
    required this.durationLabel,
    required this.customerAddress,
    required this.walletHint,
    required this.retryCount,
    required this.onPay,
  });

  final String bookingNumber, planName, durationLabel, customerAddress;
  final BillingPaymentOrder order;
  final String? walletHint;
  final int retryCount;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: CustomScrollView(
        slivers: [
          // ── Header ──────────────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF0C2A3F), Color(0xFF0369A1)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 8, 16, 28),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: const Icon(Icons.arrow_back_ios_new_rounded,
                            color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 12),
                            Text(
                              retryCount > 0
                                  ? 'Retry Payment'
                                  : 'Confirm & Pay',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Booking #$bookingNumber',
                              style: GoogleFonts.inter(
                                  color: Colors.white60, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${order.amount.toStringAsFixed(0)}',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.8,
                              ),
                            ),
                            Text(
                              'Amount due',
                              style: GoogleFonts.inter(
                                  color: Colors.white54, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 120),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Plan summary card ──────────────────────────────────────
                _SummaryCard(
                  planName: planName,
                  durationLabel: durationLabel,
                  customerName: order.customerName,
                  customerPhone: order.customerPhone,
                  address: customerAddress,
                  bookingNumber: bookingNumber,
                ),

                const SizedBox(height: 16),

                // ── Wallet hint ────────────────────────────────────────────
                if (walletHint != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: kPrimary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                      border:
                          Border.all(color: kPrimary.withValues(alpha: 0.2)),
                    ),
                    child: Text(walletHint!,
                        style: GoogleFonts.inter(
                            color: Colors.white, fontSize: 13, height: 1.4)),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Security note ──────────────────────────────────────────
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: kBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(Icons.lock_rounded,
                            color: Color(0xFF10B981), size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Secured by Razorpay · PCI-DSS compliant payment gateway',
                          style: GoogleFonts.inter(
                              color: kMuted, fontSize: 12, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),

      // ── Sticky Pay button ──────────────────────────────────────────────────
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
          child: SizedBox(
            width: double.infinity,
            height: 58,
            child: FilledButton(
              onPressed: onPay,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF0EA5E9),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18)),
              ),
              child: Text(
                retryCount > 0
                    ? 'Retry — Pay ₹${order.amount.toStringAsFixed(0)}'
                    : 'Pay ₹${order.amount.toStringAsFixed(0)}',
                style: GoogleFonts.inter(
                    fontSize: 17, fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Summary Card ──────────────────────────────────────────────────────────────

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.planName,
    required this.durationLabel,
    required this.customerName,
    required this.customerPhone,
    required this.address,
    required this.bookingNumber,
  });

  final String planName, durationLabel, customerName, customerPhone, address,
      bookingNumber;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x440EA5E9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Plan banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF0C2A3F), Color(0xFF0369A1)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(22),
                topRight: Radius.circular(22),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PLAN SELECTED',
                  style: GoogleFonts.inter(
                    color: const Color(0xFF7DD3FC),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  planName.isNotEmpty ? planName : 'Fiber Broadband',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
                if (durationLabel.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    durationLabel,
                    style: GoogleFonts.inter(
                        color: Colors.white60, fontSize: 13),
                  ),
                ],
              ],
            ),
          ),

          // Details
          Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              children: [
                _row('Booking', '#$bookingNumber'),
                if (customerName.isNotEmpty) _row('Customer', customerName),
                if (customerPhone.isNotEmpty)
                  _row('Mobile', customerPhone),
                if (address.isNotEmpty)
                  _row('Address', address, last: true)
                else
                  _row('Booking', '#$bookingNumber', last: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool last = false}) => Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          border: Border(
              bottom: last
                  ? BorderSide.none
                  : const BorderSide(color: kBorder)),
        ),
        child: Row(
          children: [
            Expanded(
                child: Text(label,
                    style: GoogleFonts.inter(color: kMuted, fontSize: 13))),
            Flexible(
              child: Text(value,
                  textAlign: TextAlign.right,
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      fontSize: 13)),
            ),
          ],
        ),
      );
}

// ─── Loading Page ──────────────────────────────────────────────────────────────

class _LoadingPage extends StatelessWidget {
  const _LoadingPage({
    required this.message,
    required this.sub,
    required this.color,
  });

  final String message, sub;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: color, strokeWidth: 3),
              const SizedBox(height: 24),
              Text(
                message,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w800),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                sub,
                style: GoogleFonts.inter(color: kMuted, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Success Page ──────────────────────────────────────────────────────────────

class _SuccessPage extends StatelessWidget {
  const _SuccessPage({
    required this.bookingNumber,
    required this.planName,
    required this.amount,
    required this.onViewTracking,
    required this.onDone,
  });

  final String bookingNumber, planName;
  final double amount;
  final VoidCallback onViewTracking;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Spacer(),

              // ── Success icon ─────────────────────────────────────────────
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF14532D), Color(0xFF16A34A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.35),
                      blurRadius: 32,
                      spreadRadius: 4,
                    ),
                  ],
                ),
                child: const Icon(Icons.check_rounded,
                    color: Colors.white, size: 46),
              ),

              const SizedBox(height: 28),

              Text(
                'Payment Confirmed!',
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 10),

              Text(
                '₹${amount.toStringAsFixed(0)} received for\n${planName.isNotEmpty ? planName : 'your booking'}',
                style: GoogleFonts.inter(
                    color: Colors.white70, fontSize: 15, height: 1.5),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 8),

              Text(
                'Booking #$bookingNumber',
                style: GoogleFonts.inter(color: kMuted, fontSize: 13),
              ),

              const SizedBox(height: 32),

              // ── Next steps ───────────────────────────────────────────────
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "What's next",
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15),
                    ),
                    const SizedBox(height: 14),
                    _step(
                      icon: Icons.check_circle_rounded,
                      color: const Color(0xFF22C55E),
                      text: 'Payment received & booking confirmed',
                    ),
                    const SizedBox(height: 10),
                    _step(
                      icon: Icons.engineering_rounded,
                      color: const Color(0xFF0EA5E9),
                      text: 'Our team will schedule your installation',
                    ),
                    const SizedBox(height: 10),
                    _step(
                      icon: Icons.notifications_rounded,
                      color: kPrimaryLight,
                      text: 'You\'ll be notified when installer is on the way',
                    ),
                  ],
                ),
              ),

              const Spacer(),

              // ── Actions ──────────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                height: 56,
                child: FilledButton.icon(
                  onPressed: onViewTracking,
                  icon: const Icon(Icons.location_on_rounded, size: 18),
                  label: Text(
                    'View Installation Tracking',
                    style: GoogleFonts.inter(
                        fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: kPrimary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),

              const SizedBox(height: 12),

              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton(
                  onPressed: onDone,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white70,
                    side: const BorderSide(color: kBorder),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: Text(
                    'Back to Home',
                    style: GoogleFonts.inter(
                        fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _step({
    required IconData icon,
    required Color color,
    required String text,
  }) =>
      Row(
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: GoogleFonts.inter(
                    color: Colors.white70, fontSize: 13, height: 1.4)),
          ),
        ],
      );
}

// ─── Failure Page ──────────────────────────────────────────────────────────────

class _FailurePage extends StatelessWidget {
  const _FailurePage({
    required this.bookingNumber,
    required this.order,
    required this.error,
    required this.helping,
    required this.retryCount,
    required this.onRetry,
    required this.onCopyRef,
    required this.onHelp,
    required this.onSupportCenter,
  });

  final String bookingNumber, error;
  final BillingPaymentOrder order;
  final bool helping;
  final int retryCount;
  final VoidCallback onRetry, onCopyRef, onHelp;
  final Future<void> Function() onSupportCenter;

  String _guidance() {
    final t = error.toLowerCase();
    if (t.contains('cancel')) {
      return 'Checkout was closed before completion. Retry safely.';
    }
    if (t.contains('network') || t.contains('timeout')) {
      return 'Looks like a network issue. Check connection and retry.';
    }
    if (t.contains('verify') || t.contains('signature')) {
      return 'Payment may have been received but verification is pending. Contact support before retrying.';
    }
    return 'If ₹${order.amount.toStringAsFixed(0)} was deducted but booking did not update, raise a support ticket.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Container(
              color: const Color(0xFF7F1D1D),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 8, 16, 24),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      IconButton(
                        onPressed: () => Navigator.of(context).maybePop(),
                        icon: const Icon(Icons.arrow_back_ios_new_rounded,
                            color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 12),
                            Text(
                              'Payment Failed',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Booking #$bookingNumber',
                              style: GoogleFonts.inter(
                                  color: Colors.white60, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Error detail
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: const Color(0x44EF4444)),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: Color(0xFFFF8A8A), size: 40),
                      const SizedBox(height: 14),
                      Text(
                        error,
                        style: GoogleFonts.inter(
                            color: const Color(0xFFFF8A8A), fontSize: 14),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        _guidance(),
                        style: GoogleFonts.inter(
                            color: kMuted, fontSize: 13, height: 1.4),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // Actions
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: kBorder),
                  ),
                  child: Column(
                    children: [
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: onRetry,
                          style: FilledButton.styleFrom(
                              backgroundColor: kPrimary),
                          child: Text(
                            'Retry payment',
                            style: GoogleFonts.inter(
                                fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: onCopyRef,
                          icon: const Icon(Icons.copy_rounded, size: 16),
                          label: Text(
                            'Copy order ref: ${order.orderId}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: helping ? null : onHelp,
                          icon: helping
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: kPrimaryLight))
                              : const Icon(
                                  Icons.support_agent_rounded,
                                  size: 16),
                          label: const Text('Raise support ticket'),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: onSupportCenter,
                          child: const Text('Open support center'),
                        ),
                      ),
                    ],
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}
