import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final dashboard = appState.dashboard;
    final profile = appState.profile;
    final todayJobs = appState.jobs.where(_isTodayJob).where((job) => job.status != 'completed').length;
    final pendingJobs = appState.jobs.where((job) => !_isTodayJob(job) && job.status != 'completed').length;
    final completedJobs = appState.jobs.where((job) => job.status == 'completed').length;
    return RefreshIndicator(
      color: const Color(0xFF8224E3),
      backgroundColor: const Color(0xFFF7F8FC),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'FIELD DASHBOARD',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFFE9D5FF),
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
                  '${profile.installerCode.isEmpty ? '-' : profile.installerCode} Ã¢â‚¬Â¢ ${profile.phone.isEmpty ? '-' : profile.phone}',
                  style: const TextStyle(color: Color(0xFFD1D5DB)),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0x26FFFFFF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x40FFFFFF)),
                  ),
                  child: Text(
                    'Availability: ${dashboard.availabilityStatus}',
                    style: const TextStyle(color: Color(0xFFFFFFFF), fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _metric(context, 'Today', '$todayJobs')),
              const SizedBox(width: 12),
              Expanded(child: _metric(context, 'Pending', '$pendingJobs')),
            ],
          ),
          const SizedBox(height: 12),
          _metric(context, 'Completed', '$completedJobs'),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x228224E3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Today focus', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: const Color(0xFF131313))),
                const SizedBox(height: 12),
                const Text('1. Accept assigned jobs immediately.', style: TextStyle(color: Color(0xFF6E6A67))),
                const SizedBox(height: 8),
                const Text('2. Capture correct ONT serial before activation.', style: TextStyle(color: Color(0xFF6E6A67))),
                const SizedBox(height: 8),
                const Text('3. Finish optical check and checklist before closing the job.', style: TextStyle(color: Color(0xFF6E6A67))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metric(BuildContext context, String label, String value) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
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

  bool _isTodayJob(InstallerJob job) {
    if (job.scheduledAt.isEmpty) return false;
    final parsed = DateTime.tryParse(job.scheduledAt)?.toLocal();
    if (parsed == null) return false;
    final now = DateTime.now();
    return parsed.year == now.year && parsed.month == now.month && parsed.day == now.day;
  }
}
