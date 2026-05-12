import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../fault_alert_detail_screen.dart';
import '../optical_check_screen.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  void _openFaultDetail(BuildContext context, InstallerFaultAlert alert) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => FaultAlertDetailScreen(alert: alert),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final profile = appState.profile;
    final jobs = appState.jobs;
    final faultAlerts = appState.faultAlerts;

    final isAvailable =
        profile.availabilityStatus.toLowerCase() == 'available';

    final totalInstalls =
        jobs.where((j) => j.jobType.toLowerCase().contains('install')).length;
    final totalComplaints =
        jobs.where((j) => j.jobType.toLowerCase().contains('complaint')).length;
    final pendingJobs =
        jobs.where((j) => j.status.toLowerCase() == 'assigned').length;
    final activeJobs = jobs
        .where((j) =>
            j.status.toLowerCase().contains('enroute') ||
            j.status.toLowerCase().contains('onsite') ||
            j.status.toLowerCase().contains('progress') ||
            j.status.toLowerCase().contains('activat'))
        .length;
    final completedJobs =
        jobs.where((j) => j.status.toLowerCase().contains('complet')).length;
    final deferredJobs =
        jobs.where((j) => j.status.toLowerCase().contains('defer')).length;
    final criticalFaults = faultAlerts
        .where((item) => item.severity.toLowerCase() == 'critical')
        .length;
    final warningFaults = faultAlerts
        .where((item) => item.severity.toLowerCase() == 'warning')
        .length;

    final newJobs = jobs.where((j) => j.status.toLowerCase() == 'assigned').toList();

    return RefreshIndicator(
      color: kPrimaryLight,
      backgroundColor: kSurface,
      onRefresh: appState.refresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // ── Hero Header ──────────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF12052A), Color(0xFF4A1480)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top row: Avatar + Name + Availability
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: const LinearGradient(
                                colors: [Color(0xFF6B21A8), Color(0xFF9333EA)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.2),
                                  width: 2),
                            ),
                            child: Center(
                              child: Text(
                                profile.fullName.isNotEmpty
                                    ? profile.fullName[0].toUpperCase()
                                    : 'F',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 22,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _greeting(),
                                  style: GoogleFonts.inter(
                                    color: Colors.white54,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                                Text(
                                  profile.fullName.isNotEmpty
                                      ? profile.fullName.split(' ').first
                                      : 'Installer',
                                  style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 22,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  profile.installerCode,
                                  style: GoogleFonts.inter(
                                      color: Colors.white38, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                              color: isAvailable
                                  ? const Color(0x2522C55E)
                                  : const Color(0x25EF4444),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isAvailable
                                    ? const Color(0x5522C55E)
                                    : const Color(0x55EF4444),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isAvailable
                                        ? const Color(0xFF22C55E)
                                        : const Color(0xFFEF4444),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  isAvailable ? 'On Duty' : 'Off Duty',
                                  style: GoogleFonts.inter(
                                    color: isAvailable
                                        ? const Color(0xFF4ADE80)
                                        : const Color(0xFFFCA5A5),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 22),
                      // Quick stat chips
                      Row(
                        children: [
                          _heroStat('$pendingJobs', 'Pending',
                              const Color(0xFFFBBF24)),
                          const SizedBox(width: 8),
                          _heroStat(
                              '$activeJobs', 'Active', const Color(0xFF0EA5E9)),
                          const SizedBox(width: 8),
                          _heroStat('$completedJobs', 'Done',
                              const Color(0xFF10B981)),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Sync status
                      Row(
                        children: [
                          if (appState.busy)
                            const SizedBox(
                              width: 10,
                              height: 10,
                              child: CircularProgressIndicator(
                                  strokeWidth: 1.5, color: Colors.white54),
                            )
                          else
                            const Icon(Icons.check_circle_rounded,
                                color: Color(0xFF4ADE80), size: 11),
                          const SizedBox(width: 6),
                          Text(
                            appState.busy
                                ? 'Syncing…'
                                : appState.lastSyncedAt != null
                                    ? 'Synced ${_shortTime(appState.lastSyncedAt!)}'
                                    : 'Not synced yet',
                            style: GoogleFonts.inter(
                                color: Colors.white38, fontSize: 10),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 40),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Error ──────────────────────────────────────────
                if ((appState.error ?? '').isNotEmpty) ...[
                  _ErrorBanner(
                    message: appState.error!,
                    onRetry: appState.refresh,
                  ),
                  const SizedBox(height: 16),
                ],

                // ── New Jobs Banner ────────────────────────────────
                if (newJobs.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          kPrimary.withValues(alpha: 0.18),
                          const Color(0xFF1E1037),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                          color: kPrimary.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: kPrimary.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.new_releases_rounded,
                              color: kPrimaryLight, size: 22),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${newJobs.length} job${newJobs.length > 1 ? 's' : ''} waiting for you',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                'Open the Jobs or Complaints tab to begin.',
                                style: GoogleFonts.inter(
                                    color: kMuted, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded,
                            color: kSubtle, size: 20),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // ── Stats Grid ─────────────────────────────────────
                _sectionLabel('TODAY\'S OVERVIEW'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        label: 'Installations',
                        value: '$totalInstalls',
                        icon: Icons.router_rounded,
                        color: const Color(0xFF818CF8),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        label: 'Complaints',
                        value: '$totalComplaints',
                        icon: Icons.build_circle_rounded,
                        color: const Color(0xFFFBBF24),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        label: 'Active',
                        value: '$activeJobs',
                        icon: Icons.electric_bolt_rounded,
                        color: const Color(0xFF0EA5E9),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        label: 'Completed',
                        value: '$completedJobs',
                        icon: Icons.task_alt_rounded,
                        color: const Color(0xFF10B981),
                      ),
                    ),
                  ],
                ),
                if (deferredJobs > 0) ...[
                  const SizedBox(height: 12),
                  _MetricCard(
                    label: 'Deferred',
                    value: '$deferredJobs',
                    icon: Icons.schedule_rounded,
                    color: const Color(0xFFE879F9),
                  ),
                ],

                const SizedBox(height: 24),

                // ── Fault Watch ────────────────────────────────────
                _sectionLabel('FAULT WATCH'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        label: 'Critical',
                        value: '$criticalFaults',
                        icon: Icons.warning_amber_rounded,
                        color: const Color(0xFFEF4444),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        label: 'Warnings',
                        value: '$warningFaults',
                        icon: Icons.network_check_rounded,
                        color: const Color(0xFFF59E0B),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: kBorder),
                  ),
                  child: faultAlerts.isEmpty
                      ? Row(
                          children: [
                            const Icon(Icons.check_circle_rounded,
                                color: Color(0xFF10B981), size: 16),
                            const SizedBox(width: 10),
                            Text(
                              'No active alerts right now.',
                              style: GoogleFonts.inter(
                                  color: kMuted, fontSize: 13),
                            ),
                          ],
                        )
                      : Column(
                          children: faultAlerts.take(3).map((alert) {
                            final severityColor =
                                alert.severity.toLowerCase() == 'critical'
                                    ? const Color(0xFFEF4444)
                                    : const Color(0xFFF59E0B);
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: GestureDetector(
                                onTap: () =>
                                    _openFaultDetail(context, alert),
                                child: Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: severityColor.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color:
                                          severityColor.withValues(alpha: 0.22),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Icon(Icons.sensors_rounded,
                                              size: 16,
                                              color: severityColor),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Text(
                                              alert.title,
                                              style: GoogleFonts.inter(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w800,
                                                fontSize: 13,
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
                                      const SizedBox(height: 6),
                                      Text(
                                        alert.message,
                                        style: GoogleFonts.inter(
                                          color: kMuted,
                                          fontSize: 12,
                                          height: 1.4,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Assets: ${alert.affectedAssets} · Customers: ${alert.affectedCustomers}${alert.rxPower != null ? ' · RX ${alert.rxPower}' : ''}',
                                        style: GoogleFonts.inter(
                                          color: kSubtle,
                                          fontSize: 11,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                ),

                const SizedBox(height: 24),

                // ── Quick Actions ──────────────────────────────────
                _sectionLabel('QUICK ACTIONS'),
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const OpticalCheckScreen(),
                      ),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: kBorder),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0EA5E9).withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.network_check_rounded,
                            color: Color(0xFF0EA5E9),
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Optical Check',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                              ),
                              Text(
                                'Check any customer\'s ONT optical power',
                                style: GoogleFonts.inter(
                                    color: kMuted, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.chevron_right_rounded,
                            color: kSubtle, size: 20),
                      ],
                    ),
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroStat(String value, String label, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.07),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Column(
            children: [
              Text(
                value,
                style: GoogleFonts.inter(
                  color: color,
                  fontWeight: FontWeight.w900,
                  fontSize: 20,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: GoogleFonts.inter(
                    color: Colors.white54, fontSize: 10),
              ),
            ],
          ),
        ),
      );

  Widget _sectionLabel(String text) => Text(
        text,
        style: GoogleFonts.inter(
          color: kMuted,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
        ),
      );

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  String _shortTime(DateTime value) {
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
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

// ─── Metric Card ──────────────────────────────────────────────────────────────

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label, value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.2)),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 22,
                    letterSpacing: -0.5,
                  ),
                ),
                Text(
                  label,
                  style: GoogleFonts.inter(color: kMuted, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
