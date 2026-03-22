import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../core/app_state.dart';
import '../core/models.dart';

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
        'color': '#4C5DFF',
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bill Payment'),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            color: Colors.white,
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Razorpay Checkout', style: TextStyle(color: Color(0xFF16171D), fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(
                        'Amount: Rs ${widget.paymentOrder.amount.toStringAsFixed(0)}',
                        style: const TextStyle(color: Color(0xFF6B7280)),
                      ),
                    ],
                  ),
                ),
                FilledButton.tonal(
                  onPressed: launching ? null : _openCheckout,
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 40),
              children: [
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: const [
                      BoxShadow(color: Color(0x120F172A), blurRadius: 24, offset: Offset(0, 12)),
                    ],
                  ),
                  child: Column(
                    children: [
                      Icon(
                        paymentError == null ? Icons.payments_rounded : Icons.error_outline_rounded,
                        size: 72,
                        color: const Color(0xFF16171D),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        paymentError == null ? 'Secure payment window opens automatically.' : 'Payment needs your attention.',
                        style: const TextStyle(color: Color(0xFF16171D), fontSize: 18, fontWeight: FontWeight.w700),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 10),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          paymentError ??
                              'If nothing appears, tap Retry to launch Razorpay again.',
                          style: const TextStyle(color: Color(0xFF6B7280)),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      if (walletHint != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          walletHint!,
                          style: const TextStyle(color: Color(0xFFFFD9B8)),
                          textAlign: TextAlign.center,
                        ),
                      ],
                      const SizedBox(height: 24),
                      if (launching) const CircularProgressIndicator(),
                      if (!launching) ...[
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
                            child: const Text('Need help? Raise billing ticket'),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextButton(
                          onPressed: () => Navigator.of(context).pop(),
                          child: const Text('Back to app'),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
