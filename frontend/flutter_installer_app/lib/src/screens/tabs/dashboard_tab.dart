import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({
    super.key,
    this.onOpenJobs,
    this.onOpenAlerts,
    this.onOpenProfile,
  });

  final VoidCallback? onOpenJobs;
  final VoidCallback? onOpenAlerts;
  final VoidCallback? onOpenProfile;

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final dashboard = appState.dashboard;
    final profile = appState.profile;
    final nextVisit = _nextVisitJob(appState.jobs);
    final todayJobs = appState.jobs.where(_isTodayJob).where((job) => job.status != 'completed' && job.status != 'deferred').length;
    final pendingJobs = appState.jobs.where((job) => !_isTodayJob(job) && job.status != 'completed' && job.status != 'deferred').length;
    final completedJobs = appState.jobs.where((job) => job.status == 'completed').length;
    final deferredJobs = appState.jobs.where((job) => job.status == 'deferred').length;

    return RefreshIndicator(
      color: const Color(0xFF8224E3),
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
                      child: const Icon(Icons.dashboard_customize_rounded, color: Color(0xFF8224E3), size: 28),
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
                        color: const Color(0xFF8224E3),
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
                    style: TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700),
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
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x228224E3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Next visit', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: const Color(0xFF131313))),
                    const Spacer(),
                    if (nextVisit != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8F4FF),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: const Color(0x558224E3)),
                        ),
                        child: Text(
                          _visitWindow(nextVisit),
                          style: const TextStyle(
                            color: Color(0xFF8224E3),
                            fontWeight: FontWeight.w800,
                            fontSize: 11,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                if (nextVisit == null)
                  const Text(
                    'No upcoming active site visit is scheduled right now.',
                    style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                  )
                else ...[
                  Text(
                    nextVisit.customerName.isEmpty ? 'Customer visit' : nextVisit.customerName,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(color: const Color(0xFF131313)),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    nextVisit.customerAddress.isEmpty ? 'Address unavailable' : nextVisit.customerAddress,
                    style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _miniSummary('Job', nextVisit.jobNumber),
                      _miniSummary('Priority', nextVisit.priority.isEmpty ? '-' : nextVisit.priority),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      if (nextVisit.customerPhone.isNotEmpty)
                        OutlinedButton.icon(
                          onPressed: () => _openCall(context, nextVisit.customerPhone),
                          icon: const Icon(Icons.call_outlined),
                          label: const Text('Call customer'),
                        ),
                      OutlinedButton.icon(
                        onPressed: () => _copyVisitPack(context, nextVisit),
                        icon: const Icon(Icons.copy_all_rounded),
                        label: const Text('Copy visit pack'),
                      ),
                      if (nextVisit.customerAddress.isNotEmpty)
                        OutlinedButton.icon(
                          onPressed: () => _copyAddress(context, nextVisit.customerAddress),
                          icon: const Icon(Icons.content_copy_rounded),
                          label: const Text('Copy address'),
                        ),
                      if (nextVisit.mapUrl.isNotEmpty || (nextVisit.latitude != null && nextVisit.longitude != null))
                        OutlinedButton.icon(
                          onPressed: () => _openMap(context, nextVisit),
                          icon: const Icon(Icons.map_outlined),
                          label: const Text('Open map'),
                        ),
                      OutlinedButton.icon(
                        onPressed: onOpenJobs,
                        icon: const Icon(Icons.assignment_rounded),
                        label: const Text('Open jobs queue'),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x228224E3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Quick actions', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: const Color(0xFF131313))),
                const SizedBox(height: 8),
                const Text(
                  'Jump straight to the screen that needs attention right now.',
                  style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton.icon(
                      onPressed: onOpenJobs,
                      icon: const Icon(Icons.assignment_rounded),
                      label: Text(todayJobs > 0 ? 'Open jobs ($todayJobs)' : 'Open jobs'),
                    ),
                    OutlinedButton.icon(
                      onPressed: onOpenAlerts,
                      icon: const Icon(Icons.notifications_active_outlined),
                      label: const Text('Review alerts'),
                    ),
                    OutlinedButton.icon(
                      onPressed: onOpenProfile,
                      icon: const Icon(Icons.person_outline_rounded),
                      label: const Text('Profile & leave'),
                    ),
                  ],
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
              border: Border.all(color: const Color(0xFFD8B4FE)),
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

  InstallerJob? _nextVisitJob(List<InstallerJob> jobs) {
    final candidates = jobs.where((job) => job.status != 'completed' && job.status != 'deferred').toList();
    candidates.sort((a, b) {
      final aTime = DateTime.tryParse(a.scheduledAt)?.toLocal();
      final bTime = DateTime.tryParse(b.scheduledAt)?.toLocal();
      if (aTime == null && bTime == null) return 0;
      if (aTime == null) return 1;
      if (bTime == null) return -1;
      return aTime.compareTo(bTime);
    });
    return candidates.isEmpty ? null : candidates.first;
  }

  String _visitWindow(InstallerJob job) {
    final parsed = DateTime.tryParse(job.scheduledAt)?.toLocal();
    if (parsed == null) return 'Schedule pending';
    final now = DateTime.now();
    final diff = parsed.difference(now);
    if (diff.inMinutes.abs() < 1) return 'Due now';
    if (diff.isNegative) return '${diff.inMinutes.abs()} min late';
    if (diff.inHours < 1) return 'In ${diff.inMinutes} min';
    return 'At ${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
  }

  Future<void> _openMap(BuildContext context, InstallerJob job) async {
    final url = job.mapUrl.isNotEmpty
        ? job.mapUrl
        : 'https://maps.google.com/?q=${job.latitude},${job.longitude}';
    final uri = Uri.tryParse(url);
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location link is not available right now.')),
      );
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open job location right now.')),
      );
    }
  }

  Future<void> _openCall(BuildContext context, String phone) async {
    final uri = Uri.tryParse('tel:$phone');
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer phone is not available right now.')),
      );
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open dialer right now.')),
      );
    }
  }

  Future<void> _copyAddress(BuildContext context, String address) async {
    await Clipboard.setData(ClipboardData(text: address));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Customer address copied')),
    );
  }

  Future<void> _copyVisitPack(BuildContext context, InstallerJob job) async {
    final visitPack = <String>[
      'Customer: ${job.customerName.isEmpty ? '-' : job.customerName}',
      'Phone: ${job.customerPhone.isEmpty ? '-' : job.customerPhone}',
      'Address: ${job.customerAddress.isEmpty ? '-' : job.customerAddress}',
      'Job number: ${job.jobNumber}',
      'Priority: ${job.priority.isEmpty ? '-' : job.priority}',
    ].join('\n');
    await Clipboard.setData(ClipboardData(text: visitPack));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Visit pack copied')),
    );
  }
}
