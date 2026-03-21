import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'billing_payment_screen.dart';
import 'document_viewer_screen.dart';

class BillingHistoryScreen extends StatelessWidget {
  const BillingHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Billing History'),
        backgroundColor: const Color(0xFF090C1A),
        foregroundColor: Colors.white,
      ),
      backgroundColor: const Color(0xFF060816),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF1A2250), Color(0xFF2F3E8F)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Account billing snapshot', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
                const SizedBox(height: 12),
                _row('Current plan', billing.currentPlan),
                _row('Bill mode', billing.billMode),
                _row('Payment status', billing.paymentStatus),
                _row('Due amount', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
                _row('Next bill date', billing.nextBillDate.isEmpty ? '-' : billing.nextBillDate),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: appState.busy || billing.dueAmount <= 0
                            ? null
                            : () => _payNow(context, appState, amount: billing.dueAmount),
                        child: const Text('Pay now'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    OutlinedButton(
                      onPressed: appState.busy ? null : () => appState.refresh(),
                      child: const Text('Refresh'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Invoices', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (billing.invoices.isEmpty)
                  const Text('No invoices yet.', style: TextStyle(color: Color(0xFF7B625A)))
                else
                  ...billing.invoices.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _documentRow(
                          context,
                          appState,
                          title: item.invoiceNumber.isEmpty ? 'Invoice' : item.invoiceNumber,
                          subtitle: 'Due ${item.dueDate.isEmpty ? '-' : item.dueDate}',
                          amount: 'Rs ${item.totalAmount.toStringAsFixed(0)}',
                          trailing: item.paymentStatus,
                          viewUrl: item.viewUrl,
                        ),
                      )),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Payments', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (billing.payments.isEmpty)
                  const Text('No payments yet.', style: TextStyle(color: Color(0xFF7B625A)))
                else
                  ...billing.payments.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _documentRow(
                          context,
                          appState,
                          title: item.transactionId,
                          subtitle: '${item.provider.toUpperCase()}  ${item.paidAt.isEmpty ? '-' : item.paidAt}',
                          amount: 'Rs ${item.amount.toStringAsFixed(0)}',
                          trailing: item.reference.isEmpty ? 'receipt' : item.reference,
                          viewUrl: item.viewUrl,
                        ),
                      )),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Billing notes', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (billing.notes.isEmpty)
                  const Text('No billing notes.', style: TextStyle(color: Color(0xFF7B625A)))
                else
                  ...billing.notes.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _documentRow(
                          context,
                          appState,
                          title: item.noteNumber,
                          subtitle: item.reason.isEmpty ? item.type : item.reason,
                          amount: 'Rs ${item.totalAmount.toStringAsFixed(0)}',
                          trailing: item.issuedAt.isEmpty ? item.type : item.issuedAt,
                          viewUrl: item.viewUrl,
                        ),
                      )),
              ],
            ),
          ),
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
    required String trailing,
    required String viewUrl,
  }) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(subtitle, style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12)),
              if (viewUrl.isNotEmpty)
                TextButton(
                  onPressed: () => _openDocument(context, appState, title, viewUrl),
                  child: const Text('Open'),
                ),
            ],
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(amount, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(trailing, style: const TextStyle(color: Color(0xFFD81F26), fontSize: 12)),
          ],
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Colors.white70)),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
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
}
