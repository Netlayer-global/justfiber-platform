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
    final todayJobs = appState.jobs.where(_isTodayJob).where((job) => job.status != 'completed' && job.status != 'deferred').length;
    final pendingJobs = appState.jobs.where((job) => !_isTodayJob(job) && job.status != 'completed' && job.status != 'deferred').length;
    final completedJobs = appState.jobs.where((job) => job.status == 'completed').length;
    final deferredJobs = appState.jobs.where((job) => job.status == 'deferred').length;

    return RefreshIndicator(
      color: const Color(0xFF2563EB),
      backgroundColor: const Color(0xFFF7F8FC),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x140F172A),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x140F172A)),
                      ),
                      child: const Icon(Icons.dashboard_customize_rounded, color: Color(0xFF2563EB), size: 28),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0x5534D399)),
                      ),
                      child: Text(
                        dashboard.availabilityStatus,
                        style: const TextStyle(color: Color(0xFF166534), fontWeight: FontWeight.w700, fontSize: 12),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  'FIELD DASHBOARD',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF2563EB),
                        letterSpacing: 2.6,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  profile.fullName.isEmpty ? 'Installer console' : profile.fullName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: const Color(0xFF131313)),
                ),
                const SizedBox(height: 8),
                Text(
                  '${profile.installerCode.isEmpty ? '-' : profile.installerCode} | ${profile.phone.isEmpty ? '-' : profile.phone}',
                  style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0x140F172A)),
                  ),
                  child: const Text(
                    'Availability active',
                    style: TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w700),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _miniSummary('New installs', '${dashboard.todayNewInstallationJobs}')),
                    const SizedBox(width: 10),
                    Expanded(child: _miniSummary('Queue total', '${dashboard.pendingJobs}')),
                  ],
                ),
                const SizedBox(height: 10),
                _miniSummary('Follow-up required', '$deferredJobs'),
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
          _metric(context, 'Follow-up', '$deferredJobs'),
          const SizedBox(height: 12),
          _metric(context, 'Completed', '$completedJobs'),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x140F172A),
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
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0x140F172A)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.track_changes_rounded, size: 14, color: Color(0xFF2563EB)),
                          SizedBox(width: 6),
                          Text(
                            'Field discipline',
                            style: TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w700, fontSize: 12),
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
      borderColor: const Color(0x140F172A),
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

  Widget _miniSummary(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x140F172A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800)),
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
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0xFFBFDBFE)),
            ),
            child: Text(
              index,
              style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w800),
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
