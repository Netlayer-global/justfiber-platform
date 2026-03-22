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

    return Scaffold(
      appBar: AppBar(title: const Text('Billing')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFFFF5F5), Color(0xFFF4F5FF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Current bill', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 26)),
                const SizedBox(height: 10),
                Text(
                  'Rs ${billing.dueAmount.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 34),
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
                        child: Text(billing.pendingPlanChange != null ? 'Pay to switch plan' : 'Pay now'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: appState.busy ? null : appState.refresh,
                        child: const Text('Refresh'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const PaymentsHistoryScreen()),
                    ),
                    child: const Text('Open payments history'),
                  ),
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
            child: billing.payments.isEmpty
                ? const Text('No payment history available yet.', style: TextStyle(color: Color(0xFF6B7280)))
                : Column(
                    children: billing.payments
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _documentRow(
                              context,
                              appState,
                              title: item.transactionId,
                              subtitle: item.paidAt.isEmpty ? item.provider.toUpperCase() : item.paidAt,
                              amount: 'Rs ${item.amount.toStringAsFixed(2)}',
                              meta: item.reference.isEmpty ? item.provider : item.reference,
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
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
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
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(22),
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
                    child: const Text('Open'),
                  ),
                if (pdfUrl.isNotEmpty)
                  FilledButton.tonal(
                    onPressed: () => _openDocument(context, appState, '$title PDF', pdfUrl),
                    child: const Text('Open PDF'),
                  ),
                if (pdfUrl.isNotEmpty || viewUrl.isNotEmpty)
                  TextButton(
                    onPressed: () => _shareDocument(appState, pdfUrl.isNotEmpty ? pdfUrl : viewUrl),
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
  }

  Future<void> _shareDocument(AppState appState, String relativeUrl) async {
    if (relativeUrl.isEmpty) return;
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl = relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    await Share.share(fullUrl);
  }
}
