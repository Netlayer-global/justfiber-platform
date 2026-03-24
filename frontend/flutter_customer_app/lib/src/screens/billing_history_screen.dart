import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'billing_payment_screen.dart';
import 'document_viewer_screen.dart';
import 'payments_history_screen.dart';
import 'plan_catalog_screen.dart';
import 'support_history_screen.dart';

class BillingHistoryScreen extends StatelessWidget {
  const BillingHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final theme = Theme.of(context);
    final latestInvoice = billing.invoices.isEmpty ? null : billing.invoices.first;
    final latestPayment = billing.payments.isEmpty ? null : billing.payments.first;
    final usageRatio = billing.usageCapGb > 0 ? (billing.usageGb / billing.usageCapGb).clamp(0, 1) : 0.0;
    final showUpgradePrompt = billing.usageCapReached || (billing.usageCapGb > 0 && usageRatio >= 0.65);

    return Scaffold(
      appBar: AppBar(title: const Text('Billing')),
      body: RefreshIndicator(
        color: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFF6F1EB),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
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
                Text(
                  'BILLING CONSOLE',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: const Color(0xFFE9D5FF),
                    letterSpacing: 3.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Current bill',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFFFFFFFF),
                    fontSize: 28,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Rs ${billing.dueAmount.toStringAsFixed(2)}',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 38, color: Color(0xFF8224E3), letterSpacing: -1),
                ),
                const SizedBox(height: 6),
                Text(
                  billing.paymentStatus.isEmpty
                      ? 'Your active billing snapshot for this cycle'
                      : 'Status: ${billing.paymentStatus}',
                  style: const TextStyle(color: Color(0xFFF3E8FF), fontWeight: FontWeight.w600),
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
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _summaryTile('Download', '${billing.speedMbps.toStringAsFixed(0)} Mbps')),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryTile('Upload', '${billing.uploadSpeedMbps.toStringAsFixed(0)} Mbps')),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x228224E3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Bill snapshot', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
                      const SizedBox(height: 10),
                      _billBreakupRow('Current due', 'Rs ${billing.dueAmount.toStringAsFixed(2)}'),
                      _billBreakupRow('Last payment', billing.lastPaymentAmount <= 0 ? '-' : 'Rs ${billing.lastPaymentAmount.toStringAsFixed(2)}'),
                      _billBreakupRow('Adjustment preview', billing.adjustmentPreview == 0 ? '-' : 'Rs ${billing.adjustmentPreview.toStringAsFixed(2)}'),
                      _billBreakupRow('Payment status', billing.paymentStatus.isEmpty ? '-' : billing.paymentStatus),
                    ],
                  ),
                ),
                if (billing.dataPolicy != 'unlimited' || billing.usageCapGb > 0) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFFFF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: billing.usageCapReached ? const Color(0x55FF6B6B) : const Color(0x228224E3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Expanded(
                              child: Text('Usage policy', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
                            ),
                            Text(
                              billing.usageCapReached ? 'Cap reached' : billing.dataPolicy.toUpperCase(),
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                color: billing.usageCapReached ? const Color(0xFFFF8A8A) : const Color(0xFF8224E3),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _billBreakupRow('Usage', '${billing.usageGb.toStringAsFixed(2)} GB'),
                        _billBreakupRow(
                          'Plan limit',
                          billing.usageCapGb > 0 ? '${billing.usageCapGb.toStringAsFixed(0)} GB' : 'Unlimited',
                        ),
                        _billBreakupRow(
                          'Policy',
                          billing.dataPolicy == 'fup'
                              ? 'FUP at ${billing.fupSpeedMbps > 0 ? '${billing.fupSpeedMbps.toStringAsFixed(0)} Mbps' : 'reduced speed'}'
                              : billing.dataPolicy == 'hard_cap'
                                  ? 'Hard cap'
                                  : 'Unlimited',
                        ),
                        if (billing.usageLastUpdatedAt.isNotEmpty)
                          _billBreakupRow('Last updated', billing.usageLastUpdatedAt),
                        if (billing.usageCapGb > 0) ...[
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value: (billing.usageGb / billing.usageCapGb).clamp(0, 1),
                              minHeight: 10,
                              backgroundColor: const Color(0xFFF1E8FF),
                              valueColor: AlwaysStoppedAnimation<Color>(
                                billing.usageCapReached ? const Color(0xFFFF6B6B) : const Color(0xFF8224E3),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                if (showUpgradePrompt) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF111816),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: billing.usageCapReached ? const Color(0x55FF6B6B) : const Color(0x558224E3)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          billing.usageCapReached ? 'Your current plan has hit its limit.' : 'You are nearing your data policy threshold.',
                          style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313)),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          billing.usageCapReached
                              ? 'Upgrade now to restore headroom and avoid slower service or cap restrictions.'
                              : 'Move to a faster plan before cap or FUP controls affect your connection.',
                          style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton(
                                onPressed: () async {
                                  await Navigator.of(context).push(
                                    MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                                  );
                                  if (context.mounted) {
                                    await appState.refresh();
                                  }
                                },
                                style: FilledButton.styleFrom(
                                  backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                                ),
                                child: const Text('Upgrade plan'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () async {
                                  await Navigator.of(context).push(
                                    MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
                                  );
                                  if (context.mounted) {
                                    await appState.refresh();
                                  }
                                },
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF8224E3),
                                  backgroundColor: const Color(0xFF0F141D),
                                  side: const BorderSide(color: Color(0x668224E3)),
                                ),
                                child: const Text('Need help'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                if (billing.pendingPlanChange != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFFFF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0x228224E3)),
                    ),
                    child: Text(
                      'Pending plan change: ${billing.pendingPlanChange!.planName}',
                      style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF8224E3)),
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
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                          elevation: 0,
                        ),
                        child: Text(billing.pendingPlanChange != null ? 'Pay to switch plan' : 'Pay now'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: appState.busy ? null : appState.refresh,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF1B2311),
                          foregroundColor: const Color(0xFF8224E3),
                          disabledBackgroundColor: const Color(0xFFF2ECE6),
                          disabledForegroundColor: const Color(0xFF6B7280),
                        ),
                        child: const Text('Refresh'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Invoices',
            child: billing.invoices.isEmpty
                ? _emptyState(
                    title: 'No invoices available yet.',
                    subtitle: 'Your generated invoices will appear here once a billing cycle is processed.',
                    actionLabel: 'Refresh billing',
                    onTap: appState.refresh,
                  )
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
                color: const Color(0xFFFFFFFF),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0x228224E3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Payments overview', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
                  const SizedBox(height: 8),
                  Text(
                    billing.payments.isEmpty
                        ? 'No payment history available yet.'
                        : 'Latest payment: ${billing.payments.first.amount.toStringAsFixed(2)} | ${billing.payments.first.paidAt.isEmpty ? billing.payments.first.provider.toUpperCase() : billing.payments.first.paidAt}',
                    style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                        OutlinedButton(
                          onPressed: () async {
                            await Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const PaymentsHistoryScreen()),
                            );
                            if (context.mounted) {
                              await appState.refresh();
                            }
                          },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF8224E3),
                            backgroundColor: const Color(0xFFFFFFFF),
                            side: const BorderSide(color: Color(0x668224E3)),
                          ),
                          child: const Text('Open payments history'),
                        ),
                      if (latestInvoice != null && latestInvoice.pdfUrl.isNotEmpty)
                        OutlinedButton(
                          onPressed: () async {
                            await _openDocument(context, appState, latestInvoice.invoiceNumber, latestInvoice.pdfUrl);
                            if (context.mounted) {
                              await appState.refresh();
                            }
                          },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF8224E3),
                            backgroundColor: const Color(0xFFFFFFFF),
                            side: const BorderSide(color: Color(0x668224E3)),
                          ),
                          child: const Text('Latest invoice'),
                        ),
                      if (latestPayment != null && latestPayment.pdfUrl.isNotEmpty)
                        FilledButton.tonal(
                          onPressed: () async {
                            await _openDocument(context, appState, latestPayment.transactionId, latestPayment.pdfUrl);
                            if (context.mounted) {
                              await appState.refresh();
                            }
                          },
                          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)),
                          child: const Text('Latest receipt'),
                        ),
                    ],
                  ),
                  if (billing.payments.isEmpty) ...[
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: billing.dueAmount > 0 ? () => _payNow(context, appState, amount: billing.dueAmount) : appState.refresh,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                      ),
                      child: Text(billing.dueAmount > 0 ? 'Pay current bill' : 'Refresh billing'),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Billing notes',
            child: billing.notes.isEmpty
                ? _emptyState(
                    title: 'No billing notes right now.',
                    subtitle: 'Credit notes, adjustments, and other billing notes will appear here when available.',
                    actionLabel: 'Refresh billing',
                    onTap: appState.refresh,
                  )
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
      ),
    );
  }

  Widget _summaryTile(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
        ],
      ),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: Color(0xFF131313))),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _emptyState({
    required String title,
    required String subtitle,
    required String actionLabel,
    required VoidCallback onTap,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(subtitle, style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45)),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: onTap,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
            ),
            child: Text(actionLabel),
          ),
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
            child: Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
          ),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
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
          colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x228224E3)),
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
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: Color(0xFF131313))),
                    const SizedBox(height: 4),
                    Text(subtitle, style: const TextStyle(color: Color(0xFF6E6A67))),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(amount, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF8224E3))),
                  const SizedBox(height: 4),
                  Text(meta, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
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
                if (viewUrl.isNotEmpty && pdfUrl.isEmpty)
                  OutlinedButton(
                    onPressed: () async {
                      await _openDocument(context, appState, title, viewUrl);
                      if (context.mounted) {
                        await appState.refresh();
                      }
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF8224E3),
                      backgroundColor: const Color(0xFFFFFFFF),
                      side: const BorderSide(color: Color(0x668224E3)),
                    ),
                    child: const Text('Open'),
                  ),
                if (pdfUrl.isNotEmpty)
                  FilledButton.tonal(
                    onPressed: () async {
                      await _openDocument(context, appState, '$title PDF', pdfUrl);
                      if (context.mounted) {
                        await appState.refresh();
                      }
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                    ),
                    child: Text(viewUrl.isNotEmpty ? 'Open invoice' : 'Open PDF'),
                  ),
                if (pdfUrl.isNotEmpty || viewUrl.isNotEmpty)
                  TextButton(
                    onPressed: () => _shareDocumentWithFeedback(context, appState, pdfUrl.isNotEmpty ? pdfUrl : viewUrl),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF8224E3),
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
    if (session == null) {
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
  }

  Future<void> _payNow(BuildContext context, AppState appState, {double? amount}) async {
    final messenger = ScaffoldMessenger.of(context);
    if (appState.session == null) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Please login again to continue bill payment.')),
      );
      return;
    }
    final paymentOrder = await appState.loadBillingPaymentOrder(amount: amount);
    if (!context.mounted) return;
    if (paymentOrder == null) {
      final errorMessage = appState.error ?? 'Unable to create payment order';
      messenger.showSnackBar(
        SnackBar(
          content: Text(errorMessage),
          action: SnackBarAction(
            label: 'Get help',
            onPressed: () async {
              await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
              );
              if (context.mounted) {
                await appState.refresh();
              }
            },
          ),
        ),
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

  Future<void> _shareDocumentWithFeedback(BuildContext context, AppState appState, String relativeUrl) async {
    if (relativeUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No document available to share yet.')),
      );
      return;
    }
    await _shareDocument(appState, relativeUrl);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Document ready to share')),
    );
  }
}






