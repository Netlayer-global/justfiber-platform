import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';
import '../billing_payment_screen.dart';
import '../booking_flow_screen.dart';
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

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0B0F19), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(32),
            boxShadow: const [
              BoxShadow(color: Color(0x26030B14), blurRadius: 26, offset: Offset(0, 12)),
            ],
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
                        Text(
                          'Hi, $displayName',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Colors.white),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          hasService
                              ? 'Monitor your broadband, due amount, and active requests from one control surface.'
                              : 'Check feasibility, select a plan, and create your broadband booking.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFFD1D5DB)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      color: const Color(0x1400F5D4),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0x6600F5D4)),
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.support_agent_rounded, color: Color(0xFF00F5D4)),
                      onPressed: () => onNavigate(3),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _metricPill('Due', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
                  _metricPill('Status', hasService ? (wifi.paused ? 'Paused' : 'Active') : 'No service'),
                  _metricPill('Devices', '${wifi.connectedDevicesCount}'),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: hasService
                          ? () => onNavigate(1)
                          : () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const BookingFlowScreen()),
                              ),
                      child: Text(hasService ? 'Open services' : 'Book connection'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: hasService
                          ? () => onNavigate(2)
                          : () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                              ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0x5500F5D4)),
                      ),
                      child: Text(hasService ? 'Open billing' : 'Track request'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFFFFFFFF), Color(0xFFF2FFFC)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Live connection snapshot', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF05070D))),
              const SizedBox(height: 10),
              Text(
                hasService ? '$planName | $wifiName' : 'No active connection yet. Start with a new booking.',
                style: const TextStyle(color: Color(0xFF64748B), height: 1.45),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(child: _summaryBox('Current plan', planName)),
                  const SizedBox(width: 10),
                  Expanded(child: _summaryBox('Wi-Fi name', wifiName)),
                ],
              ),
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
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFFFFFFF), Color(0xFFF7FFFE)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
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
                        color: const Color(0x1400F5D4),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0x6600F5D4)),
                      ),
                      child: const Text('DUE', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF0B0F19))),
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
        AppCard(
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
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFFFFFFF), Color(0xFFF1F5FF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
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
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                  ),
                  child: const Text('Track booking'),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Text(title, style: Theme.of(context).textTheme.titleLarge);
  }

  Widget _summaryBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0B0F19),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
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
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: const Color(0xFF0B0F19),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: const Color(0xFF00F5D4)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                  const SizedBox(height: 6),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF64748B), height: 1.35)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
          ],
        ),
      ),
    );
  }

  Widget _metricPill(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF0B0F19),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x3300F5D4)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Colors.white),
          children: [
            TextSpan(text: '$value ', style: const TextStyle(fontWeight: FontWeight.w800)),
            TextSpan(text: label, style: const TextStyle(color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF64748B))),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: highlight ? const Color(0xFF00C2FF) : const Color(0xFF05070D),
              ),
            ),
          ),
        ],
      ),
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
  }
}
