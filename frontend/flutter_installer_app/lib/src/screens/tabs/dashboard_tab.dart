import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final dashboard = appState.dashboard;
    final profile = appState.profile;
    return RefreshIndicator(
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          Text('Field Dashboard', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 18),
          AppCard(
            gradient: const LinearGradient(colors: [Color(0xFF0A6F64), Color(0xFF1FD2A8)]),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(profile.fullName, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text('${profile.installerCode} · ${profile.phone}'),
                const SizedBox(height: 14),
                Text('Availability: ${dashboard.availabilityStatus}', style: const TextStyle(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _metric(context, 'New jobs', '${dashboard.todayNewInstallationJobs}')),
              const SizedBox(width: 12),
              Expanded(child: _metric(context, 'Pending', '${dashboard.pendingJobs}')),
            ],
          ),
          const SizedBox(height: 12),
          _metric(context, 'Completed', '${dashboard.completedJobs}'),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Today focus', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                const Text('1. Accept and close assigned installations quickly.'),
                const SizedBox(height: 8),
                const Text('2. Capture ONT serial accurately before activation.'),
                const SizedBox(height: 8),
                const Text('3. Run optical check and save checklist before activate.'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(BuildContext context, String label, String value) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}
