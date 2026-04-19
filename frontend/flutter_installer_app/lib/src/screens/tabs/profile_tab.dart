import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final profile = appState.profile;
    final dashboard = appState.dashboard;
    final isAvailable =
        profile.availabilityStatus.toLowerCase() == 'available';

    return CustomScrollView(
      slivers: [
        // ── Gradient Header ────────────────────────────────────────
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
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
                child: Column(
                  children: [
                    // Avatar + name
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withValues(alpha: 0.15),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.3),
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
                            fontSize: 30,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      profile.fullName,
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 22,
                        letterSpacing: -0.4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      profile.installerCode,
                      style: GoogleFonts.inter(
                          color: Colors.white60, fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    // Availability pill
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
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
              ),
            ),
          ),
        ),

        SliverPadding(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 40),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              // ── Today's Stats ───────────────────────────────────
              _sectionLabel('TODAY\'S PERFORMANCE'),
              const SizedBox(height: 12),
              Row(
                children: [
                  _StatCard(
                      label: 'New',
                      value:
                          '${dashboard.todayNewInstallationJobs}',
                      icon: Icons.add_circle_rounded,
                      color: kPrimary),
                  const SizedBox(width: 10),
                  _StatCard(
                      label: 'Pending',
                      value: '${dashboard.pendingJobs}',
                      icon: Icons.pending_actions_rounded,
                      color: const Color(0xFFF59E0B)),
                  const SizedBox(width: 10),
                  _StatCard(
                      label: 'Done',
                      value: '${dashboard.completedJobs}',
                      icon: Icons.task_alt_rounded,
                      color: const Color(0xFF10B981)),
                ],
              ),

              const SizedBox(height: 24),

              // ── Personal Info ───────────────────────────────────
              _sectionLabel('INSTALLER INFO'),
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  children: [
                    _InfoRow(
                      icon: Icons.badge_rounded,
                      label: 'Installer Code',
                      value: profile.installerCode,
                      copyable: true,
                    ),
                    const Divider(height: 1, color: kDivider, indent: 56),
                    _InfoRow(
                      icon: Icons.phone_rounded,
                      label: 'Phone',
                      value: profile.phone,
                      copyable: true,
                    ),
                    const Divider(height: 1, color: kDivider, indent: 56),
                    _InfoRow(
                      icon: isAvailable
                          ? Icons.check_circle_rounded
                          : Icons.cancel_rounded,
                      label: 'Availability',
                      value: profile.availabilityStatus,
                      valueColor: isAvailable
                          ? const Color(0xFF4ADE80)
                          : const Color(0xFFFCA5A5),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ── Leave Management ────────────────────────────────
              _sectionLabel('AVAILABILITY MANAGEMENT'),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isAvailable
                          ? 'You are currently on duty.'
                          : 'You are currently off duty.',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isAvailable
                          ? 'Start leave to stop receiving new job assignments.'
                          : 'End leave to resume receiving job assignments.',
                      style: GoogleFonts.inter(
                          color: kMuted, fontSize: 12, height: 1.4),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: isAvailable
                          ? OutlinedButton.icon(
                              onPressed: appState.busy
                                  ? null
                                  : () =>
                                      _confirmLeave(context, appState),
                              style: OutlinedButton.styleFrom(
                                foregroundColor:
                                    const Color(0xFFFCA5A5),
                                side: const BorderSide(
                                    color: Color(0x55EF4444)),
                                padding: const EdgeInsets.symmetric(
                                    vertical: 13),
                                shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(12)),
                              ),
                              icon: const Icon(
                                  Icons.airline_seat_recline_normal_rounded,
                                  size: 18),
                              label: Text(
                                appState.busy
                                    ? 'Updating...'
                                    : 'Start Leave',
                                style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700),
                              ),
                            )
                          : FilledButton.icon(
                              onPressed: appState.busy
                                  ? null
                                  : () => appState.endLeave(),
                              style: FilledButton.styleFrom(
                                backgroundColor:
                                    const Color(0xFF10B981),
                                padding: const EdgeInsets.symmetric(
                                    vertical: 13),
                                shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(12)),
                              ),
                              icon: const Icon(
                                  Icons.login_rounded,
                                  size: 18),
                              label: Text(
                                appState.busy
                                    ? 'Updating...'
                                    : 'End Leave & Go On Duty',
                                style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700),
                              ),
                            ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ── Workflow Guide ──────────────────────────────────
              _sectionLabel('INSTALLATION WORKFLOW'),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: kBorder),
                ),
                child: const Column(
                  children: [
                    _WorkflowRow('1', 'Accept job & start travel'),
                    Divider(height: 16, color: kDivider),
                    _WorkflowRow('2', 'Mark onsite arrival (GPS check-in)'),
                    Divider(height: 16, color: kDivider),
                    _WorkflowRow('3', 'Scan ONT serial + optical readings'),
                    Divider(height: 16, color: kDivider),
                    _WorkflowRow('4', 'Save checklist & activate connection'),
                    Divider(height: 16, color: kDivider),
                    _WorkflowRow('5', 'Capture proof photos & verify OTP'),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // ── Logout ──────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => _confirmLogout(context, appState),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFFCA5A5),
                    side: const BorderSide(color: Color(0x33EF4444)),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.logout_rounded, size: 18),
                  label: Text('Sign Out',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w700, fontSize: 14)),
                ),
              ),
            ]),
          ),
        ),
      ],
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

  Future<void> _confirmLeave(
      BuildContext context, InstallerAppState appState) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Start Leave?',
            style: GoogleFonts.inter(
                color: Colors.white, fontWeight: FontWeight.w800)),
        content: Text(
            'You will stop receiving new job assignments while on leave.',
            style: GoogleFonts.inter(color: kMuted, fontSize: 13)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child:
                Text('Cancel', style: GoogleFonts.inter(color: kMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Start Leave',
                style: GoogleFonts.inter(
                    color: const Color(0xFFEF4444),
                    fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm == true) await appState.startLeave(reason: 'Leave');
  }

  Future<void> _confirmLogout(
      BuildContext context, InstallerAppState appState) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Sign out?',
            style: GoogleFonts.inter(
                color: Colors.white, fontWeight: FontWeight.w800)),
        content: Text('You will need to sign in again to access jobs.',
            style: GoogleFonts.inter(color: kMuted, fontSize: 13)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child:
                Text('Cancel', style: GoogleFonts.inter(color: kMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Sign out',
                style: GoogleFonts.inter(
                    color: const Color(0xFFEF4444),
                    fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm == true) appState.logout();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });
  final String label, value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(height: 6),
              Text(value,
                  style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 20)),
              Text(label,
                  style:
                      GoogleFonts.inter(color: kMuted, fontSize: 10)),
            ],
          ),
        ),
      );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
    this.copyable = false,
  });
  final IconData icon;
  final String label, value;
  final Color? valueColor;
  final bool copyable;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(icon, color: kMuted, size: 18),
            const SizedBox(width: 12),
            Text(label,
                style: GoogleFonts.inter(color: kMuted, fontSize: 13)),
            const Spacer(),
            Text(value,
                style: GoogleFonts.inter(
                    color: valueColor ?? Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 13)),
            if (copyable) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: value));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('$label copied'),
                        duration: const Duration(seconds: 1)),
                  );
                },
                child:
                    const Icon(Icons.copy_rounded, color: kSubtle, size: 14),
              ),
            ],
          ],
        ),
      );
}

class _WorkflowRow extends StatelessWidget {
  const _WorkflowRow(this.number, this.text);
  final String number, text;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.15),
              shape: BoxShape.circle,
              border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
            ),
            child: Center(
              child: Text(number,
                  style: GoogleFonts.inter(
                      color: kPrimaryLight,
                      fontSize: 11,
                      fontWeight: FontWeight.w800)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text,
                style: GoogleFonts.inter(
                    color: Colors.white70, fontSize: 13)),
          ),
        ],
      );
}
