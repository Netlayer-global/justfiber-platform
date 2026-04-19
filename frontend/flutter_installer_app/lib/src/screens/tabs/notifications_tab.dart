import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../job_detail_screen.dart';
import '../../widgets/app_card.dart';

class NotificationsTab extends StatefulWidget {
  const NotificationsTab({
    super.key,
    this.onOpenJobs,
    this.onOpenDashboard,
  });

  final VoidCallback? onOpenJobs;
  final VoidCallback? onOpenDashboard;

  @override
  State<NotificationsTab> createState() => _NotificationsTabState();
}

class _NotificationsTabState extends State<NotificationsTab> {
  String _filter = 'all';

  Future<void> _markAllRead(
      BuildContext context, InstallerAppState appState) async {
    final ok = await appState.markAllNotificationsRead();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? 'All alerts marked as read'
              : (appState.error ?? 'Unable to mark alerts as read'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final unreadCount =
        appState.notifications.where((item) => item.readAt == null).length;
    final jobLinkedCount = appState.notifications
        .where((item) =>
            (item.payload['installerJobId'] ?? '').toString().isNotEmpty)
        .length;
    final hasFilters = _filter != 'all';
    final filteredNotifications = appState.notifications.where((item) {
      return switch (_filter) {
        'unread' => item.readAt == null,
        'job' => (item.payload['installerJobId'] ?? '').toString().isNotEmpty,
        _ => true,
      };
    }).toList();

    return RefreshIndicator(
      color: kPrimaryLight,
      backgroundColor: kSurface,
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          AppCard(
            color: kSurface,
            borderColor: kBorder,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: kSurface2,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: kBorder),
                      ),
                      child: const Icon(Icons.notifications_active_rounded,
                          color: kPrimaryLight, size: 28),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: kSurface2,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: kBorder),
                      ),
                      child: Text(
                        unreadCount == 0 ? 'All clear' : '$unreadCount unread',
                        style: const TextStyle(
                            color: kText,
                            fontWeight: FontWeight.w700,
                            fontSize: 12),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  'ALERT CONSOLE',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: kSubtle,
                        letterSpacing: 2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Installer alerts',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  appState.notifications.isEmpty
                      ? 'No active dispatch or provisioning alerts right now.'
                      : 'Track dispatch, activation, and system alerts from one queue.',
                  style: const TextStyle(color: kMuted, height: 1.45),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                        child: _metricChip(context,
                            label: 'Alerts',
                            value: appState.notifications.length.toString())),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _metricChip(context,
                            label: 'Unread', value: unreadCount.toString())),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton.icon(
                      onPressed: widget.onOpenJobs,
                      icon: const Icon(Icons.assignment_rounded, size: 18),
                      label: const Text('Open jobs'),
                    ),
                    OutlinedButton.icon(
                      onPressed: widget.onOpenDashboard,
                      icon: const Icon(Icons.dashboard_customize_rounded,
                          size: 18),
                      label: const Text('Back to dashboard'),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _filterChip('All', 'all', appState.notifications.length),
                    _filterChip('Unread', 'unread', unreadCount),
                    _filterChip('Job-linked', 'job', jobLinkedCount),
                  ],
                ),
                if (hasFilters) ...[
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: () => setState(() => _filter = 'all'),
                      icon: const Icon(Icons.filter_alt_off_rounded, size: 18),
                      label: const Text('Clear filters'),
                    ),
                  ),
                ],
                if (unreadCount > 0) ...[
                  const SizedBox(height: 14),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: appState.busy
                          ? null
                          : () => _markAllRead(context, appState),
                      icon: const Icon(Icons.done_all_rounded, size: 18),
                      label:
                          Text(appState.busy ? 'Updating...' : 'Mark all read'),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (appState.notifications.isEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('No installer notifications right now.',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const Text(
                    'Pull down to refresh when new jobs, dispatch updates, or activation notices come in.',
                    style: TextStyle(color: kMuted, height: 1.45),
                  ),
                ],
              ),
            )
          else if (filteredNotifications.isEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('No alerts matched this filter.',
                      style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  const Text(
                    'Switch to another alert filter or refresh when new activity comes in.',
                    style: TextStyle(color: kMuted, height: 1.45),
                  ),
                ],
              ),
            )
          else
            ...filteredNotifications.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(28),
                  onTap: () async {
                    await appState.markNotificationRead(item.id);
                    final jobId = item.payload['installerJobId']?.toString() ??
                        item.payload['jobId']?.toString();
                    if (!context.mounted) return;
                    if (jobId != null && jobId.isNotEmpty) {
                      final matches = appState.jobs
                          .where((candidate) => candidate.id == jobId)
                          .toList();
                      final job = matches.isEmpty ? null : matches.first;
                      if (job != null) {
                        await Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => JobDetailScreen(job: job)),
                        );
                        await appState.refresh();
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text(
                                  'Related job is not in the current queue. Refresh and try again.')),
                        );
                      }
                    }
                  },
                  child: AppCard(
                    color: item.readAt == null ? kSurface2 : kSurface,
                    borderColor: item.readAt == null
                        ? kPrimary.withValues(alpha: 0.42)
                        : kBorder,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(item.title,
                                  style:
                                      Theme.of(context).textTheme.titleMedium),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: item.readAt == null
                                    ? kPrimary.withValues(alpha: 0.18)
                                    : kSurface2,
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(
                                    color: item.readAt == null
                                        ? kPrimary.withValues(alpha: 0.36)
                                        : kBorder),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    item.readAt == null
                                        ? Icons.circle_notifications_rounded
                                        : Icons.mark_email_read_rounded,
                                    size: 14,
                                    color: item.readAt == null
                                        ? kPrimaryLight
                                        : kSubtle,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    item.readAt == null ? 'Unread' : 'Read',
                                    style: TextStyle(
                                      color: item.readAt == null
                                          ? kPrimaryLight
                                          : kSubtle,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          item.body,
                          style: const TextStyle(color: kMuted, height: 1.45),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          _formatTime(item.createdAt),
                          style: const TextStyle(color: kSubtle, fontSize: 12),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            OutlinedButton.icon(
                              onPressed: () => _copyAlert(context, item),
                              icon:
                                  const Icon(Icons.copy_all_rounded, size: 18),
                              label: const Text('Copy alert'),
                            ),
                            if (((item.payload['installerJobId'] ??
                                        item.payload['jobId']) ??
                                    '')
                                .toString()
                                .isNotEmpty)
                              OutlinedButton.icon(
                                onPressed: widget.onOpenJobs,
                                icon: const Icon(Icons.assignment_rounded,
                                    size: 18),
                                label: const Text('Open jobs'),
                              ),
                          ],
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

  Widget _metricChip(BuildContext context,
      {required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: kText,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: kMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String value, int count) {
    return FilterChip(
      label: Text('$label ($count)'),
      selected: _filter == value,
      onSelected: (_) => setState(() => _filter = value),
      avatar: count > 0 ? const Icon(Icons.bolt_rounded, size: 16) : null,
    );
  }

  Future<void> _copyAlert(
      BuildContext context, InstallerNotificationItem item) async {
    final alertPack = <String>[
      'Title: ${item.title}',
      'Body: ${item.body}',
      'Created: ${_formatTime(item.createdAt)}',
      'Job ID: ${((item.payload['installerJobId'] ?? item.payload['jobId']) ?? '-').toString()}',
    ].join('\n');
    await Clipboard.setData(ClipboardData(text: alertPack));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Alert copied')),
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
