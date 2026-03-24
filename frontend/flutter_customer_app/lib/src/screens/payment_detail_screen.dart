import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
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
      body: RefreshIndicator(
        color: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFF7F8FC),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
          children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF0B0F19), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
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
                        color: const Color(0xFF10151A),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x668224E3)),
                      ),
                      child: const Icon(Icons.check_circle_rounded, color: Color(0xFF8224E3), size: 34),
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
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 24, color: Color(0xFF8224E3)),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                _detailRow('Payment status', paidAt == '-' ? 'Pending' : 'Success'),
                _detailRow('Paid on', paidAt),
                _detailRow('Provider', provider),
                _detailRow('Reference', reference),
                _detailRow('Receipt access', payment.pdfUrl.isNotEmpty || payment.viewUrl.isNotEmpty ? 'Available' : 'Not generated yet'),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFFF7F8FC),
            borderColor: const Color(0x228224E3),
            textColor: const Color(0xFFEFEEE8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'PAYMENT ACTIONS',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 22,
                    color: Color(0xFFEFEEE8),
                    letterSpacing: 0.2,
                  ),
                ),
                const SizedBox(height: 14),
                if (payment.viewUrl.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    iconColor: const Color(0xFF8224E3),
                    textColor: const Color(0xFFEFEEE8),
                    subtitleTextStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                    leading: const Icon(Icons.receipt_long_rounded),
                    title: const Text('Open payment receipt'),
                    subtitle: const Text('View the receipt inside the app'),
                    trailing: const SizedBox.shrink(),
                    onTap: () => _openDocument(context, appState, 'Receipt', payment.viewUrl),
                  ),
                if (payment.pdfUrl.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    iconColor: const Color(0xFF8224E3),
                    textColor: const Color(0xFFEFEEE8),
                    subtitleTextStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                    leading: const Icon(Icons.picture_as_pdf_rounded),
                    title: const Text('Open PDF'),
                    subtitle: const Text('View the payment receipt PDF'),
                    trailing: const SizedBox.shrink(),
                    onTap: () => _openDocument(context, appState, 'Receipt PDF', payment.pdfUrl),
                  ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  iconColor: const Color(0xFF8224E3),
                  textColor: const Color(0xFFEFEEE8),
                  subtitleTextStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                  leading: const Icon(Icons.copy_rounded),
                  title: const Text('Copy transaction ID'),
                  subtitle: const Text('Keep the payment reference handy for support'),
                  trailing: const SizedBox.shrink(),
                  onTap: () => _copyText(context, payment.transactionId, 'Transaction ID copied'),
                ),
                if (payment.reference.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    iconColor: const Color(0xFF8224E3),
                    textColor: const Color(0xFFEFEEE8),
                    subtitleTextStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                    leading: const Icon(Icons.tag_rounded),
                    title: const Text('Copy payment reference'),
                    subtitle: const Text('Use this if you need to verify payment manually'),
                    trailing: const SizedBox.shrink(),
                    onTap: () => _copyText(context, payment.reference, 'Payment reference copied'),
                  ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  iconColor: const Color(0xFF8224E3),
                  textColor: const Color(0xFFEFEEE8),
                  subtitleTextStyle: const TextStyle(color: Color(0xFF9CA3AF)),
                  leading: const Icon(Icons.share_rounded),
                  title: const Text('Share payment'),
                  subtitle: Text(
                    payment.pdfUrl.isNotEmpty || payment.viewUrl.isNotEmpty
                        ? 'Send this receipt link to someone else'
                        : 'Share transaction details even if receipt is not generated yet',
                  ),
                  trailing: const SizedBox.shrink(),
                  onTap: () => _shareDocumentWithFeedback(context, appState),
                ),
              ],
            ),
          ),
          ],
        ),
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
    if (session == null) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please login again to open this document.')),
      );
      return;
    }
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
    await appState.refresh();
  }

  Future<void> _shareDocument(AppState appState) async {
    final relativeUrl = payment.pdfUrl.isNotEmpty ? payment.pdfUrl : payment.viewUrl;
    if (relativeUrl.isEmpty) {
      await Share.share(
        'JustFiber payment\n'
        'Transaction: ${payment.transactionId}\n'
        'Amount: Rs ${payment.amount.toStringAsFixed(2)}\n'
        'Status: ${payment.paidAt.isEmpty ? 'Pending' : 'Success'}\n'
        'Reference: ${payment.reference.isEmpty ? '-' : payment.reference}',
        subject: 'JustFiber payment ${payment.transactionId}',
      );
      return;
    }
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl = relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    await Share.share(fullUrl, subject: 'JustFiber receipt ${payment.transactionId}');
  }

  Future<void> _shareDocumentWithFeedback(BuildContext context, AppState appState) async {
    await _shareDocument(appState);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Payment details ready to share')),
    );
  }

  Future<void> _copyText(BuildContext context, String text, String message) async {
    if (text.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}
