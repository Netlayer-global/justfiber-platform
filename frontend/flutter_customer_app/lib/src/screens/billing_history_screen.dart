import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'billing_payment_screen.dart';
import 'document_viewer_screen.dart';
import 'payments_history_screen.dart';

class BillingHistoryScreen extends StatelessWidget {
  const BillingHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final theme = Theme.of(context);
    final latestInvoice = billing.invoices.isEmpty ? null : billing.invoices.first;
    final latestPayment = billing.payments.isEmpty ? null : billing.payments.first;
    final invoiceCount = billing.invoices.length;
    final paymentCount = billing.payments.length;
    final noteCount = billing.notes.length;

    return Scaffold(
      appBar: AppBar(title: const Text('Billing')),
      body: ListView(
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
                Text(
                  'BILLING CONSOLE',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: const Color(0xFF9CA3AF),
                    letterSpacing: 3.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Current bill',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFFEFEEE8),
                    fontSize: 28,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Rs ${billing.dueAmount.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 38, color: Color(0xFFE6FF3C), letterSpacing: -1),
                ),
                const SizedBox(height: 6),
                Text(
                  billing.paymentStatus.isEmpty
                      ? 'Your active billing snapshot for this cycle'
                      : 'Status: ${billing.paymentStatus}',
                  style: const TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _summaryTile('Generated', billing.generatedDate.isEmpty ? '-' : billing.generatedDate)),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryTile('Due date', billing.nextBillDate.isEmpty ? '-' : billing.nextBillDate)),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _summaryTile('Cycle', billing.billCycle)),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryTile('Mode', billing.billMode)),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFEEE8),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x22E6FF3C)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Bill snapshot', style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 10),
                      _billBreakupRow('Current due', 'Rs ${billing.dueAmount.toStringAsFixed(2)}'),
                      _billBreakupRow('Last payment', billing.lastPaymentAmount <= 0 ? '-' : 'Rs ${billing.lastPaymentAmount.toStringAsFixed(2)}'),
                      _billBreakupRow('Adjustment preview', billing.adjustmentPreview == 0 ? '-' : 'Rs ${billing.adjustmentPreview.toStringAsFixed(2)}'),
                      _billBreakupRow('Payment status', billing.paymentStatus.isEmpty ? '-' : billing.paymentStatus),
                    ],
                  ),
                ),
                if (billing.pendingPlanChange != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFFFF),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text(
                      'Pending plan change: ${billing.pendingPlanChange!.planName}',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF1F2937)),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: appState.busy || billing.dueAmount <= 0
                            ? null
                            : () => _payNow(context, appState, amount: billing.dueAmount),
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE6FF3C), foregroundColor: const Color(0xFF031B17)),
                        child: Text(billing.pendingPlanChange != null ? 'Pay to switch plan' : 'Pay now'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: appState.busy ? null : appState.refresh,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFEFEEE8),
                          backgroundColor: const Color(0xFF0E1520),
                          side: const BorderSide(color: Color(0x55E6FF3C)),
                        ),
                        child: const Text('Refresh'),
                      ),
                    ),
                  ],
                ),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _countChip('Invoices', invoiceCount.toString(), dark: true),
                    _countChip('Payments', paymentCount.toString(), dark: true),
                    _countChip('Notes', noteCount.toString(), dark: true),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Invoices',
            child: billing.invoices.isEmpty
                ? const Text('No invoices available yet.', style: TextStyle(color: Color(0xFF6B7280)))
                : Column(
                    children: billing.invoices
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _documentRow(
                              context,
                              appState,
                              title: item.invoiceNumber.isEmpty ? 'Invoice' : item.invoiceNumber,
                              subtitle: 'Generated ${item.generatedAt.isEmpty ? '-' : item.generatedAt}',
                              amount: 'Rs ${item.totalAmount.toStringAsFixed(2)}',
                              meta: item.paymentStatus,
                              viewUrl: item.viewUrl,
                              pdfUrl: item.pdfUrl,
                            ),
                          ),
                        )
                        .toList(),
                  ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Payments',
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFEFEEE8),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0x22E6FF3C)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Payments overview',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    billing.payments.isEmpty
                        ? 'No payment history available yet.'
                        : 'Latest payment: ${billing.payments.first.amount.toStringAsFixed(2)} | ${billing.payments.first.paidAt.isEmpty ? billing.payments.first.provider.toUpperCase() : billing.payments.first.paidAt}',
                    style: const TextStyle(color: Color(0xFF6B7280), height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                        OutlinedButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const PaymentsHistoryScreen()),
                          ),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF111111),
                            backgroundColor: const Color(0xFFF3F1E9),
                            side: const BorderSide(color: Color(0x14000000)),
                          ),
                          child: const Text('Open payments history'),
                        ),
                      if (latestInvoice != null && latestInvoice.pdfUrl.isNotEmpty)
                        OutlinedButton(
                          onPressed: () => _openDocument(context, appState, latestInvoice.invoiceNumber, latestInvoice.pdfUrl),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF111111),
                            backgroundColor: const Color(0xFFF3F1E9),
                            side: const BorderSide(color: Color(0x14000000)),
                          ),
                          child: const Text('Latest invoice'),
                        ),
                      if (latestPayment != null && latestPayment.pdfUrl.isNotEmpty)
                        FilledButton.tonal(
                          onPressed: () => _openDocument(context, appState, latestPayment.transactionId, latestPayment.pdfUrl),
                          style: FilledButton.styleFrom(backgroundColor: const Color(0x14E6FF3C), foregroundColor: const Color(0xFF0B0F19)),
                          child: const Text('Latest receipt'),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Billing notes',
            child: billing.notes.isEmpty
                ? const Text('No billing notes right now.', style: TextStyle(color: Color(0xFF6B7280)))
                : Column(
                    children: billing.notes
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _documentRow(
                              context,
                              appState,
                              title: item.noteNumber,
                              subtitle: item.reason.isEmpty ? item.type : item.reason,
                              amount: 'Rs ${item.totalAmount.toStringAsFixed(2)}',
                              meta: item.issuedAt.isEmpty ? item.type : item.issuedAt,
                              viewUrl: item.viewUrl,
                              pdfUrl: item.pdfUrl,
                            ),
                          ),
                        )
                        .toList(),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _summaryTile(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEFEEE8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x22E6FF3C)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _countChip(String label, String value, {bool dark = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: dark ? const Color(0x14E6FF3C) : const Color(0xFFEFEEE8),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: dark ? const Color(0x66E6FF3C) : const Color(0x22E6FF3C)),
      ),
      child: RichText(
        text: TextSpan(
          style: TextStyle(color: dark ? const Color(0xFFEFEEE8) : const Color(0xFF1F2937)),
          children: [
            TextSpan(text: '$label ', style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _billBreakupRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w700)),
          ),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _documentRow(
    BuildContext context,
    AppState appState, {
    required String title,
    required String subtitle,
    required String amount,
    required String meta,
    required String viewUrl,
    required String pdfUrl,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFFFFF), Color(0xFFF8FFFB)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x22E6FF3C)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280))),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(amount, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  const SizedBox(height: 4),
                  Text(meta, style: const TextStyle(color: Color(0xFFD81F26), fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          if (viewUrl.isNotEmpty || pdfUrl.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (viewUrl.isNotEmpty)
                  OutlinedButton(
                    onPressed: () => _openDocument(context, appState, title, viewUrl),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF111111),
                      backgroundColor: const Color(0xFFF3F1E9),
                      side: const BorderSide(color: Color(0x14000000)),
                    ),
                    child: const Text('Open'),
                  ),
                if (pdfUrl.isNotEmpty)
                  FilledButton.tonal(
                    onPressed: () => _openDocument(context, appState, '$title PDF', pdfUrl),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFE6FF3C),
                      foregroundColor: const Color(0xFF111111),
                    ),
                    child: const Text('Open PDF'),
                  ),
                if (pdfUrl.isNotEmpty || viewUrl.isNotEmpty)
                  TextButton(
                    onPressed: () => _shareDocument(appState, pdfUrl.isNotEmpty ? pdfUrl : viewUrl),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF111111),
                    ),
                    child: const Text('Share'),
                  ),
              ],
            ),
          ],
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

  Future<void> _payNow(BuildContext context, AppState appState, {double? amount}) async {
    final messenger = ScaffoldMessenger.of(context);
    final paymentOrder = await appState.loadBillingPaymentOrder(amount: amount);
    if (!context.mounted) return;
    if (paymentOrder == null) {
      messenger.showSnackBar(
        SnackBar(content: Text(appState.error ?? 'Unable to create payment order')),
      );
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => BillingPaymentScreen(paymentOrder: paymentOrder),
      ),
    );
    await appState.refresh();
  }

  Future<void> _shareDocument(AppState appState, String relativeUrl) async {
    if (relativeUrl.isEmpty) return;
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl = relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    await Share.share(fullUrl);
  }
}

