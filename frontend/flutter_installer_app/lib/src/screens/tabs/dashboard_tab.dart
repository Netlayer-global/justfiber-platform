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
                Row(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: const Color(0x26FFFFFF),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x36FFFFFF)),
                      ),
                      child: const Icon(Icons.dashboard_customize_rounded, color: Colors.white, size: 28),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0x1FFFFFFF),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0x2CFFFFFF)),
                      ),
                      child: Text(
                        dashboard.availabilityStatus,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
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
                  style: const TextStyle(color: Color(0xFFF3E8FF), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0x26FFFFFF),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x40FFFFFF)),
                  ),
                  child: Text(
                    'Availability active',
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
                Row(
                  children: [
                    Text('Today focus', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: const Color(0xFF131313))),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F4FF),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0x228224E3)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.track_changes_rounded, size: 14, color: Color(0xFF8224E3)),
                          SizedBox(width: 6),
                          Text(
                            'Field discipline',
                            style: TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _focusRow('1', 'Accept assigned jobs immediately.'),
                _focusRow('2', 'Capture correct ONT serial before activation.'),
                _focusRow('3', 'Finish optical check and checklist before closing the job.'),
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
          Text(label, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFF6E6A67))),
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }

  Widget _focusRow(String index, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFFF8F4FF),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0x228224E3)),
            ),
            child: Text(
              index,
              style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                text,
                style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
              ),
            ),
          ),
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
