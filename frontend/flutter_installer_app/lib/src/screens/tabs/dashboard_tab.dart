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
      color: const Color(0xFFE6FF3C),
      backgroundColor: const Color(0xFF0C1018),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF090D15), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'FIELD DASHBOARD',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF9CA3AF),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  profile.fullName.isEmpty ? 'Installer console' : profile.fullName,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  '${profile.installerCode.isEmpty ? '-' : profile.installerCode} · ${profile.phone.isEmpty ? '-' : profile.phone}',
                  style: const TextStyle(color: Color(0xFFD1D5DB)),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10151A),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x55E6FF3C)),
                  ),
                  child: Text(
                    'Availability: ${dashboard.availabilityStatus}',
                    style: const TextStyle(color: Color(0xFFE6FF3C), fontWeight: FontWeight.w700),
                  ),
                ),
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
            color: const Color(0xFF0C1018),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Today focus', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: const Color(0xFFEFEEE8))),
                const SizedBox(height: 12),
                const Text('1. Accept assigned jobs immediately.', style: TextStyle(color: Color(0xFFD1D5DB))),
                const SizedBox(height: 8),
                const Text('2. Capture correct ONT serial before activation.', style: TextStyle(color: Color(0xFFD1D5DB))),
                const SizedBox(height: 8),
                const Text('3. Finish optical check and checklist before closing the job.', style: TextStyle(color: Color(0xFFD1D5DB))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(BuildContext context, String label, String value) {
    return AppCard(
      color: const Color(0xFF0C1018),
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
