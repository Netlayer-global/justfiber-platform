import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';
import '../billing_history_screen.dart';
import '../billing_payment_screen.dart';
import '../payments_history_screen.dart';
import '../plan_catalog_screen.dart';
import '../service_tracking_screen.dart';
import '../support_history_screen.dart';

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
    final wifi = appState.wifi;
    final planOptions = appState.planChangeOptions;
    final preview = appState.planChangePreview;
    final pendingPlanChange = billing.pendingPlanChange;
    selectedPlanCode ??= planOptions.firstOrNull?.planCode;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFFF4F5FF), Color(0xFFFFF3F4)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(dashboard.customerName, style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                wifi.ssid24.isEmpty ? 'Customer account' : wifi.ssid24,
                style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(child: _topMetric('Plan', billing.currentPlan)),
                  const SizedBox(width: 10),
                  Expanded(child: _topMetric('Mode', billing.billMode)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: _topMetric('Due', 'Rs ${billing.dueAmount.toStringAsFixed(0)}')),
                  const SizedBox(width: 10),
                  Expanded(child: _topMetric('Status', billing.paymentStatus)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _sectionCard(
          title: 'Account shortcuts',
          child: Column(
            children: [
              _shortcut('Bills & invoices', 'Open billing, invoices, notes, and receipts', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BillingHistoryScreen()))),
              _shortcut('Transactions', 'View payment history and receipts', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PaymentsHistoryScreen()))),
              _shortcut('Track requests', 'Booking, installer visit, and service request tracking', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()))),
              _shortcut('Support history', 'Complaints, notifications, and service requests', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SupportHistoryScreen())), last: true),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _sectionCard(
          title: 'Plan management',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (pendingPlanChange != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Pending plan change', style: TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 8),
                      _row('Target plan', pendingPlanChange.planName),
                      _row('Mode', pendingPlanChange.effectiveMode),
                      _row('Current price', 'Rs ${pendingPlanChange.currentPrice.toStringAsFixed(0)}'),
                      _row('Next price', 'Rs ${pendingPlanChange.nextPrice.toStringAsFixed(0)}'),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],
              if (planOptions.isEmpty)
                const Text('No alternate plans available right now.', style: TextStyle(color: Color(0xFF6B7280)))
              else ...[
                DropdownButtonFormField<String>(
                  value: selectedPlanCode,
                  items: planOptions
                      .map(
                        (plan) => DropdownMenuItem(
                          value: plan.planCode,
                          child: Text('${plan.name} • ${plan.speedMbps.toStringAsFixed(0)} Mbps'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => selectedPlanCode = value),
                  decoration: const InputDecoration(labelText: 'Select plan'),
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
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: appState.busy || selectedPlanCode == null
                            ? null
                            : () => appState.previewPlanChange(
                                  planCode: selectedPlanCode!,
                                  effectiveMode: effectiveMode,
                                ),
                        child: const Text('Preview'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                        ),
                        child: const Text('Browse plans'),
                      ),
                    ),
                  ],
                ),
                if (preview != null && preview.nextPlanCode == selectedPlanCode && preview.effectiveMode == effectiveMode) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(preview.nextPlanName, style: const TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 8),
                        _row('Current price', 'Rs ${preview.currentPrice.toStringAsFixed(0)}'),
                        _row('Next price', 'Rs ${preview.nextPrice.toStringAsFixed(0)}'),
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
                              SnackBar(content: Text(requestNumber != null && requestNumber.isNotEmpty ? message : (appState.error ?? 'Plan change failed'))),
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
        _sectionCard(
          title: 'Recent activity',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _row('Last payment', billing.lastPaymentDate.isEmpty ? '-' : billing.lastPaymentDate),
              _row('Last payment amount', 'Rs ${billing.lastPaymentAmount.toStringAsFixed(0)}'),
              _row('Current bill cycle', billing.billCycle),
              _row('Wi-Fi name', wifi.ssid24),
              _row('Connected devices', '${wifi.connectedDevicesCount}'),
              if ((appState.error ?? '').isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(appState.error!, style: const TextStyle(color: Color(0xFFD81F26), fontWeight: FontWeight.w700)),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        FilledButton.tonal(
          onPressed: appState.logout,
          child: const Text('Logout'),
        ),
      ],
    );
  }

  Widget _topMetric(String label, String value) {
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

  Widget _shortcut(String title, String subtitle, VoidCallback onTap, {bool last = false}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          border: Border(
            bottom: last ? BorderSide.none : const BorderSide(color: Color(0xFFE5E7EB)),
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280))),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF9CA3AF)),
          ],
        ),
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6B7280))),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
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
