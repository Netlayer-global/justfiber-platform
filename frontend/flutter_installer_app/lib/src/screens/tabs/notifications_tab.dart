import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../fault_alert_detail_screen.dart';
import '../job_detail_screen.dart';

class NotificationsTab extends StatefulWidget {
  const NotificationsTab({
    super.key,
    this.onOpenJobs,
    this.onOpenComplaints,
    this.onOpenDashboard,
  });

  final VoidCallback? onOpenJobs;
  final VoidCallback? onOpenComplaints;
  final VoidCallback? onOpenDashboard;

  @override
  State<NotificationsTab> createState() => _NotificationsTabState();
}

class _NotificationsTabState extends State<NotificationsTab> {
  String _filter = 'all';

  Future<void> _openFaultDetail(
    BuildContext context,
    InstallerFaultAlert alert,
  ) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FaultAlertDetailScreen(alert: alert),
      ),
    );
  }

  Future<void> _markAllRead(
      BuildContext context, InstallerAppState appState) async {
    final ok = await appState.markAllNotificationsRead();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(ok
          ? 'All alerts marked as read'
          : (appState.error ?? 'Unable to mark alerts as read')),
      behavior: SnackBarBehavior.floating,
    ));
  }

  Future<void> _openJobFromNotif(
      BuildContext context,
      InstallerAppState appState,
      InstallerNotificationItem item) async {
    await appState.markNotificationRead(item.id);
    final jobId = item.payload['installerJobId']?.toString() ??
        item.payload['jobId']?.toString();
    if (!context.mounted || jobId == null || jobId.isEmpty) return;

    final matches =
        appState.jobs.where((j) => j.id == jobId).toList();
    final job = matches.isEmpty ? null : matches.first;

    if (job == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text(
            'Related job not in current queue — pull to refresh and try again.'),
        behavior: SnackBarBehavior.floating,
      ));
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => JobDetailScreen(job: job)),
    );
    if (context.mounted) await appState.refresh();
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final all = appState.notifications;
    final faultAlerts = appState.faultAlerts;
    final unreadCount = all.where((n) => n.readAt == null).length;
    final jobLinkedCount = all
        .where((n) =>
            (n.payload['installerJobId'] ?? n.payload['jobId'] ?? '')
                .toString()
                .isNotEmpty)
        .length;

    final filtered = all.where((n) {
      return switch (_filter) {
        'unread' => n.readAt == null,
        'job' =>
          (n.payload['installerJobId'] ?? n.payload['jobId'] ?? '')
              .toString()
              .isNotEmpty,
        _ => true,
      };
    }).toList();

    return RefreshIndicator(
      color: kPrimaryLight,
      backgroundColor: kSurface,
      onRefresh: appState.refresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // ── Gradient Header ──────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Alerts',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.5,
                              ),
                            ),
                          ),
                          if (unreadCount > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: kPrimary.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                    color: kPrimary.withValues(alpha: 0.4)),
                              ),
                              child: Text(
                                '$unreadCount unread',
                                style: GoogleFonts.inter(
                                  color: kPrimaryLight,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            )
                          else
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: const Color(0x2210B981),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                    color: const Color(0x4410B981)),
                              ),
                              child: Text(
                                'All clear',
                                style: GoogleFonts.inter(
                                  color: const Color(0xFF4ADE80),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          _headerStat('${all.length}', 'Total',
                              Colors.white54),
                          const SizedBox(width: 10),
                          _headerStat('$unreadCount', 'Unread',
                              kPrimaryLight),
                          const SizedBox(width: 10),
                          _headerStat('$jobLinkedCount', 'Job-linked',
                              const Color(0xFF34D399)),
                          const SizedBox(width: 10),
                          _headerStat('${faultAlerts.length}', 'Faults',
                              const Color(0xFFFCA5A5)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Filter + actions ─────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
              child: Column(
                children: [
                  if (faultAlerts.isNotEmpty) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1F172A),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x33EF4444)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Fault feed',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 10),
                          ...faultAlerts.take(3).map((alert) => Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: GestureDetector(
                                  onTap: () => _openFaultDetail(context, alert),
                                  child: Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: alert.severity.toLowerCase() == 'critical'
                                          ? const Color(0x22EF4444)
                                          : const Color(0x22F59E0B),
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: alert.severity.toLowerCase() == 'critical'
                                            ? const Color(0x44EF4444)
                                            : const Color(0x44F59E0B),
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                alert.title,
                                                style: GoogleFonts.inter(
                                                  color: Colors.white,
                                                  fontWeight: FontWeight.w800,
                                                  fontSize: 12,
                                                ),
                                              ),
                                            ),
                                            const Icon(
                                              Icons.arrow_forward_ios_rounded,
                                              size: 12,
                                              color: kSubtle,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          alert.message,
                                          style: GoogleFonts.inter(
                                            color: kMuted,
                                            fontSize: 12,
                                            height: 1.35,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Assets: ${alert.affectedAssets} • Customers: ${alert.affectedCustomers}${alert.rxPower != null ? ' • RX ${alert.rxPower}' : ''}',
                                          style: GoogleFonts.inter(
                                            color: kSubtle,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              )),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],
                  // Filter chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _filterChip('All', 'all', all.length),
                        const SizedBox(width: 8),
                        _filterChip('Unread', 'unread', unreadCount),
                        const SizedBox(width: 8),
                        _filterChip('Job-linked', 'job', jobLinkedCount),
                        if (unreadCount > 0) ...[
                          const SizedBox(width: 12),
                          GestureDetector(
                            onTap: appState.busy
                                ? null
                                : () => _markAllRead(context, appState),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 7),
                              decoration: BoxDecoration(
                                color:
                                    kPrimary.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                    color: kPrimary
                                        .withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.done_all_rounded,
                                      size: 14, color: kPrimaryLight),
                                  const SizedBox(width: 5),
                                  Text('Mark all read',
                                      style: GoogleFonts.inter(
                                          color: kPrimaryLight,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Error ────────────────────────────────────────────────
          if ((appState.error ?? '').isNotEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
              sliver: SliverToBoxAdapter(
                child: _ErrorBanner(
                    message: appState.error!, onRetry: appState.refresh),
              ),
            ),

          // ── Empty state ──────────────────────────────────────────
          if (filtered.isEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 40),
              sliver: SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: kBorder),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.notifications_none_rounded,
                          color: kSubtle, size: 44),
                      const SizedBox(height: 12),
                      Text(
                        all.isEmpty
                            ? 'No alerts right now'
                            : 'No alerts match this filter',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 15),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        all.isEmpty
                            ? 'Pull down to refresh for latest dispatch and activation notices.'
                            : 'Switch filter or pull to refresh.',
                        style: GoogleFonts.inter(
                            color: kMuted, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 40),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) {
                    final item = filtered[i];
                    final isUnread = item.readAt == null;
                    final hasJob = (item.payload['installerJobId'] ??
                            item.payload['jobId'] ??
                            '')
                        .toString()
                        .isNotEmpty;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: GestureDetector(
                        onTap: () =>
                            _openJobFromNotif(context, appState, item),
                        child: Container(
                          decoration: BoxDecoration(
                            color: isUnread ? kSurface2 : kSurface,
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: isUnread
                                  ? kPrimary.withValues(alpha: 0.4)
                                  : kBorder,
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Top strip
                              Container(
                                padding: const EdgeInsets.fromLTRB(
                                    14, 12, 14, 12),
                                decoration: BoxDecoration(
                                  color: isUnread
                                      ? kPrimary.withValues(alpha: 0.05)
                                      : Colors.transparent,
                                  borderRadius: const BorderRadius
                                      .vertical(top: Radius.circular(18)),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 36,
                                      height: 36,
                                      decoration: BoxDecoration(
                                        color: isUnread
                                            ? kPrimary
                                                .withValues(alpha: 0.12)
                                            : kSurface3.withValues(
                                                alpha: 0.5),
                                        borderRadius:
                                            BorderRadius.circular(10),
                                      ),
                                      child: Icon(
                                        isUnread
                                            ? Icons
                                                .notifications_active_rounded
                                            : Icons
                                                .notifications_none_rounded,
                                        color: isUnread
                                            ? kPrimaryLight
                                            : kSubtle,
                                        size: 18,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        item.title,
                                        style: GoogleFonts.inter(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: isUnread
                                            ? kPrimary
                                                .withValues(alpha: 0.15)
                                            : kSurface2,
                                        borderRadius:
                                            BorderRadius.circular(6),
                                        border: Border.all(
                                          color: isUnread
                                              ? kPrimary
                                                  .withValues(alpha: 0.3)
                                              : kBorder,
                                        ),
                                      ),
                                      child: Text(
                                        isUnread ? 'NEW' : 'READ',
                                        style: GoogleFonts.inter(
                                          color: isUnread
                                              ? kPrimaryLight
                                              : kSubtle,
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 0.8,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Body
                              Padding(
                                padding: const EdgeInsets.fromLTRB(
                                    14, 0, 14, 12),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.body,
                                      style: GoogleFonts.inter(
                                          color: kMuted,
                                          fontSize: 13,
                                          height: 1.45),
                                    ),
                                    const SizedBox(height: 10),
                                    Row(
                                      children: [
                                        const Icon(
                                            Icons.access_time_rounded,
                                            color: kSubtle,
                                            size: 12),
                                        const SizedBox(width: 4),
                                        Text(
                                          _formatTime(item.createdAt),
                                          style: GoogleFonts.inter(
                                              color: kSubtle,
                                              fontSize: 11),
                                        ),
                                        const Spacer(),
                                        if (hasJob)
                                          Row(
                                            children: [
                                              GestureDetector(
                                                onTap: () =>
                                                    _copyAlert(
                                                        context, item),
                                                child: const Icon(
                                                    Icons.copy_rounded,
                                                    color: kSubtle,
                                                    size: 14),
                                              ),
                                              const SizedBox(width: 12),
                                              GestureDetector(
                                                onTap: () =>
                                                    _openJobFromNotif(
                                                        context,
                                                        appState,
                                                        item),
                                                child: Row(
                                                  children: [
                                                    Text('Open job',
                                                        style:
                                                            GoogleFonts.inter(
                                                          color:
                                                              kPrimaryLight,
                                                          fontSize: 12,
                                                          fontWeight:
                                                              FontWeight
                                                                  .w700,
                                                        )),
                                                    const SizedBox(
                                                        width: 3),
                                                    const Icon(
                                                        Icons
                                                            .arrow_forward_rounded,
                                                        color: kPrimaryLight,
                                                        size: 13),
                                                  ],
                                                ),
                                              ),
                                            ],
                                          )
                                        else
                                          GestureDetector(
                                            onTap: () =>
                                                _copyAlert(context, item),
                                            child: const Icon(
                                                Icons.copy_rounded,
                                                color: kSubtle,
                                                size: 14),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                  childCount: filtered.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _headerStat(String value, String label, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Column(
            children: [
              Text(value,
                  style: GoogleFonts.inter(
                      color: color,
                      fontWeight: FontWeight.w900,
                      fontSize: 18)),
              Text(label,
                  style:
                      GoogleFonts.inter(color: Colors.white60, fontSize: 10)),
            ],
          ),
        ),
      );

  Widget _filterChip(String label, String value, int count) {
    final selected = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? kPrimary.withValues(alpha: 0.15)
              : kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected
                  ? kPrimary.withValues(alpha: 0.5)
                  : kBorder),
        ),
        child: Text(
          '$label ($count)',
          style: GoogleFonts.inter(
            color: selected ? kPrimaryLight : kMuted,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Future<void> _copyAlert(
      BuildContext context, InstallerNotificationItem item) async {
    final text = [
      'Title: ${item.title}',
      'Body: ${item.body}',
      'Time: ${_formatTime(item.createdAt)}',
    ].join('\n');
    await Clipboard.setData(ClipboardData(text: text));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Alert copied'),
      behavior: SnackBarBehavior.floating,
    ));
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

// ─── Error Banner ─────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      decoration: BoxDecoration(
        color: const Color(0x0DFF6B6B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x33FF6B6B)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: Color(0xFFFCA5A5), size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message,
                style: GoogleFonts.inter(
                    color: const Color(0xFFFCA5A5), fontSize: 13)),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0x22FF6B6B),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('Retry',
                  style: GoogleFonts.inter(
                      color: const Color(0xFFFCA5A5),
                      fontSize: 12,
                      fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}
