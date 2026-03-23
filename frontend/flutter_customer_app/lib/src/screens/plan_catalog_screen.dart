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
    final wifiName = appState.wifi.ssid24.isEmpty ? 'Active connection' : appState.wifi.ssid24;
    final premiumPlans = plans.where((plan) => _isPremium(plan)).toList();
    final standardPlans = plans.where((plan) => !_isPremium(plan)).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Choose your plan'),
        centerTitle: true,
        backgroundColor: const Color(0xFF0C1018),
        foregroundColor: const Color(0xFFEFEEE8),
      ),
      backgroundColor: const Color(0xFF0C1018),
      body: RefreshIndicator(
        color: const Color(0xFFE6FF3C),
        backgroundColor: const Color(0xFF0C1018),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
          children: [
          _heroCard(context, wifiName, appState.billing.currentPlan),
          const SizedBox(height: 18),
          _modeSwitcher(),
          const SizedBox(height: 20),
          if (plans.isEmpty)
            const Text('No alternate plans available right now.')
          else ...[
            if (premiumPlans.isNotEmpty) ...[
              _sectionHeader(
                'Recommended upgrades',
                'Higher speed and richer entertainment packs for this connection.',
              ),
              const SizedBox(height: 12),
              ...premiumPlans.map((plan) => _planCard(context, appState, plan, currentPlan, featured: true)),
              const SizedBox(height: 22),
            ],
            if (standardPlans.isNotEmpty) ...[
              _sectionHeader(
                'All Wi-Fi plans',
                'Clean broadband plans with fast upgrades and easy billing changes.',
              ),
              const SizedBox(height: 12),
              ...standardPlans.map((plan) => _planCard(context, appState, plan, currentPlan)),
            ],
          ],
          ],
        ),
      ),
    );
  }

  Widget _heroCard(BuildContext context, String wifiName, String currentPlanName) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0B0F19), Color(0xFF111827)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: const [
          BoxShadow(color: Color(0x220F172A), blurRadius: 28, offset: Offset(0, 14)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFEFEEE8).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0x66E6FF3C)),
            ),
            child: const Text(
              'Plan studio',
              style: TextStyle(color: const Color(0xFFEFEEE8), fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            wifiName,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: const Color(0xFFEFEEE8),
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            currentPlanName.isEmpty ? 'Pick a plan for this connection.' : 'Current plan: $currentPlanName',
            style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
          ),
          const SizedBox(height: 18),
          Row(
            children: const [
              Expanded(child: _HeroMetric(label: 'Flow', value: 'Modern')),
              SizedBox(width: 10),
              Expanded(child: _HeroMetric(label: 'Billing', value: 'Instant')),
              SizedBox(width: 10),
              Expanded(child: _HeroMetric(label: 'Upgrade', value: 'Live')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _modeSwitcher() {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: const Color(0xFFEFEEE8),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x22E6FF3C)),
      ),
      child: Row(
        children: [
          Expanded(child: _modeButton('immediate', 'Switch now', 'Apply with current-cycle adjustment')),
          const SizedBox(width: 8),
          Expanded(child: _modeButton('next_cycle', 'Next cycle', 'Queue the change for next billing cycle')),
        ],
      ),
    );
  }

  Widget _modeButton(String value, String title, String subtitle) {
    final active = effectiveMode == value;
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => setState(() => effectiveMode = value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF0B0F19) : const Color(0xFFEFEEE8),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: active ? const Color(0x66E6FF3C) : const Color(0x22E6FF3C)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                color: active ? const Color(0xFFEFEEE8) : const Color(0xFF111827),
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                color: active ? const Color(0xFFD1D5DB) : const Color(0xFF6B7280),
                fontSize: 12,
                height: 1.35,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
        const SizedBox(height: 4),
        Text(subtitle, style: const TextStyle(color: Color(0xFF64748B), height: 1.4)),
      ],
    );
  }

  Widget _planCard(
    BuildContext context,
    AppState appState,
    PlanItem plan,
    String currentPlan, {
    bool featured = false,
  }) {
    final isCurrent = currentPlan.contains(plan.name.toLowerCase()) || currentPlan.contains(plan.planCode.toLowerCase());
    final accent = featured ? const Color(0xFFE6FF3C) : const Color(0xFFE6FF3C);
    final background = featured ? const Color(0xFFEFEEE8) : const Color(0xFFEFEEE8);

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: featured ? const Color(0x22E6FF3C) : const Color(0x22E6FF3C)),
          boxShadow: const [
            BoxShadow(color: Color(0x14030B14), blurRadius: 18, offset: Offset(0, 10)),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (isCurrent) _badge('Active', const Color(0xFFDCFCE7), const Color(0xFF166534)),
                          _badge(
                            featured ? 'Recommended' : (effectiveMode == 'next_cycle' ? 'Next cycle' : 'Switch now'),
                          featured ? const Color(0x14E6FF3C) : const Color(0x14E6FF3C),
                          featured ? const Color(0xFFE6FF3C) : const Color(0xFFE6FF3C),
                        ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(plan.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
                      const SizedBox(height: 6),
                      Text(
                        'Rs ${plan.monthlyPrice.toStringAsFixed(0)} / month + GST',
                        style: TextStyle(color: accent, fontWeight: FontWeight.w800, fontSize: 18),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: featured
                          ? const [Color(0xFF111827), Color(0xFFE6FF3C)]
                          : const [Color(0xFF0B0F19), Color(0xFFE6FF3C)],
                    ),
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Icon(
                    featured ? Icons.rocket_launch_rounded : Icons.wifi_rounded,
                    color: const Color(0xFFEFEEE8),
                    size: 30,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
              color: const Color(0xFFEFEEE8),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0x22E6FF3C)),
            ),
              child: Row(
                children: [
                  Expanded(child: _planMetric('${plan.speedMbps.toStringAsFixed(0)} Mbps', 'Speed')),
                  Expanded(child: _planMetric('Unlimited', 'Internet')),
                  Expanded(child: _planMetric(_isPremium(plan) ? 'OTT+' : 'Core', 'Benefits')),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _benefitChips(plan),
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => _previewPlan(context, appState, plan),
                    child: const Text('View details'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: appState.busy ? null : () => _applyPlan(context, appState, plan),
                    style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0B0F19)),
                    child: Text(isCurrent ? 'Change duration' : 'Select plan'),
                  ),
                ),
              ],
            ),
          ],
        ),
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
        Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(color: Color(0xFF6B7280))),
      ],
    );
  }

  List<Widget> _benefitChips(PlanItem plan) {
    final chips = <String>['Unlimited data', '${plan.speedMbps.toStringAsFixed(0)} Mbps class'];
    if (_isPremium(plan)) {
      chips.addAll(['OTT ready', 'Entertainment pack']);
    } else {
      chips.add('Smart broadband');
    }
    if (plan.otcCharge > 0) {
      chips.add('OTC Rs ${plan.otcCharge.toStringAsFixed(0)}');
    }
    return chips
        .map(
          (chip) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0x14E6FF3C),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0x66E6FF3C)),
            ),
            child: Text(chip, style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF0B0F19))),
          ),
        )
        .toList();
  }

  bool _isPremium(PlanItem plan) {
    final lower = plan.name.toLowerCase();
    return lower.contains('entertainment') ||
        lower.contains('ott') ||
        lower.contains('combo') ||
        plan.monthlyPrice >= 999 ||
        plan.speedMbps >= 200;
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
      backgroundColor: const Color(0xFF0B0F19),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(child: Container(width: 52, height: 6, decoration: BoxDecoration(color: const Color(0x22E6FF3C), borderRadius: BorderRadius.circular(99)))),
              const SizedBox(height: 18),
              Text(
                preview.nextPlanName,
                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 30, color: Color(0xFFEFEEE8)),
              ),
              const SizedBox(height: 10),
              Text(
                effectiveMode == 'next_cycle'
                    ? 'This switch will queue for the next billing cycle.'
                    : 'This switch applies with current-cycle adjustment rules.',
                style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.4),
              ),
              const SizedBox(height: 16),
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
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFE6FF3C),
                    foregroundColor: const Color(0xFF111111),
                  ),
                  child: const Text('Continue with this plan'),
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
          Text(label, style: const TextStyle(color: Color(0xFFD1D5DB))),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEFEEE8))),
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
    if (context.mounted) {
      await appState.refresh();
    }
  }
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFEFEEE8).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(color: const Color(0xFFEFEEE8), fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFFD1D5DB), fontSize: 12)),
        ],
      ),
    );
  }
}

