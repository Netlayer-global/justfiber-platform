import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import 'billing_payment_screen.dart';

class PlanCatalogScreen extends StatefulWidget {
  const PlanCatalogScreen({super.key});

  @override
  State<PlanCatalogScreen> createState() => _PlanCatalogScreenState();
}

class _PlanCatalogScreenState extends State<PlanCatalogScreen> {
  String effectiveMode = 'immediate';

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final plans = appState.planChangeOptions;
    final currentPlan = appState.billing.currentPlan.toLowerCase();

    return Scaffold(
      appBar: AppBar(
        title: Column(
          children: [
            Text('Select a plan', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 2),
            Text(appState.wifi.ssid24, style: const TextStyle(fontSize: 18, color: Color(0xFF676B76))),
          ],
        ),
        centerTitle: true,
        backgroundColor: const Color(0xFFF1F0FF),
        foregroundColor: const Color(0xFF17181C),
      ),
      backgroundColor: const Color(0xFFF1F0FF),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          Row(
            children: [
              _tabChip('Recommended', true),
              const SizedBox(width: 10),
              _tabChip('Wi‑Fi', false),
              const SizedBox(width: 10),
              _tabChip('Wi‑Fi + Digital TV', false),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              const Expanded(child: Text('Plans to choose from', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28))),
              TextButton(onPressed: () {}, child: const Text('Compare')),
            ],
          ),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment<String>(value: 'immediate', label: Text('Immediate')),
              ButtonSegment<String>(value: 'next_cycle', label: Text('Next cycle')),
            ],
            selected: {effectiveMode},
            onSelectionChanged: (value) => setState(() => effectiveMode = value.first),
          ),
          const SizedBox(height: 18),
          if (plans.isEmpty)
            const Text('No alternate plans available right now.')
          else
            ...plans.map((plan) {
              final isCurrent = currentPlan.contains(plan.name.toLowerCase()) || currentPlan.contains(plan.planCode.toLowerCase());
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: const [BoxShadow(color: Color(0x12000000), blurRadius: 18, offset: Offset(0, 8))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (isCurrent) ...[
                            _badge('Active', const Color(0xFFDCFCE7), const Color(0xFF166534)),
                            const SizedBox(width: 8),
                          ],
                          _badge(effectiveMode == 'next_cycle' ? 'Next cycle' : 'Immediate', const Color(0xFFE9E7FF), const Color(0xFF4338CA)),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(child: _planMetric('Rs ${plan.monthlyPrice.toStringAsFixed(0)} /m + GST', 'Price')),
                          Expanded(child: _planMetric('${plan.speedMbps.toStringAsFixed(0)} Mbps', 'Speed')),
                          Expanded(child: _planMetric('Unlimited', 'Internet')),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          for (final icon in _benefitIcons(plan)) ...[
                            Container(
                              width: 40,
                              height: 40,
                              margin: const EdgeInsets.only(right: 8),
                              decoration: BoxDecoration(color: const Color(0xFFF5F3FF), borderRadius: BorderRadius.circular(12)),
                              child: Icon(icon, color: const Color(0xFF20242E), size: 22),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          TextButton(
                            onPressed: () => _previewPlan(context, appState, plan),
                            child: const Text('View Details'),
                          ),
                          const Spacer(),
                          SizedBox(
                            width: 210,
                            child: OutlinedButton(
                              onPressed: appState.busy ? null : () => _applyPlan(context, appState, plan),
                              child: Text(isCurrent ? 'Change Duration' : 'Select Plan'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  Widget _tabChip(String label, bool active) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: active ? const Color(0xFF2563EB) : const Color(0xFFD9DCE8)),
        ),
        alignment: Alignment.center,
        child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: active ? const Color(0xFF111827) : const Color(0xFF6B7280))),
      ),
    );
  }

  Widget _badge(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w700)),
    );
  }

  Widget _planMetric(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Color(0xFF7B7F87))),
      ],
    );
  }

  List<IconData> _benefitIcons(PlanItem plan) {
    final lower = plan.name.toLowerCase();
    if (lower.contains('entertainment') || lower.contains('ott')) {
      return const [Icons.movie_outlined, Icons.live_tv_rounded, Icons.wifi_rounded, Icons.add_circle_outline];
    }
    return const [Icons.cloud_outlined, Icons.wifi_rounded];
  }

  Future<void> _previewPlan(BuildContext context, AppState appState, PlanItem plan) async {
    final preview = await appState.previewPlanChange(planCode: plan.planCode, effectiveMode: effectiveMode);
    if (!context.mounted || preview == null) {
      if (context.mounted && appState.error != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(appState.error!)));
      }
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 52, height: 6, decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(99)))),
              const SizedBox(height: 18),
              Text(preview.nextPlanName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 30)),
              const SizedBox(height: 14),
              _previewRow('Current price', 'Rs ${preview.currentPrice.toStringAsFixed(0)}'),
              _previewRow('Next price', 'Rs ${preview.nextPrice.toStringAsFixed(0)}'),
              _previewRow('Remaining days', '${preview.remainingDays}'),
              _previewRow('Adjustment', 'Rs ${preview.adjustmentAmount.toStringAsFixed(0)}'),
              if (preview.payableNow > 0) _previewRow('Payable now', 'Rs ${preview.payableNow.toStringAsFixed(0)}'),
              if (preview.creditAmount > 0) _previewRow('Credit amount', 'Rs ${preview.creditAmount.toStringAsFixed(0)}'),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                    _applyPlan(context, appState, plan);
                  },
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF111317)),
                  child: const Text('Select Plan'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _previewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6B7280))),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Future<void> _applyPlan(BuildContext context, AppState appState, PlanItem plan) async {
    final request = await appState.requestPlanChange(planCode: plan.planCode, effectiveMode: effectiveMode);
    if (!context.mounted) return;
    final result = appState.lastPlanChangeResult;
    if (result == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(appState.error ?? 'Unable to apply plan change')));
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result.paymentRequired
              ? 'Pay Rs ${result.payableNow.toStringAsFixed(0)} to complete this plan change.'
              : result.scheduled
                  ? 'Plan change scheduled: ${request ?? result.requestNumber}'
                  : 'Plan updated successfully.',
        ),
      ),
    );
    if (result.paymentRequired && result.payableNow > 0) {
      final paymentOrder = await appState.loadBillingPaymentOrder(amount: result.payableNow);
      if (!context.mounted || paymentOrder == null) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => BillingPaymentScreen(paymentOrder: paymentOrder)),
      );
    }
  }
}
