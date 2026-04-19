import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';

class DashboardTab extends StatelessWidget {
  const DashboardTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final dashboard = appState.dashboard;
    final profile = appState.profile;

    final isAvailable = profile.availabilityStatus.toLowerCase() == 'available';

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
                          // Avatar
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.15),
                              border: Border.all(
                                  color:
                                      Colors.white.withValues(alpha: 0.3)),
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
                                      color: Colors.white60,
                                      fontSize: 12),
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
                      const SizedBox(height: 20),
                      // Sync status
                      if (appState.syncing || appState.lastSyncedAt != null)
                        Row(
                          children: [
                            if (appState.syncing)
                              const SizedBox(
                                width: 10,
                                height: 10,
                                child: CircularProgressIndicator(
                                    strokeWidth: 1.5,
                                    color: Colors.white54),
                              )
                            else
                              const Icon(Icons.check_circle_rounded,
                                  color: Color(0xFF4ADE80), size: 12),
                            const SizedBox(width: 6),
                            Text(
                              appState.syncing
                                  ? 'Syncing field data...'
                                  : 'Synced at ${_shortTime(appState.lastSyncedAt!)}',
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
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0x0DFF6B6B),
                      borderRadius: BorderRadius.circular(14),
                      border:
                          Border.all(color: const Color(0x33FF6B6B)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded,
                            color: Color(0xFFFCA5A5), size: 16),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(appState.error!,
                              style: GoogleFonts.inter(
                                  color: const Color(0xFFFCA5A5),
                                  fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // ── Metric cards ───────────────────────────────────
                _sectionLabel('TODAY\'S OVERVIEW'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _MetricCard(
                        label: 'New Jobs',
                        value: '${dashboard.todayNewInstallationJobs}',
                        icon: Icons.add_circle_rounded,
                        color: const Color(0xFF8B5CF6),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        label: 'Pending',
                        value: '${dashboard.pendingJobs}',
                        icon: Icons.pending_actions_rounded,
                        color: const Color(0xFFF59E0B),
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
                        value: '${dashboard.completedJobs}',
                        icon: Icons.task_alt_rounded,
                        color: const Color(0xFF10B981),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _MetricCard(
                        label: 'Total Jobs',
                        value: '${dashboard.todayNewInstallationJobs + dashboard.pendingJobs + dashboard.completedJobs}',
                        icon: Icons.summarize_rounded,
                        color: const Color(0xFF0EA5E9),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // ── Today's Focus ──────────────────────────────────
                _sectionLabel('TODAY\'S FIELD PROTOCOL'),
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
                      const _ProtocolStep(
                        number: '1',
                        title: 'Accept & Travel',
                        subtitle: 'Accept job, confirm departure immediately.',
                        icon: Icons.directions_car_rounded,
                        color: kPrimary,
                      ),
                      const SizedBox(height: 14),
                      const _ProtocolStep(
                        number: '2',
                        title: 'Scan ONT Serial',
                        subtitle: 'Use barcode scanner for accuracy — no typos.',
                        icon: Icons.qr_code_scanner_rounded,
                        color: Color(0xFF0EA5E9),
                      ),
                      const SizedBox(height: 14),
                      const _ProtocolStep(
                        number: '3',
                        title: 'Optical Check',
                        subtitle: 'Log RX/TX power before activating.',
                        icon: Icons.settings_input_component_rounded,
                        color: Color(0xFFF59E0B),
                      ),
                      const SizedBox(height: 14),
                      const _ProtocolStep(
                        number: '4',
                        title: 'Activate & Verify OTP',
                        subtitle: 'Customer OTP confirms handover.',
                        icon: Icons.verified_rounded,
                        color: Color(0xFF10B981),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // ── Quick Stats ────────────────────────────────────
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
                      _infoRow(Icons.badge_rounded, 'Installer Code',
                          profile.installerCode),
                      const Divider(height: 20, color: kDivider),
                      _infoRow(Icons.phone_rounded, 'Phone',
                          profile.phone),
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
  });

  final String number, title, subtitle;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.25)),
          ),
          child: Icon(icon, color: color, size: 20),
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
                      color: color.withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        number,
                        style: GoogleFonts.inter(
                          color: color,
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
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: GoogleFonts.inter(color: kMuted, fontSize: 11),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
