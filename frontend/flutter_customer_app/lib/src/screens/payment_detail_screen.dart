import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:share_plus/share_plus.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'support_history_screen.dart';

class PaymentDetailScreen extends StatelessWidget {
  const PaymentDetailScreen({super.key, required this.payment});
  final BillingPaymentItem payment;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    String paidAt = '—';
    if (payment.paidAt.isNotEmpty) {
      try {
        final dt = DateTime.parse(payment.paidAt).toLocal();
        final months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        paidAt = '${dt.day} ${months[dt.month-1]} ${dt.year}, ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
      } catch (_) {
        paidAt = payment.paidAt;
      }
    }
    final provider =
        payment.provider.isEmpty ? '—' : payment.provider.toUpperCase();
    final reference = payment.reference.isEmpty ? '—' : payment.reference;
    final receiptReady =
        payment.pdfUrl.isNotEmpty || payment.viewUrl.isNotEmpty;
    final isPaid = payment.paidAt.isNotEmpty;
    final isFailed = payment.reference.toLowerCase().contains('failed');

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refresh,
        child: CustomScrollView(
          slivers: [
            // ── Gradient header ──────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                decoration: BoxDecoration(
                  color: isPaid
                      ? const Color(0xFF16A34A)
                      : isFailed
                          ? const Color(0xFFDC2626)
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
                                isFailed
                                    ? 'Payment Failed'
                                    : isPaid
                                        ? 'Payment Confirmed'
                                        : 'Payment Pending',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                payment.transactionId,
                                style: GoogleFonts.inter(
                                    color: Colors.white60, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            'Rs ${payment.amount.toStringAsFixed(0)}',
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
                  // Details card
                  _card(
                    child: Column(
                      children: [
                        _row(
                            'Status',
                            isFailed
                                ? 'Failed'
                                : isPaid
                                    ? 'Success'
                                    : 'Pending'),
                        _row('Paid on', paidAt),
                        _row('Provider', provider),
                        _row('Reference', reference),
                        _row('Receipt',
                            receiptReady ? 'Available' : 'Not ready yet',
                            last: true),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Action buttons
                  _card(
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton(
                                onPressed: () => Navigator.of(context).pop(),
                                child: const Text('Back to billing'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () => _shareDocumentWithFeedback(
                                    context, appState),
                                child: Text(receiptReady
                                    ? 'Share receipt'
                                    : 'Share details'),
                              ),
                            ),
                          ],
                        ),
                        if (!receiptReady) ...[
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.tonal(
                              onPressed:
                                  appState.busy ? null : appState.refresh,
                              child: const Text('Refresh receipt status'),
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton(
                            onPressed: () async {
                              await Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) =>
                                          const SupportHistoryScreen()));
                              if (context.mounted) await appState.refresh();
                            },
                            child: const Text('Need payment support'),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Receipt actions
                  _card(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Receipt actions',
                            style: GoogleFonts.inter(
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                                color: Colors.white)),
                        const SizedBox(height: 14),
                        if (payment.viewUrl.isNotEmpty)
                          _actionTile(
                            icon: Icons.receipt_long_rounded,
                            title: 'Open receipt',
                            sub: 'View inside the app',
                            onTap: () => _openDocument(
                                context, appState, 'Receipt', payment.viewUrl),
                          ),
                        if (payment.pdfUrl.isNotEmpty)
                          _actionTile(
                            icon: Icons.picture_as_pdf_rounded,
                            title: 'Open receipt PDF',
                            sub: 'View payment receipt PDF',
                            onTap: () => _openDocument(context, appState,
                                'Receipt PDF', payment.pdfUrl),
                          ),
                        _actionTile(
                          icon: Icons.copy_rounded,
                          title: 'Copy transaction ID',
                          sub: 'Keep reference handy for support',
                          onTap: () => _copyText(context, payment.transactionId,
                              'Transaction ID copied'),
                        ),
                        if (payment.reference.isNotEmpty)
                          _actionTile(
                            icon: Icons.tag_rounded,
                            title: 'Copy payment reference',
                            sub: 'Use to verify payment manually',
                            onTap: () => _copyText(context, payment.reference,
                                'Payment reference copied'),
                          ),
                        _actionTile(
                          icon: Icons.share_rounded,
                          title: 'Share payment',
                          sub: receiptReady
                              ? 'Send receipt link'
                              : 'Share transaction details',
                          onTap: () =>
                              _shareDocumentWithFeedback(context, appState),
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
            Text(value,
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    fontSize: 13)),
          ],
        ),
      );

  Widget _actionTile({
    required IconData icon,
    required String title,
    required String sub,
    required VoidCallback onTap,
    bool last = false,
  }) =>
      Column(
        children: [
          PressableScale(
            onTap: onTap,
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
                                GoogleFonts.inter(fontSize: 11, color: kMuted)),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      color: kMuted, size: 18),
                ],
              ),
            ),
          ),
          if (!last) const Divider(color: kBorder, height: 1, indent: 54),
        ],
      );

  Future<void> _openDocument(BuildContext context, AppState appState,
      String title, String relativeUrl) async {
    final session = appState.session;
    if (session == null) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Please login again to open this document.')));
      return;
    }
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl =
        relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    try {
      final response = await http.get(
        Uri.parse(fullUrl),
        headers: {'Authorization': 'Bearer ${session.accessToken}'},
      );
      if (response.statusCode == 200) {
        final file = File(
            '${Directory.systemTemp.path}/${title.replaceAll(' ', '_')}.pdf');
        await file.writeAsBytes(response.bodyBytes);
        await Share.shareXFiles([XFile(file.path)], subject: title);
      } else {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Could not open document (${response.statusCode}).')));
      }
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open document.')));
    }
  }

  Future<void> _shareDocument(AppState appState) async {
    final relativeUrl =
        payment.pdfUrl.isNotEmpty ? payment.pdfUrl : payment.viewUrl;
    if (relativeUrl.isEmpty) {
      await Share.share(
        'JustFiber payment\nTransaction: ${payment.transactionId}\nAmount: Rs ${payment.amount.toStringAsFixed(2)}\nStatus: ${payment.paidAt.isEmpty ? 'Pending' : 'Success'}\nReference: ${payment.reference.isEmpty ? '—' : payment.reference}',
        subject: 'JustFiber payment ${payment.transactionId}',
      );
      return;
    }
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl =
        relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    await Share.share(fullUrl,
        subject: 'JustFiber receipt ${payment.transactionId}');
  }

  Future<void> _shareDocumentWithFeedback(
      BuildContext context, AppState appState) async {
    await _shareDocument(appState);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment details ready to share')));
  }

  Future<void> _copyText(
      BuildContext context, String text, String message) async {
    if (text.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}
