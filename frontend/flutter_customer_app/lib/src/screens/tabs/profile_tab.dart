import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final dashboard = appState.dashboard;
    final wifi = appState.wifi;
    final theme = Theme.of(context);

    return RefreshIndicator(
      color: const Color(0xFF8224E3),
      backgroundColor: const Color(0xFF121212),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFF0B0F19), Color(0xFF111827)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ACCOUNT CONSOLE',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: const Color(0xFFA1A1AA),
                    letterSpacing: 3.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  dashboard.customerName.isEmpty ? 'Customer account' : dashboard.customerName,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFFEFEEE8),
                    fontSize: 28,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  appState.session?.mobile ?? '-',
                  style: const TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(
                  'Your account console for connection, billing, and registered service details.',
                  style: theme.textTheme.bodyMedium?.copyWith(color: const Color(0xFFCBD5E1)),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _topMetric('Plan', billing.currentPlan.isEmpty ? '-' : billing.currentPlan)),
                    const SizedBox(width: 10),
                    Expanded(child: _topMetric('Mode', billing.billMode.isEmpty ? '-' : billing.billMode)),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _topMetric('Due', 'Rs ${billing.dueAmount.toStringAsFixed(0)}')),
                    const SizedBox(width: 10),
                    Expanded(child: _topMetric('Devices', '${wifi.connectedDevicesCount} online')),
                  ],
                ),
              ],
            ),
          ),
        const SizedBox(height: 18),
        _sectionCard(
          title: 'Account information',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _row('Customer name', dashboard.customerName.isEmpty ? '-' : dashboard.customerName),
              _row('Registered mobile', appState.session?.mobile ?? '-'),
              _row('Connection name', dashboard.wifiName.isEmpty ? '-' : dashboard.wifiName),
              _row('Current plan', billing.currentPlan.isEmpty ? '-' : billing.currentPlan),
              _row('Billing mode', billing.billMode.isEmpty ? '-' : billing.billMode),
              _row('Wi-Fi name', wifi.ssid24.isEmpty ? '-' : wifi.ssid24),
              _row('Connected devices', '${wifi.connectedDevicesCount}'),
            ],
          ),
        ),
        const SizedBox(height: 18),
        _sectionCard(
          title: 'Account status',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _row('Payment status', billing.paymentStatus.isEmpty ? '-' : billing.paymentStatus),
              _row('Due amount', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
              _row('Next bill date', billing.nextBillDate.isEmpty ? '-' : billing.nextBillDate),
              _row('Last payment date', billing.lastPaymentDate.isEmpty ? '-' : billing.lastPaymentDate),
              _row('Last payment amount', 'Rs ${billing.lastPaymentAmount.toStringAsFixed(0)}'),
              _row('Current bill cycle', billing.billCycle.isEmpty ? '-' : billing.billCycle),
              _row('Loyalty points', '${dashboard.points}'),
              _row('Active days', '${dashboard.activeDays}'),
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
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF8224E3),
            foregroundColor: const Color(0xFFEFEEE8),
          ),
          child: const Text('Logout'),
        ),
        ],
      ),
    );
  }

  Widget _topMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF12161A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x668224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, color: const Color(0xFFEFEEE8))),
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

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF12161A),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0x228224E3)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(color: Color(0xFFA1A1AA), fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 12),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEFEEE8)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

