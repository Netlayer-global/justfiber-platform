import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
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
  bool helping = false;
  String? paymentError;
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
        'theme': {
          'color': '#8224E3',
        },
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        launching = false;
        paymentError = 'Unable to launch checkout right now. Please retry.';
      });
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final appState = AppStateScope.of(context);
    final ok = await appState.verifyBookingPayment(
      bookingNumber: widget.bookingNumber,
      orderId: response.orderId ?? widget.paymentOrder.orderId,
      paymentId: response.paymentId ?? '',
      signature: response.signature ?? '',
      amount: widget.paymentOrder.amount,
    );
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? 'Booking payment successful.' : (appState.error ?? 'Booking payment verification failed')),
      ),
    );
    if (ok) {
      Navigator.of(context).pop(true);
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Continue payment in ${response.walletName ?? 'wallet'} and return here after completion.')),
    );
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ticketNumber == null ? (appState.error ?? 'Unable to create support request') : 'Support ticket created: $ticketNumber'),
      ),
    );
  }

  Future<void> _openSupportCenter() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
    );
  }

  String _failureGuidance() {
    if (paymentError == null || paymentError!.trim().isEmpty) {
      return 'Open Razorpay checkout to complete this booking payment.';
    }
    final text = paymentError!.toLowerCase();
    if (text.contains('cancel')) {
      return 'Checkout was closed before payment was completed. You can retry from this screen.';
    }
    if (text.contains('network') || text.contains('timeout') || text.contains('unable to connect')) {
      return 'This looks like a network issue. Retry once after connection stabilizes.';
    }
    return 'Retry the booking payment once. If the amount was deducted but the booking did not update, create a support ticket from here.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Booking Payment')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Complete booking payment',
                  style: TextStyle(color: Color(0xFFFFFFFF), fontWeight: FontWeight.w800, fontSize: 22),
                ),
                const SizedBox(height: 8),
                Text(
                  'Booking ${widget.bookingNumber}',
                  style: const TextStyle(color: Color(0xFFF3E8FF), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 6),
                Text(
                  'Amount: Rs ${widget.paymentOrder.amount.toStringAsFixed(0)}',
                  style: const TextStyle(color: Color(0xFFF3E8FF), fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              children: [
                if (launching) ...[
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  const Text('Launching secure checkout...', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  const SizedBox(height: 8),
                  const Text(
                    'Keep this screen open while Razorpay loads.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF6E6A67)),
                  ),
                ] else ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: paymentError == null ? const Color(0xFFF8F4FF) : const Color(0xFFFDF2F2),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: paymentError == null ? const Color(0x228224E3) : const Color(0x22EF4444),
                      ),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          paymentError == null ? Icons.lock_rounded : Icons.error_outline_rounded,
                          color: paymentError == null ? const Color(0xFF8224E3) : const Color(0xFFDC2626),
                          size: 34,
                        ),
                        const SizedBox(height: 10),
                        Text(
                          paymentError == null ? 'Secure checkout ready' : 'Payment could not be completed',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800, fontSize: 18),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _failureGuidance(),
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                        ),
                      ],
                    ),
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
                      child: const Text(
                        'If money was debited, wait briefly before retrying. If the booking still does not update, create a support ticket so our team can confirm the payment manually.',
                        style: TextStyle(color: Color(0xFF9A3412), height: 1.45),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
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
                      onPressed: () => Navigator.of(context).pop(false),
                      child: const Text('Back'),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: TextButton(
                          onPressed: helping ? null : _requestPaymentHelp,
                          child: Text(helping ? 'Creating...' : 'Need help?'),
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
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
