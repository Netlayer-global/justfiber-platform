import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../fault_alert_detail_screen.dart';

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
    final dashboard = appState.dashboard;
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

    // Dynamic protocol: first non-completed/cancelled job drives protocol step indicators
    final activeFiltered = jobs
        .where((j) =>
            !j.status.toLowerCase().contains('complet') &&
            !j.status.toLowerCase().contains('cancel'))
        .toList();
    final InstallerJob? activeJob =
        activeFiltered.isEmpty ? null : activeFiltered.first;

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
                  colors: [Color(0xFF3B0A73), Color(0xFF6B21A8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.15),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.3)),
                            ),
                            child: Center(
                              child: Text(
                                profile.fullName.isNotEmpty
                                    ? profile.fullName[0].toUpperCase()
                                    : 'F',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 20,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Good ${_greeting()}, ${profile.fullName.split(' ').first}',
                                  style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                  ),
                                ),
                                Text(
                                  profile.installerCode,
                                  style: GoogleFonts.inter(
                                      color: Colors.white60, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          // Availability badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
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
                                  width: 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: isAvailable
                                        ? const Color(0xFF22C55E)
                                        : const Color(0xFFEF4444),
                                  ),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  isAvailable ? 'On Duty' : 'Off Duty',
                                  style: GoogleFonts.inter(
                                    color: isAvailable
                                        ? const Color(0xFF4ADE80)
                                        : const Color(0xFFFCA5A5),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ],
                            ),
                          ),
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
                                color: Color(0xFF4ADE80), size: 12),
                          const SizedBox(width: 6),
                          Text(
                            appState.busy
                                ? 'Syncing field data...'
                                : appState.lastSyncedAt != null
                                    ? 'Synced at ${_shortTime(appState.lastSyncedAt!)}'
                                    : 'Not synced yet',
                            style: GoogleFonts.inter(
                                color: Colors.white60, fontSize: 11),
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

                // ── Stats grid ─────────────────────────────────────
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
                        label: 'Pending',
                        value: '$pendingJobs',
                        icon: Icons.pending_actions_rounded,
                        color: const Color(0xFFF59E0B),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        label: 'Active',
                        value: '$activeJobs',
                        icon: Icons.electric_bolt_rounded,
                        color: const Color(0xFF0EA5E9),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        label: 'Completed',
                        value: '$completedJobs',
                        icon: Icons.task_alt_rounded,
                        color: const Color(0xFF10B981),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        label: 'Deferred',
                        value: '$deferredJobs',
                        icon: Icons.schedule_rounded,
                        color: const Color(0xFFE879F9),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // ── New jobs banner ────────────────────────────────
                _sectionLabel('FAULT WATCH'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        label: 'Critical Faults',
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
                      ? Text(
                          'No active cut path or low RX alarms right now.',
                          style: GoogleFonts.inter(
                            color: kMuted,
                            fontSize: 13,
                          ),
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
                                onTap: () => _openFaultDetail(context, alert),
                                child: Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: severityColor.withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                      color: severityColor.withValues(alpha: 0.22),
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Icon(Icons.sensors_rounded,
                                              size: 16, color: severityColor),
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
                            );
                          }).toList(),
                        ),
                ),
                const SizedBox(height: 24),

                if (dashboard.todayNewInstallationJobs > 0) ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1037),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: kPrimary.withValues(alpha: 0.35)),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 40,
                          height: 40,
                          decoration: BoxDecoration(
                            color: kPrimary.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.new_releases_rounded,
                              color: kPrimaryLight, size: 20),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${dashboard.todayNewInstallationJobs} new installation${dashboard.todayNewInstallationJobs > 1 ? 's' : ''} today',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                'Check the Installations tab to start.',
                                style: GoogleFonts.inter(
                                    color: kMuted, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // ── Field Protocol ─────────────────────────────────
                _sectionLabel('FIELD PROTOCOL'),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: kBorder),
                  ),
                  child: Column(
                    children: [
                      _ProtocolStep(
                        number: '1',
                        title: 'Accept & Travel',
                        subtitle: 'Accept job, confirm departure immediately.',
                        icon: Icons.directions_car_rounded,
                        color: kPrimary,
                        done: activeJob != null &&
                            !['assigned']
                                .contains(activeJob.status.toLowerCase()),
                      ),
                      const SizedBox(height: 14),
                      _ProtocolStep(
                        number: '2',
                        title: 'Reach Site & Check-in',
                        subtitle: 'Mark onsite arrival — GPS check-in required.',
                        icon: Icons.location_on_rounded,
                        color: const Color(0xFF0EA5E9),
                        done: activeJob != null &&
                            ['onsite', 'ont_scanned', 'activation_in_progress',
                                    'active', 'completed']
                                .contains(activeJob.status.toLowerCase()),
                      ),
                      const SizedBox(height: 14),
                      _ProtocolStep(
                        number: '3',
                        title: 'Scan ONT & Optical Check',
                        subtitle:
                            'Barcode scan + log RX/TX power before activating.',
                        icon: Icons.qr_code_scanner_rounded,
                        color: const Color(0xFFF59E0B),
                        done: activeJob != null &&
                            ['activation_in_progress', 'active', 'completed']
                                .contains(activeJob.status.toLowerCase()),
                      ),
                      const SizedBox(height: 14),
                      _ProtocolStep(
                        number: '4',
                        title: 'Activate & Verify OTP',
                        subtitle: 'Customer OTP confirms successful handover.',
                        icon: Icons.verified_rounded,
                        color: const Color(0xFF10B981),
                        done: activeJob != null &&
                            ['completed']
                                .contains(activeJob.status.toLowerCase()),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // ── Installer info ─────────────────────────────────
                _sectionLabel('INSTALLER INFO'),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: kBorder),
                  ),
                  child: Column(
                    children: [
                      _infoRow(
                          Icons.badge_rounded, 'Code', profile.installerCode),
                      const Divider(height: 20, color: kDivider),
                      _infoRow(Icons.phone_rounded, 'Phone', profile.phone),
                      const Divider(height: 20, color: kDivider),
                      _infoRow(
                        isAvailable
                            ? Icons.check_circle_rounded
                            : Icons.cancel_rounded,
                        'Status',
                        profile.availabilityStatus,
                        valueColor: isAvailable
                            ? const Color(0xFF4ADE80)
                            : const Color(0xFFFCA5A5),
                      ),
                    ],
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) => Text(
        text,
        style: GoogleFonts.inter(
          color: kMuted,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
        ),
      );

  Widget _infoRow(IconData icon, String label, String value,
          {Color? valueColor}) =>
      Row(
        children: [
          Icon(icon, color: kMuted, size: 16),
          const SizedBox(width: 10),
          Text(label,
              style: GoogleFonts.inter(color: kMuted, fontSize: 13)),
          const Spacer(),
          Text(value,
              style: GoogleFonts.inter(
                  color: valueColor ?? Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 13)),
        ],
      );

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
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
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(11),
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

// ─── Protocol Step ────────────────────────────────────────────────────────────

class _ProtocolStep extends StatelessWidget {
  const _ProtocolStep({
    required this.number,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    this.done = false,
  });

  final String number, title, subtitle;
  final IconData icon;
  final Color color;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: done
                ? const Color(0xFF10B981).withValues(alpha: 0.12)
                : color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: done
                    ? const Color(0xFF10B981).withValues(alpha: 0.25)
                    : color.withValues(alpha: 0.25)),
          ),
          child: Icon(
            done ? Icons.check_rounded : icon,
            color: done ? const Color(0xFF10B981) : color,
            size: 20,
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 18,
                    height: 18,
                    decoration: BoxDecoration(
                      color: done
                          ? const Color(0xFF10B981).withValues(alpha: 0.2)
                          : color.withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        number,
                        style: GoogleFonts.inter(
                          color: done
                              ? const Color(0xFF10B981)
                              : color,
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 7),
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      color: done ? Colors.white54 : Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      decoration:
                          done ? TextDecoration.lineThrough : null,
                      decorationColor: Colors.white38,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: GoogleFonts.inter(
                    color: done ? kSubtle : kMuted, fontSize: 11),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
