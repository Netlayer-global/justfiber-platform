import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';
import '../billing_payment_screen.dart';
import '../document_viewer_screen.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  String? selectedPlanCode;
  String effectiveMode = 'next_cycle';

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final dashboard = appState.dashboard;
    final planOptions = appState.planChangeOptions;
    final preview = appState.planChangePreview;
    final pendingPlanChange = billing.pendingPlanChange;
    selectedPlanCode ??= planOptions.firstOrNull?.planCode;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Text('Profile', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFFD81F26), Color(0xFFFF7A1A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Account detail', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
              const SizedBox(height: 12),
              _heroRow('Customer', dashboard.customerName),
              _heroRow('Current plan', billing.currentPlan),
              _heroRow('Status', billing.paymentStatus),
              _heroRow('Due date', billing.nextBillDate),
              _heroRow('Billing mode', billing.billMode),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Billing', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              _row('Latest bill', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
              _row(
                'Previous bill',
                billing.invoices.length > 1 ? 'Rs ${billing.invoices[1].totalAmount.toStringAsFixed(0)}' : '-',
              ),
              _row('Last payment', 'Rs ${billing.lastPaymentAmount.toStringAsFixed(0)}'),
              _row('Payment status', billing.paymentStatus),
              _row('Bill cycle', billing.billCycle),
              _row('Billing mode', billing.billMode),
              _row('Generated date', billing.generatedDate.isEmpty ? '-' : billing.generatedDate),
              _row('Last paid on', billing.lastPaymentDate.isEmpty ? '-' : billing.lastPaymentDate),
              if (billing.adjustmentPreview != 0) _row('Adjustment preview', 'Rs ${billing.adjustmentPreview.toStringAsFixed(0)}'),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: appState.busy || billing.dueAmount <= 0
                          ? null
                          : () => _payNow(context, appState, amount: billing.dueAmount),
                      child: Text(billing.pendingPlanChange != null ? 'Pay to switch plan' : 'Pay / Renew now'),
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
        if (pendingPlanChange != null) ...[
          const SizedBox(height: 18),
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF121938), Color(0xFF1A2250)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Pending plan change', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                _row('Target plan', pendingPlanChange.planName),
                _row('Mode', pendingPlanChange.effectiveMode),
                _row('Bill mode', pendingPlanChange.billMode),
                _row('Current price', 'Rs ${pendingPlanChange.currentPrice.toStringAsFixed(0)}'),
                _row('Next price', 'Rs ${pendingPlanChange.nextPrice.toStringAsFixed(0)}'),
                _row('Requested at', pendingPlanChange.requestedAt.isEmpty ? '-' : pendingPlanChange.requestedAt),
                if (pendingPlanChange.noteNumber.isNotEmpty) _row('Adjustment note', pendingPlanChange.noteNumber),
                const SizedBox(height: 8),
                Text(
                  billing.dueAmount > 0
                      ? 'Pay the pending amount to complete this change.'
                      : 'This change is queued and will apply automatically.',
                  style: const TextStyle(color: Color(0xFF7B625A)),
                ),
                if (billing.dueAmount > 0) ...[
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: appState.busy ? null : () => _payNow(context, appState, amount: billing.dueAmount),
                      child: Text('Pay Rs ${billing.dueAmount.toStringAsFixed(0)} now'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Recent payments', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...(billing.payments.isEmpty
                  ? [const Text('No payment history yet.', style: TextStyle(color: Color(0xFF7B625A)))]
                  : billing.payments.take(5).map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Rs ${item.amount.toStringAsFixed(0)}',
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${item.provider.toUpperCase()}  ${item.paidAt}',
                                    style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12),
                                  ),
                                  if (item.viewUrl.isNotEmpty)
                                    TextButton(
                                      onPressed: () => _openDocument(context, appState, item.transactionId, item.viewUrl),
                                      child: const Text('View receipt'),
                                    ),
                                ],
                              ),
                            ),
                            Flexible(
                              child: Text(
                                item.reference.isEmpty ? item.transactionId : item.reference,
                                textAlign: TextAlign.right,
                                style: const TextStyle(color: Color(0xFFD81F26), fontSize: 12),
                              ),
                            ),
                          ],
                        ),
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
              Text('Recent invoices', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...(billing.invoices.isEmpty
                  ? [const Text('No invoices available yet.', style: TextStyle(color: Color(0xFF7B625A)))]
                  : billing.invoices.take(5).map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.invoiceNumber.isEmpty ? 'Invoice' : item.invoiceNumber,
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Generated ${item.generatedAt.isEmpty ? '-' : item.generatedAt}',
                                    style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12),
                                  ),
                                  if (item.viewUrl.isNotEmpty)
                                    TextButton(
                                      onPressed: () => _openDocument(context, appState, item.invoiceNumber.isEmpty ? 'Invoice' : item.invoiceNumber, item.viewUrl),
                                      child: const Text('View invoice'),
                                    ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  'Rs ${item.totalAmount.toStringAsFixed(0)}',
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item.paymentStatus,
                                  style: const TextStyle(color: Color(0xFFD81F26), fontSize: 12),
                                ),
                              ],
                            ),
                          ],
                        ),
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
              Text('Plan change', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              if (planOptions.isEmpty)
                const Text('No alternate plans available right now.')
              else ...[
                DropdownButtonFormField<String>(
                  value: selectedPlanCode,
                  items: planOptions
                      .map(
                        (plan) => DropdownMenuItem(
                          value: plan.planCode,
                          child: Text('${plan.name} - ${plan.speedMbps.toStringAsFixed(0)} Mbps'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => selectedPlanCode = value),
                  decoration: const InputDecoration(labelText: 'Choose new plan'),
                ),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment<String>(value: 'next_cycle', label: Text('Next cycle')),
                    ButtonSegment<String>(value: 'immediate', label: Text('Immediate')),
                  ],
                  selected: {effectiveMode},
                  onSelectionChanged: (selection) => setState(() => effectiveMode = selection.first),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: appState.busy || selectedPlanCode == null
                      ? null
                      : () async {
                          await appState.previewPlanChange(
                            planCode: selectedPlanCode!,
                            effectiveMode: effectiveMode,
                          );
                        },
                  child: const Text('Preview adjustment'),
                ),
                if (preview != null && preview.nextPlanCode == selectedPlanCode && preview.effectiveMode == effectiveMode) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF7F1ED),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(preview.nextPlanName, style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        _row('Current price', 'Rs ${preview.currentPrice.toStringAsFixed(0)}'),
                        _row('Next price', 'Rs ${preview.nextPrice.toStringAsFixed(0)}'),
                        _row('Remaining days', '${preview.remainingDays}'),
                        _row('Adjustment', 'Rs ${preview.adjustmentAmount.toStringAsFixed(0)}'),
                        if (preview.payableNow > 0) _row('Payable now', 'Rs ${preview.payableNow.toStringAsFixed(0)}'),
                        if (preview.creditAmount > 0) _row('Credit amount', 'Rs ${preview.creditAmount.toStringAsFixed(0)}'),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy || selectedPlanCode == null
                        ? null
                        : () async {
                            final requestNumber = await appState.requestPlanChange(
                              planCode: selectedPlanCode!,
                              effectiveMode: effectiveMode,
                            );
                            if (!mounted) return;
                            final result = appState.lastPlanChangeResult;
                            final message =
                                result == null
                                    ? (appState.error ?? 'Plan change failed')
                                    : result.paymentRequired
                                        ? 'Pay Rs ${result.payableNow.toStringAsFixed(0)} to complete this plan change.'
                                        : result.scheduled
                                            ? 'Plan change scheduled: ${result.requestNumber}'
                                            : result.updated
                                                ? 'Plan updated successfully.'
                                                : 'Plan change requested: ${result.requestNumber}';
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(requestNumber != null && requestNumber.isNotEmpty ? message : (appState.error ?? 'Plan change failed')),
                              ),
                            );
                            if (result != null && result.paymentRequired && result.payableNow > 0) {
                              await _payNow(context, appState, amount: result.payableNow);
                            }
                          },
                    child: const Text('Apply plan change'),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Requests', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...(appState.requests.isEmpty
                  ? [const Text('No recent requests.', style: TextStyle(color: Color(0xFF7B625A)))]
                  : appState.requests.take(5).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 4),
                                  Text(item.createdAt, style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12)),
                                ],
                              ),
                            ),
                            Text(item.status, style: const TextStyle(color: Color(0xFFD81F26))),
                          ],
                        ),
                      ))),
            ],
          ),
        ),
        if (billing.notes.isNotEmpty) ...[
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Billing notes', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                ...billing.notes.take(5).map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.noteNumber, style: const TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 4),
                            Text(item.reason.isEmpty ? item.type : item.reason, style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12)),
                            if (item.viewUrl.isNotEmpty)
                              TextButton(
                                onPressed: () => _openDocument(context, appState, item.noteNumber, item.viewUrl),
                                child: const Text('View note'),
                              ),
                          ],
                        ),
                      ),
                      Text('Rs ${item.totalAmount.toStringAsFixed(0)}', style: const TextStyle(color: Color(0xFFD81F26))),
                    ],
                  ),
                )),
              ],
            ),
          ),
        ],
        const SizedBox(height: 18),
        FilledButton.tonal(
          onPressed: appState.logout,
          child: const Text('Logout'),
        ),
        if ((appState.error ?? '').isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(appState.error!, style: const TextStyle(color: Color(0xFFD81F26))),
        ],
      ],
    );
  }

  Widget _heroRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Colors.white70)),
          const Spacer(),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF7B625A))),
          const Spacer(),
          Flexible(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
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

extension on List<PlanItem> {
  PlanItem? get firstOrNull => isEmpty ? null : first;
}
