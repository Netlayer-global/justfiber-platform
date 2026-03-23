import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';

class BillingPaymentScreen extends StatefulWidget {
  const BillingPaymentScreen({super.key, required this.paymentOrder});

  final BillingPaymentOrder paymentOrder;

  @override
  State<BillingPaymentScreen> createState() => _BillingPaymentScreenState();
}

class _BillingPaymentScreenState extends State<BillingPaymentScreen> {
  late final Razorpay _razorpay;
  bool launching = false;
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
    if (launching) return;
    setState(() {
      launching = true;
      paymentError = null;
      walletHint = null;
    });
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
        'color': '#E6FF3C',
      },
    });
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final appState = AppStateScope.of(context);
    final ok = await appState.verifyBillPayment(
      orderId: response.orderId ?? widget.paymentOrder.orderId,
      paymentId: response.paymentId ?? '',
      signature: response.signature ?? '',
      amount: widget.paymentOrder.amount,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Payment successful.' : (appState.error ?? 'Payment verification failed')),
      ),
    );
    if (ok) {
      Navigator.of(context).pop();
    } else {
      setState(() => launching = false);
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() {
      launching = false;
      paymentError = response.message ?? 'Payment failed';
      retryCount += 1;
    });
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    setState(() {
      walletHint = 'Continue payment in ${response.walletName ?? 'wallet'} and return here after completion.';
    });
  }

  Future<void> _requestPaymentHelp() async {
    final appState = AppStateScope.of(context);
    final ticketNumber = await appState.raiseComplaint(
      category: 'billing',
      subject: 'Payment failed for bill',
      description:
          'Payment failed while trying to pay Rs ${widget.paymentOrder.amount.toStringAsFixed(0)} for order ${widget.paymentOrder.orderId}. Please assist with billing/payment confirmation.',
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ticketNumber == null ? (appState.error ?? 'Unable to create support request') : 'Support ticket created: $ticketNumber'),
      ),
    );
  }

  Future<void> _copyOrderReference() async {
    await Clipboard.setData(ClipboardData(text: widget.paymentOrder.orderId));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Order reference copied')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bill Payment'),
      ),
      body: RefreshIndicator(
        color: const Color(0xFFE6FF3C),
        backgroundColor: const Color(0xFF0C1018),
        onRefresh: AppStateScope.of(context).refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 36),
          children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF060A12), Color(0xFF101827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Razorpay checkout',
                        style: TextStyle(color: const Color(0xFFEFEEE8), fontWeight: FontWeight.w800, fontSize: 22),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Amount: Rs ${widget.paymentOrder.amount.toStringAsFixed(0)}',
                        style: const TextStyle(color: Color(0xFFB8C2D1), fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        paymentError == null
                            ? 'The secure payment window opens automatically.'
                            : 'Your payment attempt needs attention before completion.',
                        style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: const Color(0x14E6FF3C),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x66E6FF3C)),
                  ),
                  child: Icon(
                    paymentError == null ? Icons.payments_rounded : Icons.error_outline_rounded,
                    color: paymentError == null ? const Color(0xFFE6FF3C) : const Color(0xFFFF8A80),
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
                      color: const Color(0xFF10151A),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0x55E6FF3C)),
                    ),
                    child: Text(
                      walletHint!,
                      style: const TextStyle(color: Color(0xFFEFEEE8), fontWeight: FontWeight.w600, height: 1.4),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
                if (launching) ...[
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
                    retryCount > 0 ? 'Try payment again' : 'Ready to continue payment?',
                    style: theme.textTheme.titleLarge,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    paymentError ?? 'If checkout did not appear, relaunch it below.',
                    style: theme.textTheme.bodyMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _openCheckout,
                      child: Text(retryCount > 0 ? 'Retry payment' : 'Open checkout'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _requestPaymentHelp,
                      child: const Text('Raise billing ticket'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: _copyOrderReference,
                      child: const Text('Copy order reference'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEFEEE8),
                        backgroundColor: const Color(0xFF10151A),
                        side: const BorderSide(color: Color(0x55E6FF3C)),
                      ),
                      child: const Text('Back to app'),
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
}

