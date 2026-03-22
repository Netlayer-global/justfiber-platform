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
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Hi, $displayName', style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 6),
                  Text(
                    hasService
                        ? 'See your live service status, due amount, and request tracking from one dashboard.'
                        : 'Check availability, select a plan, and create a new broadband booking.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            CircleAvatar(
              radius: 24,
              backgroundColor: Colors.white,
              child: IconButton(
                icon: const Icon(Icons.support_agent_rounded, color: Color(0xFF1F2937)),
                onPressed: () => onNavigate(3),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFFFFF4F4), Color(0xFFF4F3FF)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Broadband made simple',
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Color(0xFF16171D)),
              ),
              const SizedBox(height: 10),
              Text(
                hasService ? '$planName | $wifiName' : 'Check availability, choose a plan, and book your connection.',
                style: const TextStyle(color: Color(0xFF4B5563), height: 1.45),
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
                      child: Text(hasService ? 'Open Services' : 'Book Connection'),
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
                      child: Text(hasService ? 'Open Billing' : 'Track Request'),
                    ),
                  ),
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
        const SizedBox(height: 18),
        if (billing.dueAmount > 0)
          AppCard(
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
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Text('DUE', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF92400E))),
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
        if (billing.dueAmount > 0) const SizedBox(height: 18),
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
              _infoRow('Service state', hasService ? (wifi.paused ? 'Paused' : 'Active') : 'Not active'),
              if (billing.pendingPlanChange != null) _infoRow('Pending plan change', billing.pendingPlanChange!.planName),
            ],
          ),
        ),
        if (latestBooking != null) ...[
          const SizedBox(height: 18),
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFEFF6FF), Color(0xFFF5F3FF)],
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
                _infoRow('Current step', latestBooking.currentStep),
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFF1EEFF),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: const Color(0xFF20242E)),
            ),
            const SizedBox(height: 16),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
            const SizedBox(height: 6),
            Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280), height: 1.35)),
          ],
        ),
      ),
    );
  }

  Widget _metricPill(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF16171D)),
          children: [
            TextSpan(text: '$value ', style: const TextStyle(fontWeight: FontWeight.w800)),
            TextSpan(text: label, style: const TextStyle(color: Color(0xFF6B7280))),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
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
              style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF16171D)),
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
