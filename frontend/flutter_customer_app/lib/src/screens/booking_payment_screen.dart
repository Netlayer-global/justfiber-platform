import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'support_history_screen.dart';

class BookingPaymentScreen extends StatefulWidget {
  const BookingPaymentScreen({
    super.key,
    required this.bookingNumber,
    required this.paymentOrder,
  });

  final String bookingNumber;
  final BillingPaymentOrder paymentOrder;

  @override
  State<BookingPaymentScreen> createState() => _BookingPaymentScreenState();
}

class _BookingPaymentScreenState extends State<BookingPaymentScreen> {
  late final Razorpay _razorpay;
  bool launching = false;
  bool verifying = false;
  bool helping = false;
  String? paymentError;
  String? walletHint;
  int retryCount = 0;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);
    WidgetsBinding.instance.addPostFrameCallback((_) => _openCheckout());
  }

  @override
  void dispose() {
    _razorpay.clear();
    super.dispose();
  }

  void _openCheckout() {
    if (launching || verifying) return;
    setState(() {
      launching = true;
      verifying = false;
      paymentError = null;
      walletHint = null;
    });
    try {
      _razorpay.open({
        'key': widget.paymentOrder.keyId,
        'amount': widget.paymentOrder.amountPaise,
        'currency': widget.paymentOrder.currency,
        'name': 'JustFiber',
        'description': 'Booking payment',
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
        launching = false;
        paymentError = 'Unable to launch checkout right now. Please retry.';
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final appState = AppStateScope.of(context);
    setState(() {
      launching = false;
      verifying = true;
      paymentError = null;
    });
    final ok = await appState.verifyBookingPayment(
      bookingNumber: widget.bookingNumber,
      orderId: response.orderId ?? widget.paymentOrder.orderId,
      paymentId: response.paymentId ?? '',
      signature: response.signature ?? '',
      amount: widget.paymentOrder.amount,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? 'Booking payment successful.'
          : (appState.error ?? 'Booking payment verification failed')),
    ));
    if (ok) {
      await appState.refreshBookingTracking(silent: true);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } else {
      setState(() => verifying = false);
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() {
      launching = false;
      verifying = false;
      paymentError = response.message ?? 'Payment failed';
      retryCount += 1;
    });
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    setState(() {
      launching = false;
      walletHint =
          'Continue payment in ${response.walletName ?? 'wallet'} and return here after completion.';
    });
  }

  Future<void> _refreshBookingStatus() async {
    final appState = AppStateScope.of(context);
    await appState.refreshBookingTracking();
    if (!mounted) return;
    final hasUpdate = (appState.bookingTracking?.steps.isNotEmpty ?? false) ||
        appState.latestBooking != null;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(hasUpdate
          ? 'Booking status refreshed.'
          : (appState.error ?? 'No booking update found yet')),
    ));
  }

  Future<void> _copyOrderReference() async {
    await Clipboard.setData(ClipboardData(text: widget.paymentOrder.orderId));
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Order reference copied')));
  }

  Future<void> _requestPaymentHelp() async {
    if (helping) return;
    final appState = AppStateScope.of(context);
    setState(() => helping = true);
    final ticketNumber = await appState.raiseComplaint(
      category: 'booking',
      subject: 'Booking payment failed',
      description:
          'Payment failed while trying to pay Rs ${widget.paymentOrder.amount.toStringAsFixed(0)} for booking ${widget.bookingNumber}. Please assist.',
    );
    if (!mounted) return;
    setState(() => helping = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ticketNumber == null
          ? (appState.error ?? 'Unable to create support request')
          : 'Support ticket created: $ticketNumber'),
    ));
  }

  Future<void> _openSupportCenter() async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const SupportHistoryScreen()));
  }

  String _failureGuidance() {
    if (paymentError == null || paymentError!.trim().isEmpty) {
      return 'Open Razorpay checkout to complete this booking payment.';
    }
    final text = paymentError!.toLowerCase();
    if (text.contains('cancel')) {
      return 'Checkout was closed before completion. You can retry safely.';
    }
    if (text.contains('network') ||
        text.contains('timeout') ||
        text.contains('unable to connect')) {
      return 'This looks like a network issue. Retry once after connection stabilizes.';
    }
    if (text.contains('verify') || text.contains('signature')) {
      return 'Payment may be received but verification is pending. Refresh booking status before retrying.';
    }
    return 'Retry once. If amount was deducted but booking did not update, create a support ticket.';
  }

  @override
  Widget build(BuildContext context) {
    final busy = launching || verifying;
    final order = widget.paymentOrder;

    return Scaffold(
      backgroundColor: kBg,
      body: CustomScrollView(
        slivers: [
          // ── Gradient header ────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: paymentError != null
                      ? [
                          const Color(0xFF1A0505),
                          const Color(0xFF5C0A0A),
                          const Color(0xFFEF4444)
                        ]
                      : verifying
                          ? [
                              const Color(0xFF051A0A),
                              const Color(0xFF0A4020),
                              const Color(0xFF22C55E)
                            ]
                          : [
                              const Color(0xFF13051F),
                              const Color(0xFF3B0D7A),
                              const Color(0xFFA855F7)
                            ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
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
                              verifying
                                  ? 'Verifying Payment'
                                  : paymentError != null
                                      ? 'Payment Needs Attention'
                                      : retryCount > 0
                                          ? 'Retry Payment'
                                          : 'Booking Payment',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Booking ${widget.bookingNumber}',
                              style: GoogleFonts.inter(
                                  color: Colors.white60, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(
                          'Rs ${order.amount.toStringAsFixed(0)}',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 32),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // Status / guidance card
                _card(
                  child: busy
                      ? Column(
                          children: [
                            const SizedBox(height: 8),
                            CircularProgressIndicator(
                              color: verifying
                                  ? const Color(0xFF22C55E)
                                  : kPrimary,
                              strokeWidth: 2.5,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              verifying
                                  ? 'Verifying payment...'
                                  : 'Launching secure checkout...',
                              style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 16,
                                  color: Colors.white),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              verifying
                                  ? 'Hold this screen while booking records are updated.'
                                  : 'Keep this screen open while Razorpay loads.',
                              style: GoogleFonts.inter(
                                  color: kMuted, fontSize: 12),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                          ],
                        )
                      : Column(
                          children: [
                            Container(
                              width: 52,
                              height: 52,
                              decoration: BoxDecoration(
                                color: (paymentError != null
                                        ? const Color(0xFFEF4444)
                                        : kPrimary)
                                    .withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(15),
                                border: Border.all(
                                    color: (paymentError != null
                                            ? const Color(0xFFEF4444)
                                            : kPrimary)
                                        .withValues(alpha: 0.2)),
                              ),
                              child: Icon(
                                paymentError != null
                                    ? Icons.error_outline_rounded
                                    : Icons.lock_rounded,
                                color: paymentError != null
                                    ? const Color(0xFFFF8A8A)
                                    : kPrimaryLight,
                                size: 24,
                              ),
                            ),
                            const SizedBox(height: 14),
                            Text(
                              paymentError != null
                                  ? 'Payment needs attention'
                                  : 'Secure payment ready',
                              style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 16,
                                  color: Colors.white),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _failureGuidance(),
                              style: GoogleFonts.inter(
                                  color: kMuted, fontSize: 13, height: 1.4),
                              textAlign: TextAlign.center,
                            ),
                            if (paymentError != null) ...[
                              const SizedBox(height: 12),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0x22EF4444),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: const Color(0x44EF4444)),
                                ),
                                child: Text(paymentError!,
                                    style: GoogleFonts.inter(
                                        color: const Color(0xFFFF8A8A),
                                        fontSize: 12)),
                              ),
                            ],
                            if (walletHint != null) ...[
                              const SizedBox(height: 12),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: kPrimary.withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: kPrimary.withValues(alpha: 0.2)),
                                ),
                                child: Text(walletHint!,
                                    style: GoogleFonts.inter(
                                        color: Colors.white,
                                        fontSize: 12,
                                        height: 1.4)),
                              ),
                            ],
                          ],
                        ),
                ),

                const SizedBox(height: 14),

                // Action buttons
                if (!busy)
                  _card(
                    child: Column(
                      children: [
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _openCheckout,
                            child: Text(retryCount > 0
                                ? 'Retry payment'
                                : 'Open checkout'),
                          ),
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: _refreshBookingStatus,
                            child: const Text('Refresh booking status'),
                          ),
                        ),
                      ],
                    ),
                  ),

                if (!busy) const SizedBox(height: 14),

                // Order details
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Order Details',
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: Colors.white)),
                      const SizedBox(height: 14),
                      _row('Booking', widget.bookingNumber),
                      _row(
                          'Customer',
                          order.customerName.isEmpty
                              ? '—'
                              : order.customerName),
                      _row(
                          'Mobile',
                          order.customerPhone.isEmpty
                              ? '—'
                              : order.customerPhone),
                      _row('Provider', order.provider.toUpperCase()),
                      _row('Order Ref', order.orderId),
                      _row('Amount', 'Rs ${order.amount.toStringAsFixed(2)}',
                          last: true),
                    ],
                  ),
                ),

                const SizedBox(height: 14),

                // Help actions
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Help & Actions',
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 15,
                              color: Colors.white)),
                      const SizedBox(height: 14),
                      _actionTile(
                        icon: Icons.copy_rounded,
                        title: 'Copy order reference',
                        sub: order.orderId,
                        onTap: _copyOrderReference,
                      ),
                      _actionTile(
                        icon: Icons.support_agent_rounded,
                        title: 'Need help with payment',
                        sub: 'Raise a support ticket',
                        onTap: helping ? null : _requestPaymentHelp,
                        trailing: helping
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: kPrimaryLight))
                            : null,
                      ),
                      _actionTile(
                        icon: Icons.history_rounded,
                        title: 'Open support center',
                        sub: 'Track tickets and requests',
                        onTap: _openSupportCenter,
                        last: true,
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

  Widget _card({required Widget child}) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorder),
        ),
        child: child,
      );

  Widget _row(String label, String value, {bool last = false}) => Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          border: Border(
              bottom:
                  last ? BorderSide.none : const BorderSide(color: kBorder)),
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
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      fontSize: 13)),
            ),
          ],
        ),
      );

  Widget _actionTile({
    required IconData icon,
    required String title,
    required String sub,
    required VoidCallback? onTap,
    bool last = false,
    Widget? trailing,
  }) =>
      Column(
        children: [
          PressableScale(
            onTap: onTap ?? () {},
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: kPrimary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(11),
                      border:
                          Border.all(color: kPrimary.withValues(alpha: 0.2)),
                    ),
                    child: Icon(icon, color: kPrimaryLight, size: 18),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title,
                            style: GoogleFonts.inter(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                                color: Colors.white)),
                        Text(sub,
                            style:
                                GoogleFonts.inter(fontSize: 11, color: kMuted),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis),
                      ],
                    ),
                  ),
                  trailing ??
                      const Icon(Icons.chevron_right_rounded,
                          color: kMuted, size: 18),
                ],
              ),
            ),
          ),
          if (!last) const Divider(color: kBorder, height: 1, indent: 54),
        ],
      );
}
