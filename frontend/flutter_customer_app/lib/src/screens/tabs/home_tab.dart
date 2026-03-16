import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';
import '../../widgets/usage_bar.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final wifi = appState.wifi;
    final billing = appState.billing;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Row(
          children: [
            Expanded(child: Text('QuotaPro', style: Theme.of(context).textTheme.titleLarge)),
            const CircleAvatar(radius: 20, backgroundColor: Color(0x332E364D), child: Icon(Icons.notifications_none_rounded)),
          ],
        ),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(colors: [Color(0xFF2A1A69), Color(0xFF6F3DFF)]),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(dashboard.customerName, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              Text('Rp. ${dashboard.walletBalance.toStringAsFixed(0)},-', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: Text(dashboard.planName, style: Theme.of(context).textTheme.bodyMedium)),
                  FilledButton(
                    onPressed: () {},
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF381D96),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('Top Up'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Text('Active Package', style: Theme.of(context).textTheme.titleMedium),
            const Spacer(),
            TextButton(onPressed: () {}, child: const Text('See All')),
          ],
        ),
        Row(
          children: [
            Expanded(
              child: AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.wifi_rounded, color: Color(0xFF7A83A8)),
                    const SizedBox(height: 10),
                    Text('${dashboard.usedGb.toStringAsFixed(0)}GB', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    UsageBar(progress: dashboard.usedGb / dashboard.totalGb),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 72,
              child: AppCard(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.call_rounded),
                    const SizedBox(height: 10),
                    Text('${dashboard.activeDays} Days', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        Text('Features', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 14),
        GridView.count(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          crossAxisCount: 4,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          children: [
            _feature(context, Icons.receipt_long_rounded, 'Bills'),
            _feature(context, Icons.wifi_find_rounded, 'Internet'),
            _feature(context, Icons.add_circle_rounded, 'Add On'),
            _feature(context, Icons.stars_rounded, 'Points'),
            _feature(context, Icons.discount_rounded, 'Discount'),
            _feature(context, Icons.support_agent_rounded, 'Support'),
            _feature(context, Icons.videogame_asset_rounded, 'Games'),
            _feature(context, Icons.more_horiz_rounded, 'Other'),
          ],
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Live connection', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              _infoRow('Wi-Fi 2.4G', wifi.ssid24),
              _infoRow('Wi-Fi 5G', wifi.ssid5),
              _infoRow('Plan', billing.currentPlan),
              _infoRow('Next bill', billing.nextBillDate),
              _infoRow('Due amount', 'Rp. ${billing.dueAmount.toStringAsFixed(0)}'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _feature(BuildContext context, IconData icon, String label) {
    return Column(
      children: [
        Container(
          height: 54,
          width: 54,
          decoration: BoxDecoration(
            color: const Color(0xFF1A2140),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Icon(icon, color: const Color(0xFF7C87FF)),
        ),
        const SizedBox(height: 8),
        Text(label, style: Theme.of(context).textTheme.labelMedium, textAlign: TextAlign.center),
      ],
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFFA3A9C2))),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
