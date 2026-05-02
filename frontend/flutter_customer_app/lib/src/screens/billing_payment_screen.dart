import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'support_history_screen.dart';

class BillingPaymentScreen extends StatefulWidget {
  const BillingPaymentScreen({super.key, required this.paymentOrder});
  final BillingPaymentOrder paymentOrder;

  @override
  State<BillingPaymentScreen> createState() => _BillingPaymentScreenState();
}

class _BillingPaymentScreenState extends State<BillingPaymentScreen> {
  late final Razorpay _razorpay;
  bool launching = false;
  bool verifying = false;
  bool helping = false;
  String? paymentError;
  String? walletHint;
  String? lastPaymentId;
  int retryCount = 0;

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
    if (launching || verifying) return;
    if (widget.paymentOrder.keyId.trim().isEmpty ||
        widget.paymentOrder.orderId.trim().isEmpty ||
        widget.paymentOrder.amountPaise <= 0) {
      setState(() {
        paymentError =
            'Payment order is incomplete. Please retry from billing or contact support.';
      });
      return;
    }
    setState(() {
      launching = true;
      verifying = false;
      paymentError = null;
      walletHint = null;
    });
    try {
      final prefill = <String, Object>{};
      if (widget.paymentOrder.customerPhone.trim().isNotEmpty) {
        prefill['contact'] = widget.paymentOrder.customerPhone.trim();
      }
      if (widget.paymentOrder.customerEmail.trim().isNotEmpty) {
        prefill['email'] = widget.paymentOrder.customerEmail.trim();
      }
      _razorpay.open({
        'key': widget.paymentOrder.keyId,
        'amount': widget.paymentOrder.amountPaise,
        'currency': widget.paymentOrder.currency,
        'name': widget.paymentOrder.customerName.trim().isNotEmpty
            ? widget.paymentOrder.customerName.trim()
            : 'JustFiber',
        'description': 'Bill payment',
        'order_id': widget.paymentOrder.orderId,
        'prefill': prefill,
        'theme': {'color': '#8224E3'},
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        launching = false;
        paymentError =
            'Unable to launch checkout right now. Please retry or raise a billing ticket.';
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _openSupportCenter() async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => const SupportHistoryScreen()));
    if (!mounted) return;
    await AppStateScope.of(context).refresh();
  }

  Future<void> _requestPaymentHelp() async {
    if (helping) return;
    final appState = AppStateScope.of(context);
    setState(() => helping = true);
    final ticketNumber = await appState.raiseComplaint(
      category: 'billing',
      subject: 'Payment failed for bill',
      description:
          'Payment failed while trying to pay Rs ${widget.paymentOrder.amount.toStringAsFixed(0)} for order ${widget.paymentOrder.orderId}. Please assist with billing/payment confirmation.',
    );
    if (!mounted) return;
    setState(() => helping = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ticketNumber == null
          ? (appState.error ?? 'Unable to create support request')
          : 'Support ticket created: $ticketNumber'),
    ));
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final appState = AppStateScope.of(context);
    setState(() {
      launching = false;
      verifying = true;
      paymentError = null;
      lastPaymentId = response.paymentId;
    });
    final ok = await appState.verifyBillPayment(
      orderId: response.orderId ?? widget.paymentOrder.orderId,
      paymentId: response.paymentId ?? '',
      signature: response.signature ?? '',
      amount: widget.paymentOrder.amount,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? 'Payment received. Updating your billing records.'
          : (appState.error ?? 'Payment verification failed')),
    ));
    if (ok) {
      await appState.refresh();
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } else {
      setState(() {
        launching = false;
        verifying = false;
      });
    }
  }

  BillingPaymentItem? _findMatchingPayment(AppState appState) {
    final payments = appState.billing.payments;
    if (payments.isEmpty) return null;
    final orderId = widget.paymentOrder.orderId.toLowerCase();
    final paymentId = (lastPaymentId ?? '').toLowerCase();
    for (final payment in payments) {
      final tx = payment.transactionId.toLowerCase();
      final ref = payment.reference.toLowerCase();
      if (paymentId.isNotEmpty &&
          (tx.contains(paymentId) || ref.contains(paymentId))) {
        return payment;
      }
      if (orderId.isNotEmpty &&
          (tx.contains(orderId) || ref.contains(orderId))) {
        return payment;
      }
    }
    return payments.first;
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

  Future<void> _copyOrderReference() async {
    await Clipboard.setData(ClipboardData(text: widget.paymentOrder.orderId));
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Order reference copied')));
  }

  Future<void> _refreshReceiptStatus() async {
    final appState = AppStateScope.of(context);
    setState(() {
      verifying = true;
      paymentError = null;
    });
    await appState.refresh();
    if (!mounted) return;
    final payment = _findMatchingPayment(appState);
    setState(() => verifying = false);
    if (payment != null && payment.paidAt.isNotEmpty) {
      await Navigator.of(context).pushReplacement(MaterialPageRoute(
          builder: (_) => PaymentDetailScreen(payment: payment)));
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(appState.error ??
          'Receipt is not available yet. If amount was debited, wait briefly or contact support.'),
    ));
  }

  String _failureGuidance() {
    if (paymentError == null || paymentError!.trim().isEmpty) {
      return 'Confirm the bill details above, then continue to secure payment.';
    }
    final text = paymentError!.toLowerCase();
    if (text.contains('cancel')) {
      return 'The payment window was closed before completion. You can retry safely from this screen.';
    }
    if (text.contains('network') ||
        text.contains('timeout') ||
        text.contains('unable to connect')) {
      return 'This looks like a network issue. Check internet, retry once, and contact support if the amount was debited but not confirmed.';
    }
    if (text.contains('signature') || text.contains('verify')) {
      return 'Payment may have reached us but verification is still pending. Wait a few seconds, refresh billing, and contact support if the receipt does not appear.';
    }
    return 'Retry once from this screen. If money is deducted without a receipt, copy the order reference and raise a billing ticket.';
  }

  @override
  Widget build(BuildContext context) {
    final busy = launching || verifying;
    final order = widget.paymentOrder;

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: AppStateScope.of(context).refresh,
        child: CustomScrollView(
          slivers: [
            // ── Gradient header ──────────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                decoration: BoxDecoration(
                  color: paymentError != null
                      ? const Color(0xFFDC2626)
                      : verifying
                          ? const Color(0xFF16A34A)
                          : const Color(0xFF8224E3),
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
                                    ? 'Confirming Payment'
                                    : paymentError != null
                                        ? 'Payment Needs Attention'
                                        : retryCount > 0
                                            ? 'Retry Payment'
                                            : 'Pay Bill',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                verifying
                                    ? 'Stay on screen while we confirm...'
                                    : _failureGuidance(),
                                style: GoogleFonts.inter(
                                    color: Colors.white60, fontSize: 13),
                                maxLines: 2,
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
                  // Order details card
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
                        _row(
                            'Email',
                            order.customerEmail.isEmpty
                                ? '—'
                                : order.customerEmail),
                        _row('Provider', order.provider.toUpperCase()),
                        _row('Order Ref', order.orderId),
                        _row('Currency', order.currency),
                        _row('Amount', 'Rs ${order.amount.toStringAsFixed(2)}',
                            last: true),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Wallet hint
                  if (walletHint != null) ...[
                    _card(
                      child: Row(
                        children: [
                          const Icon(Icons.account_balance_wallet_rounded,
                              color: kPrimaryLight, size: 20),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(walletHint!,
                                style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontSize: 13,
                                    height: 1.4)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Error card
                  if (paymentError != null) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A0505),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0x44EF4444)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded,
                                  color: Color(0xFFFBBF24), size: 18),
                              const SizedBox(width: 8),
                              Text('If amount was debited',
                                  style: GoogleFonts.inter(
                                      color: const Color(0xFFFBBF24),
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13)),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '1. Do not pay again immediately.\n2. Copy the order reference.\n3. Open support and mention the debited amount.',
                            style: GoogleFonts.inter(
                                color: const Color(0xFFFDE68A),
                                fontSize: 12,
                                height: 1.5),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  // After payment info
                  _card(
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: kPrimary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(11),
                          ),
                          child: const Icon(Icons.info_outline_rounded,
                              color: kPrimaryLight, size: 18),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'After payment, we verify it, refresh your billing record, and open the receipt screen automatically.',
                            style: GoogleFonts.inter(
                                color: kMuted, fontSize: 12, height: 1.5),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Action card
                  _card(
                    child: Column(
                      children: [
                        if (busy) ...[
                          const SizedBox(height: 8),
                          CircularProgressIndicator(
                            color:
                                verifying ? const Color(0xFF22C55E) : kPrimary,
                            strokeWidth: 2.5,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            verifying
                                ? 'Confirming your payment...'
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
                                ? 'Please stay on this screen while we update your invoice.'
                                : 'Keep this screen open while Razorpay loads.',
                            style:
                                GoogleFonts.inter(color: kMuted, fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 8),
                        ] else ...[
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton(
                              onPressed: _openCheckout,
                              child: Text(
                                  retryCount > 0 ? 'Retry payment' : 'Pay now'),
                            ),
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: _refreshReceiptStatus,
                              child: const Text('I paid — refresh receipt'),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed:
                                      helping ? null : _requestPaymentHelp,
                                  child: Text(
                                      helping ? 'Creating...' : 'Need help'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: _openSupportCenter,
                                  child: const Text('Support'),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('Back to Billing'),
                            ),
                          ),
                          const SizedBox(height: 4),
                          PressableScale(
                            onTap: _copyOrderReference,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.copy_rounded,
                                      size: 14, color: kMuted),
                                  const SizedBox(width: 6),
                                  Text('Copy order reference',
                                      style: GoogleFonts.inter(
                                          fontSize: 12,
                                          color: kMuted,
                                          fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ]),
              ),
            ),
          ],
        ),
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
}
