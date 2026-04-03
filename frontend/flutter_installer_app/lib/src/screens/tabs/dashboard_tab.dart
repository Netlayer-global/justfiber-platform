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
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 130),
        children: [
          Text('Field Dashboard', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 18),
          AppCard(
            gradient: const LinearGradient(colors: [Color(0xFF8126CF), Color(0xFFC284FF)]),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(profile.fullName, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
                const SizedBox(height: 8),
                Text('${profile.installerCode} - ${profile.phone}', style: const TextStyle(color: Colors.white70)),
                const SizedBox(height: 14),
                Text(
                  'Availability: ${dashboard.availabilityStatus}',
                  style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _Metric(context, label: 'New jobs', value: '${dashboard.todayNewInstallationJobs}')),
              const SizedBox(width: 12),
              Expanded(child: _Metric(context, label: 'Pending', value: '${dashboard.pendingJobs}')),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _Metric(context, label: 'Completed', value: '${dashboard.completedJobs}')),
              const SizedBox(width: 12),
              Expanded(child: _Metric(context, label: 'Status', value: dashboard.availabilityStatus)),
            ],
          ),
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
}

class _Metric extends StatelessWidget {
  const _Metric(this.context, {required this.label, required this.value});

  final BuildContext context;
  final String label;
  final String value;

  @override
  Widget build(BuildContext _) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}
