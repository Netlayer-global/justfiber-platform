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
    setState(() => launching = true);
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
    setState(() => launching = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(response.message ?? 'Payment failed'),
      ),
    );
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Continue payment in ${response.walletName ?? 'wallet'}'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bill Payment'),
        backgroundColor: const Color(0xFF090C1A),
        foregroundColor: Colors.white,
      ),
      backgroundColor: const Color(0xFF060816),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            color: const Color(0xFF111935),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Razorpay Checkout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(
                        'Amount: Rs ${widget.paymentOrder.amount.toStringAsFixed(0)}',
                        style: const TextStyle(color: Color(0xFFD7DBF4)),
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
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.payments_rounded,
                  size: 72,
                  color: Colors.white.withOpacity(0.9),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Secure payment window opens automatically.',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24),
                  child: Text(
                    'If nothing appears, tap Retry to launch Razorpay again.',
                    style: TextStyle(color: Color(0xFFD7DBF4)),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 24),
                if (launching) const CircularProgressIndicator(color: Colors.white),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
