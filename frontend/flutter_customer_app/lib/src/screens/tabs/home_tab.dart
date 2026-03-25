import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';
import '../billing_payment_screen.dart';
import '../booking_flow_screen.dart';
import '../plan_catalog_screen.dart';
import '../service_tracking_screen.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.onNavigate});

  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final billing = appState.billing;
    final wifi = appState.wifi;
    final latestBooking = appState.latestBooking;
    final displayName = dashboard.customerName.isEmpty ? 'JustFiber Customer' : dashboard.customerName;
    final planName = billing.currentPlan.isNotEmpty ? billing.currentPlan : (dashboard.planName.isNotEmpty ? dashboard.planName : 'No active plan yet');
    final wifiName = wifi.ssid24.isNotEmpty ? wifi.ssid24 : (dashboard.wifiName.isNotEmpty ? dashboard.wifiName : 'Wi-Fi not configured');
    final hasService = billing.currentPlan.isNotEmpty || wifi.ssid24.isNotEmpty || dashboard.planName.isNotEmpty;
    final usageGb = billing.usageGb > 0 ? billing.usageGb : dashboard.usedGb;
    final usageCapGb = billing.usageCapGb > 0 ? billing.usageCapGb : dashboard.totalGb;
    final double usagePercent = usageCapGb > 0 ? (usageGb / usageCapGb).clamp(0.0, 1.0).toDouble() : 0.0;
    final hasUsagePressure = billing.usageCapReached || (usageCapGb > 0 && usagePercent >= 0.65);
    final showUpgradePrompt = hasService && hasUsagePressure;

    return RefreshIndicator(
      color: const Color(0xFF8224E3),
      backgroundColor: const Color(0xFFFFFFFF),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: const Color(0x338224E3)),
            boxShadow: const [
              BoxShadow(color: Color(0x308224E3), blurRadius: 26, offset: Offset(0, 12)),
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
                        Text(
                          'CUSTOMER DASHBOARD',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: const Color(0xFFE9D5FF),
                                letterSpacing: 3.2,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Hi, $displayName',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                color: const Color(0xFFF7F7F8),
                                fontSize: 30,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          hasService
                              ? 'Monitor your broadband, due amount, and active requests from one clean control surface.'
                              : 'Check feasibility, pick a plan, and start your broadband booking in a few steps.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: const Color(0xFFD6D3D1),
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _metricPill('Due', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
                  _metricPill('Status', hasService ? (wifi.paused ? 'Paused' : 'Active') : 'No service'),
                  _metricPill('Devices', '${wifi.connectedDevicesCount}'),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: hasService
                          ? () => onNavigate(1)
                          : () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const BookingFlowScreen()),
                              );
                              if (context.mounted) {
                                await appState.refresh();
                              }
                            },
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                      ),
                      child: Text(hasService ? 'Open services' : 'Book connection'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: hasService
                          ? (appState.busy ? null : () => _payBill(context, appState))
                          : () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                              );
                              if (context.mounted) {
                                await appState.refresh();
                              }
                            },
                      child: Text(hasService ? 'Pay bill' : 'Track request'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const BookingFlowScreen()),
                    );
                    if (context.mounted) {
                      await appState.refresh();
                    }
                  },
                  icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFFFFFFFF)),
                  label: const Text(
                    'Book new connection',
                    style: TextStyle(color: Color(0xFFFFFFFF), fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _lightPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Live connection snapshot',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF131313)),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: hasService ? const Color(0x148224E3) : const Color(0x120B0F19),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: hasService ? const Color(0x668224E3) : const Color(0x1A0B0F19),
                      ),
                    ),
                    child: Text(
                      hasService ? 'ACTIVE' : 'NEW',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: hasService ? const Color(0xFF8224E3) : const Color(0xFFCBD5E1),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                hasService ? '$planName | $wifiName' : 'No active connection yet. Start with a new booking.',
                style: const TextStyle(color: Color(0xFF9CA3AF), height: 1.45),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(child: _summaryBox('Current plan', planName)),
                  const SizedBox(width: 10),
                  Expanded(child: _summaryBox('Wi-Fi name', wifiName)),
                ],
              ),
              if (usageCapGb > 0 || billing.dataPolicy != 'unlimited') ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: billing.usageCapReached ? const Color(0x55FF6B6B) : const Color(0x228224E3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Usage meter',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313)),
                            ),
                          ),
                          Text(
                            billing.dataPolicy == 'unlimited' ? 'LIVE' : billing.dataPolicy.toUpperCase(),
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: billing.usageCapReached ? const Color(0xFFFF8A8A) : const Color(0xFF8224E3),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        usageCapGb > 0
                            ? '${usageGb.toStringAsFixed(2)} GB of ${usageCapGb.toStringAsFixed(0)} GB used'
                            : 'Unlimited usage policy active',
                        style: const TextStyle(color: Color(0xFF9CA3AF), height: 1.4),
                      ),
                      if (usageCapGb > 0) ...[
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: usagePercent,
                            minHeight: 10,
                            backgroundColor: const Color(0xFF26282D),
                            valueColor: AlwaysStoppedAnimation<Color>(
                              billing.usageCapReached ? const Color(0xFFFF6B6B) : const Color(0xFF8224E3),
                            ),
                          ),
                        ),
                      ],
                      if (billing.fupSpeedMbps > 0 || billing.usageCapReached) ...[
                        const SizedBox(height: 10),
                        Text(
                          billing.usageCapReached
                              ? (billing.dataPolicy == 'fup'
                                  ? 'FUP active at ${billing.fupSpeedMbps.toStringAsFixed(0)} Mbps'
                                  : 'Hard-cap policy active')
                              : 'Base plan speed active',
                          style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700),
                        ),
                      ],
                      if (showUpgradePrompt) ...[
                        const SizedBox(height: 14),
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
                                child: Text(billing.usageCapReached ? 'Upgrade plan now' : 'Explore faster plans'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        _sectionTitle(context, 'Primary sections'),
        const SizedBox(height: 10),
        _navCard(
          icon: Icons.router_outlined,
          title: 'Services',
          subtitle: 'Wi-Fi settings, diagnostics, devices, shift connection, and plan controls',
          onTap: () => onNavigate(1),
        ),
        const SizedBox(height: 12),
        _navCard(
          icon: Icons.receipt_long_rounded,
          title: 'Billing',
          subtitle: 'Bills, invoices, receipts, payment history, and dues',
          onTap: () => onNavigate(2),
        ),
        const SizedBox(height: 12),
        _navCard(
          icon: Icons.support_agent_rounded,
          title: 'Support',
          subtitle: 'Complaints, service requests, notifications, and help',
          onTap: () => onNavigate(3),
        ),
        if (billing.dueAmount > 0) ...[
          const SizedBox(height: 18),
          _lightPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Payment due', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0x148224E3),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0x668224E3)),
                    ),
                    child: const Text('DUE', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF8224E3))),
                  ),
                ],
              ),
                const SizedBox(height: 10),
                Text(
                  billing.pendingPlanChange != null
                      ? 'Pay Rs ${billing.dueAmount.toStringAsFixed(0)} to complete your pending plan switch.'
                      : 'Pay Rs ${billing.dueAmount.toStringAsFixed(0)} before ${billing.nextBillDate} to avoid interruption.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: appState.busy ? null : () => _payBill(context, appState),
                        child: Text(billing.pendingPlanChange != null ? 'Pay to switch' : 'Pay now'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(onPressed: () => onNavigate(2), child: const Text('Open billing')),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 18),
        _lightPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Service summary', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
              const SizedBox(height: 14),
              _infoRow('Current plan', planName),
              _infoRow('Wi-Fi name', wifiName),
              _infoRow('Next bill date', billing.nextBillDate.isEmpty ? '-' : billing.nextBillDate),
              _infoRow('Connected devices', '${wifi.connectedDevicesCount}'),
              _infoRow('Service state', hasService ? (wifi.paused ? 'Paused' : 'Active') : 'Not active', highlight: true),
              if (billing.pendingPlanChange != null) _infoRow('Pending plan change', billing.pendingPlanChange!.planName),
            ],
          ),
        ),
        if (latestBooking != null) ...[
          const SizedBox(height: 18),
          _lightPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Latest booking', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                const SizedBox(height: 12),
                _infoRow('Booking number', latestBooking.bookingNumber),
                _infoRow('Plan', latestBooking.planName),
                _infoRow('Amount', 'Rs ${latestBooking.amount.toStringAsFixed(0)}'),
                _infoRow('Current step', latestBooking.currentStep, highlight: true),
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                    );
                    if (context.mounted) {
                      await appState.refresh();
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                  ),
                  child: const Text('Track booking'),
                ),
              ],
            ),
          ),
        ],
        ],
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'CONTROL MODULES',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: const Color(0xFF9CA3AF),
                letterSpacing: 3,
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 6),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: const Color(0xFF131313),
                fontWeight: FontWeight.w800,
              ),
        ),
      ],
    );
  }

  Widget _summaryBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFF8F4FF), Color(0xFFFFFFFF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _navCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(28),
      onTap: onTap,
      child: AppCard(
        color: const Color(0xFFFFFFFF),
        borderColor: const Color(0x228224E3),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFF8F4FF),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: const Color(0xFF8224E3)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
                  const SizedBox(height: 6),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6E6A67), height: 1.35)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Color(0xFF8224E3)),
          ],
        ),
      ),
    );
  }

  Widget _metricPill(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0x26FFFFFF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x40FFFFFF)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFFFFFFFF)),
          children: [
            TextSpan(text: '$value ', style: const TextStyle(fontWeight: FontWeight.w800)),
            TextSpan(text: label, style: const TextStyle(color: Color(0xFFE9D5FF))),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0x228224E3)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: highlight ? const Color(0xFF8224E3) : const Color(0xFF131313),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _lightPanel({required Widget child}) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      padding: const EdgeInsets.all(20),
      child: child,
    );
  }

  Future<void> _payBill(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    final paymentOrder = await appState.loadBillingPaymentOrder(amount: appState.billing.dueAmount);
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
}





