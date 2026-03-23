import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import 'document_viewer_screen.dart';

class PaymentDetailScreen extends StatelessWidget {
  const PaymentDetailScreen({
    super.key,
    required this.payment,
  });

  final BillingPaymentItem payment;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final paidAt = payment.paidAt.isEmpty ? '-' : payment.paidAt;
    final provider = payment.provider.isEmpty ? '-' : payment.provider.toUpperCase();
    final reference = payment.reference.isEmpty ? '-' : payment.reference;

    return Scaffold(
      appBar: AppBar(
        title: Text('Payment Details', style: Theme.of(context).textTheme.headlineSmall),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0B0F19), Color(0xFF111827)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: const [
                BoxShadow(color: Color(0x14030B14), blurRadius: 18, offset: Offset(0, 8)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        color: const Color(0x14E6FF3C),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x66E6FF3C)),
                      ),
                      child: const Icon(Icons.check_circle_rounded, color: Color(0xFFE6FF3C), size: 34),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Broadband payment', style: TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w700)),
                          const SizedBox(height: 4),
                          Text(payment.transactionId, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: const Color(0xFFEFEEE8))),
                        ],
                      ),
                    ),
                    Text(
                      'Rs ${payment.amount.toStringAsFixed(2)}',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24, color: Color(0xFFE6FF3C)),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                _detailRow('Payment status', paidAt == '-' ? 'Pending' : 'Success'),
                _detailRow('Paid on', paidAt),
                _detailRow('Provider', provider),
                _detailRow('Reference', reference),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFFEFEEE8),
              borderRadius: BorderRadius.circular(28),
              boxShadow: const [
                BoxShadow(color: Color(0x14000000), blurRadius: 18, offset: Offset(0, 8)),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Quick actions', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                const SizedBox(height: 14),
                if (payment.viewUrl.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.receipt_long_rounded),
                    title: const Text('Open payment receipt'),
                    subtitle: const Text('View the receipt inside the app'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _openDocument(context, appState, 'Receipt', payment.viewUrl),
                  ),
                if (payment.pdfUrl.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.picture_as_pdf_rounded),
                    title: const Text('Open PDF'),
                    subtitle: const Text('View the payment receipt PDF'),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => _openDocument(context, appState, 'Receipt PDF', payment.pdfUrl),
                  ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.share_rounded),
                  title: const Text('Share payment'),
                  subtitle: const Text('Send this receipt link to someone else'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => _shareDocument(appState),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w600)),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w800, color: const Color(0xFFEFEEE8)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openDocument(BuildContext context, AppState appState, String title, String relativeUrl) async {
    final session = appState.session;
    if (session == null) return;
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl = relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DocumentViewerScreen(
          title: title,
          url: fullUrl,
          accessToken: session.accessToken,
        ),
      ),
    );
  }

  Future<void> _shareDocument(AppState appState) async {
    final relativeUrl = payment.pdfUrl.isNotEmpty ? payment.pdfUrl : payment.viewUrl;
    if (relativeUrl.isEmpty) return;
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl = relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    await Share.share(fullUrl);
  }
}

