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
    if (launching) return;
    setState(() {
      launching = true;
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
      verifying = true;
      paymentError = null;
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
      final latestPayment = appState.billing.payments.isNotEmpty ? appState.billing.payments.first : null;
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
                    paymentError ?? 'Confirm the bill details above, then continue to secure payment.',
                    style: theme.textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _openCheckout,
                      child: Text(retryCount > 0 ? 'Retry payment' : 'Pay now'),
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
                        child: TextButton(
                          onPressed: helping ? null : _requestPaymentHelp,
                          child: Text(helping ? 'Creating ticket...' : 'Need help?'),
                        ),
                      ),
                      Expanded(
                        child: TextButton(
                          onPressed: _openSupportCenter,
                          child: const Text('Support center'),
                        ),
                      ),
                    ],
                  ),
                  TextButton(
                    onPressed: _copyOrderReference,
                    child: const Text('Copy order reference'),
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
}






