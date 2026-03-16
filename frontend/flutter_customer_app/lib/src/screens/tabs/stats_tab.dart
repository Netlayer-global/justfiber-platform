import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';
import '../../widgets/stat_bar_chart.dart';

class StatsTab extends StatelessWidget {
  const StatsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Text('Statistic', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        const AppCard(child: SizedBox(height: 260, child: StatBarChart())),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            children: [
              _appUsage(context, 'Instagram', '1GB', 0.62, Icons.camera_alt_rounded),
              const SizedBox(height: 16),
              _appUsage(context, 'Youtube', '4GB', 0.84, Icons.play_circle_fill_rounded),
              const SizedBox(height: 16),
              _appUsage(context, 'Wi-Fi', '${dashboard.usedGb.toStringAsFixed(0)}GB', dashboard.usedGb / dashboard.totalGb, Icons.wifi_rounded),
            ],
          ),
        ),
      ],
    );
  }

  Widget _appUsage(BuildContext context, String title, String amount, double value, IconData icon) {
    return Column(
      children: [
        Row(
          children: [
            CircleAvatar(backgroundColor: const Color(0xFF231C48), child: Icon(icon, color: const Color(0xFFB78BFF))),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: Theme.of(context).textTheme.titleMedium)),
            Text(amount),
          ],
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: value,
          minHeight: 7,
          backgroundColor: const Color(0xFF2A314D),
          color: const Color(0xFFEF5DA8),
          borderRadius: BorderRadius.circular(99),
        ),
      ],
    );
  }
}
