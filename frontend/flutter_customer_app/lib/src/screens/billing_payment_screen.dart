import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
import 'payment_detail_screen.dart';
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
        'description': 'Bill payment',
        'order_id': widget.paymentOrder.orderId,
        'prefill': {
          'contact': widget.paymentOrder.customerPhone,
          'email': widget.paymentOrder.customerEmail,
          'name': widget.paymentOrder.customerName,
        },
        'theme': {
          'color': '#8224E3',
        },
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        launching = false;
        paymentError = 'Unable to launch checkout right now. Please retry or raise a billing ticket.';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString())),
      );
    }
  }

  Future<void> _openSupportCenter() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
    );
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ticketNumber == null ? (appState.error ?? 'Unable to create support request') : 'Support ticket created: $ticketNumber'),
      ),
    );
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Payment received. Updating your billing records.' : (appState.error ?? 'Payment verification failed')),
      ),
    );
    if (ok) {
      await appState.refresh();
      if (!mounted) return;
      final latestPayment = _findMatchingPayment(appState);
      if (latestPayment != null) {
        await Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => PaymentDetailScreen(payment: latestPayment)),
        );
      } else {
        Navigator.of(context).pop(true);
      }
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
      final reference = payment.reference.toLowerCase();
      if (paymentId.isNotEmpty && (tx.contains(paymentId) || reference.contains(paymentId))) {
        return payment;
      }
      if (orderId.isNotEmpty && (tx.contains(orderId) || reference.contains(orderId))) {
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
      walletHint = 'Continue payment in ${response.walletName ?? 'wallet'} and return here after completion.';
    });
  }

  Future<void> _copyOrderReference() async {
    await Clipboard.setData(ClipboardData(text: widget.paymentOrder.orderId));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Order reference copied')),
    );
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
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => PaymentDetailScreen(payment: payment)),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(appState.error ?? 'Receipt is not available yet. If amount was debited, wait briefly or contact support.'),
      ),
    );
  }

  String _failureGuidance() {
    if (paymentError == null || paymentError!.trim().isEmpty) {
      return 'Confirm the bill details above, then continue to secure payment.';
    }
    final text = paymentError!.toLowerCase();
    if (text.contains('cancel')) {
      return 'The payment window was closed before completion. You can retry safely from this screen.';
    }
    if (text.contains('network') || text.contains('timeout') || text.contains('unable to connect')) {
      return 'This looks like a network issue. Check internet, retry once, and contact support if the amount was debited but not confirmed.';
    }
    if (text.contains('signature') || text.contains('verify')) {
      return 'Payment may have reached us but verification is still pending. Wait a few seconds, refresh billing, and contact support if the receipt does not appear.';
    }
    return 'Retry once from this screen. If money is deducted without a receipt, copy the order reference and raise a billing ticket.';
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w600),
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pay Bill'),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFF6F1EB),
        onRefresh: AppStateScope.of(context).refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 36),
          children: [
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x228224E3),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'PAYMENT SUMMARY',
                        style: TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800, letterSpacing: 2.0),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Rs ${widget.paymentOrder.amount.toStringAsFixed(0)}',
                        style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w900, fontSize: 30),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        verifying
                            ? 'We have received the payment callback. Hold on while we confirm it.'
                            : paymentError == null
                                ? 'Review the bill details below and continue to secure payment.'
                                : 'Your payment attempt needs attention before completion.',
                        style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F4FF),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x228224E3)),
                  ),
                  child: Icon(
                    verifying
                        ? Icons.verified_rounded
                        : paymentError == null
                            ? Icons.payments_rounded
                            : Icons.error_outline_rounded,
                    color: paymentError == null ? const Color(0xFF8224E3) : const Color(0xFFC2410C),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Checkout details',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF131313)),
                ),
                const SizedBox(height: 14),
                _detailRow('Customer', widget.paymentOrder.customerName.isEmpty ? '-' : widget.paymentOrder.customerName),
                _detailRow('Mobile', widget.paymentOrder.customerPhone.isEmpty ? '-' : widget.paymentOrder.customerPhone),
                _detailRow('Email', widget.paymentOrder.customerEmail.isEmpty ? '-' : widget.paymentOrder.customerEmail),
                _detailRow('Provider', widget.paymentOrder.provider.toUpperCase()),
                _detailRow('Order reference', widget.paymentOrder.orderId),
                _detailRow('Currency', widget.paymentOrder.currency),
                _detailRow('Payable now', 'Rs ${widget.paymentOrder.amount.toStringAsFixed(2)}'),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _statusChip('Provider', widget.paymentOrder.provider.toUpperCase()),
                    _statusChip('Order', widget.paymentOrder.orderId),
                    _statusChip('Mode', retryCount > 0 ? 'Retry flow' : 'Fresh payment'),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8F4FF),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x228224E3)),
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('After payment', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
                      SizedBox(height: 8),
                      Text(
                        'We verify the payment, refresh your billing record, and open the receipt screen automatically.',
                        style: TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              children: [
                if (walletHint != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F4FF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0x558224E3)),
                    ),
                    child: Text(
                      walletHint!,
                      style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w600, height: 1.4),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                if (verifying) ...[
                  const SizedBox(height: 8),
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  const Text(
                    'Confirming your payment...',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Please stay on this screen for a few seconds while we update your invoice and receipt.',
                    textAlign: TextAlign.center,
                  ),
                ] else if (launching) ...[
                  const SizedBox(height: 8),
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  const Text(
                    'Launching secure checkout...',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Keep this screen open while Razorpay loads.',
                    textAlign: TextAlign.center,
                  ),
                ] else ...[
                  Text(
                    retryCount > 0 ? 'Retry your bill payment' : 'Review and continue',
                    style: theme.textTheme.titleLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _failureGuidance(),
                    style: theme.textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                  if (paymentError != null) ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x33F97316)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'If amount was debited',
                            style: TextStyle(
                              color: Color(0xFF9A3412),
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          SizedBox(height: 8),
                          Text(
                            '1. Do not pay again immediately.\n2. Copy the order reference.\n3. Open support and mention the debited amount.',
                            style: TextStyle(color: Color(0xFF9A3412), height: 1.45),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: (launching || verifying) ? null : _openCheckout,
                      child: Text(retryCount > 0 ? 'Retry payment' : 'Pay now'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: (launching || verifying) ? null : _refreshReceiptStatus,
                      child: const Text('I paid, refresh receipt'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Back to Billing'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: helping ? null : _requestPaymentHelp,
                          child: Text(helping ? 'Creating ticket...' : 'Need help'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _openSupportCenter,
                          child: const Text('Support center'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      onPressed: _copyOrderReference,
                      child: const Text('Copy order reference'),
                    ),
                  ),
                ],
              ],
            ),
          ),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF131313), fontSize: 12),
          children: [
            TextSpan(text: '$label ', style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}






