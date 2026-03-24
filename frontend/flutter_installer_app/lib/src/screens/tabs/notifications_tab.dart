import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../job_detail_screen.dart';
import '../../widgets/app_card.dart';

class NotificationsTab extends StatelessWidget {
  const NotificationsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final unreadCount = appState.notifications.where((item) => item.readAt == null).length;

    return RefreshIndicator(
      color: const Color(0xFF8224E3),
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
                  'ALERT CONSOLE',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF9CA3AF),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text('Installer alerts', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text(
                  appState.notifications.isEmpty
                      ? 'No active dispatch or provisioning alerts right now.'
                      : 'Track dispatch, activation, and system alerts from one queue.',
                  style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(child: _metricChip(context, label: 'Alerts', value: appState.notifications.length.toString())),
                    const SizedBox(width: 12),
                    Expanded(child: _metricChip(context, label: 'Unread', value: unreadCount.toString())),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (appState.notifications.isEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('No installer notifications right now.', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const Text(
                    'Pull down to refresh when new jobs, dispatch updates, or activation notices come in.',
                    style: TextStyle(color: Color(0xFF9CA3AF), height: 1.45),
                  ),
                ],
              ),
            )
          else
            ...appState.notifications.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(28),
                  onTap: () async {
                    await appState.markNotificationRead(item.id);
                    final jobId = item.payload['installerJobId']?.toString();
                    if (!context.mounted) return;
                    if (jobId != null && jobId.isNotEmpty) {
                      final matches = appState.jobs.where((candidate) => candidate.id == jobId).toList();
                      final job = matches.isEmpty ? null : matches.first;
                      if (job != null) {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => JobDetailScreen(job: job)),
                        );
                        await appState.refresh();
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Related job is not in the current queue. Refresh and try again.')),
                        );
                      }
                    }
                  },
                  child: AppCard(
                    color: item.readAt == null ? const Color(0xFF11161D) : const Color(0xFF0C1018),
                    borderColor: item.readAt == null ? const Color(0x558224E3) : const Color(0x228224E3),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(item.title, style: Theme.of(context).textTheme.titleMedium),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFF141A22),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: item.readAt == null ? const Color(0x558224E3) : const Color(0x221F2937)),
                              ),
                              child: Text(
                                item.readAt == null ? 'Unread' : 'Read',
                                style: TextStyle(
                                  color: item.readAt == null ? const Color(0xFF8224E3) : const Color(0xFF9CA3AF),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          item.body,
                          style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          _formatTime(item.createdAt),
                          style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _metricChip(BuildContext context, {required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF11161D),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x338224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: const Color(0xFFEFEEE8),
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
        ],
      ),
    );
  }

  String _formatTime(DateTime? time) {
    if (time == null) return 'Just now';
    final delta = DateTime.now().difference(time);
    if (delta.inMinutes < 1) return 'Just now';
    if (delta.inMinutes < 60) return '${delta.inMinutes}m ago';
    if (delta.inHours < 24) return '${delta.inHours}h ago';
    return '${delta.inDays}d ago';
  }
}
