import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'plan_catalog_screen.dart';
import 'shift_connection_screen.dart';
import 'wifi_settings_screen.dart';

class ServiceHubScreen extends StatelessWidget {
  const ServiceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final wifi = appState.wifi;
    final billing = appState.billing;
    final dashboard = appState.dashboard;
    final nq = appState.networkQuality;
    final session = appState.session;

    final ssid = wifi.ssid24.isEmpty
        ? '${session?.mobile ?? ''}_wifi'
        : wifi.ssid24;
    final planName = billing.currentPlan.isNotEmpty
        ? billing.currentPlan
        : (dashboard.planName.isNotEmpty ? dashboard.planName : 'No active plan');
    final isActive = !wifi.paused && planName != 'No active plan';
    final openItems =
        appState.requests.length + appState.tickets.length;

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refresh,
        child: CustomScrollView(
          slivers: [
            // ── Hero card ────────────────────────────────────────────
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                  child: _ServiceHeroCard(
                    ssid: ssid,
                    planName: planName,
                    isActive: isActive,
                    quality: nq.quality,
                    connectedDevices: wifi.connectedDevicesCount,
                    openItems: openItems,
                  ),
                ),
              ),
            ),

            // ── Quick actions ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('QUICK ACTIONS'),
                    const SizedBox(height: 10),
                    _actionCard(children: [
                      _ActionTile(
                        icon: Icons.router_rounded,
                        title: 'Wi-Fi Settings',
                        subtitle: 'Name, password, devices, guest & controls',
                        accent: kPrimaryLight,
                        onTap: () => _push(context, appState,
                            const WifiSettingsScreen()),
                      ),
                      _ActionTile(
                        icon: Icons.home_work_rounded,
                        title: 'Shift Connection',
                        subtitle:
                            'Move to a new address — pin location on map',
                        accent: const Color(0xFFFB923C),
                        onTap: () => _push(context, appState,
                            const ShiftConnectionScreen()),
                      ),
                      _ActionTile(
                        icon: Icons.auto_awesome_motion_rounded,
                        title: 'Change Plan',
                        subtitle: 'Upgrade or downgrade your service',
                        accent: const Color(0xFF34D399),
                        onTap: () => _push(
                            context, appState, const PlanCatalogScreen()),
                        last: true,
                      ),
                    ]),

                    const SizedBox(height: 22),

                    // ── Service health ──────────────────────────────────
                    _sectionLabel('SERVICE HEALTH'),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: _HealthTile(
                            icon: Icons.speed_rounded,
                            label: 'Quality',
                            value: nq.quality.isEmpty ? '—' : nq.quality,
                            accent: const Color(0xFF4ADE80),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _HealthTile(
                            icon: Icons.timer_rounded,
                            label: 'Latency',
                            value:
                                '${nq.latencyMs.toStringAsFixed(0)} ms',
                            accent: const Color(0xFF60A5FA),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _HealthTile(
                            icon: Icons.wifi_off_rounded,
                            label: 'Packet Loss',
                            value:
                                '${nq.packetLossPercent.toStringAsFixed(1)}%',
                            accent: const Color(0xFFFBBF24),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _HealthTile(
                            icon: Icons.track_changes_rounded,
                            label: 'Open Items',
                            value: '$openItems',
                            accent: const Color(0xFFF472B6),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 100),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  Widget _sectionLabel(String text) => Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: kMuted,
          letterSpacing: 1.6,
        ),
      );

  Widget _actionCard({required List<Widget> children}) => Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: kBorder),
        ),
        child: Column(children: children),
      );

  Future<void> _push(
      BuildContext context, AppState appState, Widget screen) async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => screen));
    if (context.mounted) await appState.refresh();
  }
}


// ── Hero Card ─────────────────────────────────────────────────────────────────

class _ServiceHeroCard extends StatelessWidget {
  const _ServiceHeroCard({
    required this.ssid,
    required this.planName,
    required this.isActive,
    required this.quality,
    required this.connectedDevices,
    required this.openItems,
  });

  final String ssid, planName, quality;
  final bool isActive;
  final int connectedDevices, openItems;

  @override
  Widget build(BuildContext context) {
    final statusColor =
        isActive ? const Color(0xFF34D399) : const Color(0xFFFBBF24);

    return Container(
      height: 290,
      decoration: BoxDecoration(
        color: const Color(0xFF12121A),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: const Color(0xFFA855F7).withValues(alpha: 0.25),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFA855F7).withValues(alpha: 0.15),
            blurRadius: 30,
            spreadRadius: -5,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // ── Large decorative router icon (image placeholder) ──
            Positioned(
              right: -40,
              bottom: 40,
              child: Opacity(
                opacity: 0.08,
                child: Icon(
                  Icons.router_rounded,
                  size: 220,
                  color: Colors.white,
                ),
              ),
            ),

            // ── Soft gradient orbs for depth ────────────────────────
            Positioned(
              top: -60,
              right: -40,
              child: Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFFA855F7).withValues(alpha: 0.18),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: -40,
              left: -30,
              child: Container(
                width: 140,
                height: 140,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF34D399).withValues(alpha: 0.10),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // ── Gradient overlay (left readable) ────────────────────
            Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0xFF12121A),
                    Color(0x0012121A),
                  ],
                  stops: [0.35, 1.0],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
              ),
            ),

            // ── Content ─────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 22, 22, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top row: status pill + quality pill
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: statusColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: statusColor.withValues(alpha: 0.35)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _PulseDot(
                              color: statusColor,
                              animate: isActive,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              isActive ? 'LIVE' : 'OFFLINE',
                              style: GoogleFonts.inter(
                                color: statusColor,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.8,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      if (quality.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.06),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.10)),
                          ),
                          child: Text(
                            quality,
                            style: GoogleFonts.inter(
                              color: Colors.white70,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                    ],
                  ),

                  const Spacer(),

                  // SSID + plan
                  Text(
                    ssid,
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.6,
                      height: 1.1,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.wifi_rounded,
                          color: Colors.white54, size: 13),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          planName,
                          style: GoogleFonts.inter(
                              color: Colors.white54, fontSize: 13),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 18),

                  // Glass bottom stat bar
                  Container(
                    padding: const EdgeInsets.symmetric(
                        vertical: 14, horizontal: 6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.08)),
                    ),
                    child: Row(
                      children: [
                        _glassStat('Devices', '$connectedDevices',
                            Icons.devices_rounded),
                        _glassDiv(),
                        _glassStat(
                            'Quality',
                            quality.isEmpty ? '—' : quality,
                            Icons.speed_rounded),
                        _glassDiv(),
                        _glassStat('Open', '$openItems',
                            Icons.track_changes_rounded),
                        _glassDiv(),
                        _glassStat(
                            isActive ? 'Online' : 'Paused',
                            isActive ? 'Active' : '—',
                            isActive
                                ? Icons.check_circle_rounded
                                : Icons.pause_circle_rounded),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _glassStat(String label, String value, IconData icon) => Expanded(
        child: Column(
          children: [
            Icon(icon, color: Colors.white38, size: 16),
            const SizedBox(height: 6),
            Text(value,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(label,
                style: GoogleFonts.inter(
                    color: Colors.white38,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5)),
          ],
        ),
      );

  Widget _glassDiv() => Container(
        width: 1,
        height: 36,
        color: Colors.white.withValues(alpha: 0.10),
      );
}

// ── Pulse Dot ─────────────────────────────────────────────────────────────────
//
// Tiny status indicator. When [animate] is true, a soft halo expands and fades
// outward continuously to convey a "live" feel.
class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.color, required this.animate});
  final Color color;
  final bool animate;

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    if (widget.animate) _ctrl.repeat();
  }

  @override
  void didUpdateWidget(covariant _PulseDot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animate && !_ctrl.isAnimating) {
      _ctrl.repeat();
    } else if (!widget.animate && _ctrl.isAnimating) {
      _ctrl.stop();
      _ctrl.value = 0;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 14,
      height: 14,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (widget.animate)
            AnimatedBuilder(
              animation: _ctrl,
              builder: (_, __) {
                final t = _ctrl.value;
                return Container(
                  width: 7 + 7 * t,
                  height: 7 + 7 * t,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: widget.color.withValues(alpha: 0.5 * (1 - t)),
                  ),
                );
              },
            ),
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: widget.color,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Action Tile ────────────────────────────────────────────────────────────────

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
    this.last = false,
  });

  final IconData icon;
  final String title, subtitle;
  final Color accent;
  final VoidCallback onTap;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        PressableScale(
          onTap: onTap,
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(13),
                    border:
                        Border.all(color: accent.withValues(alpha: 0.2)),
                  ),
                  child: Icon(icon, color: accent, size: 20),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: Colors.white)),
                      const SizedBox(height: 2),
                      Text(subtitle,
                          style: GoogleFonts.inter(
                              fontSize: 12,
                              color: kMuted,
                              height: 1.3)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded,
                    color: kMuted, size: 18),
              ],
            ),
          ),
        ),
        if (!last)
          const Divider(
              color: kBorder, height: 1, indent: 74, endIndent: 0),
      ],
    );
  }
}

// ── Health Tile ────────────────────────────────────────────────────────────────

class _HealthTile extends StatelessWidget {
  const _HealthTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
  });

  final IconData icon;
  final String label, value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: accent, size: 16),
          ),
          const SizedBox(height: 12),
          Text(
            value.isEmpty ? '—' : value,
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.5,
              height: 1.1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Colors.white60),
          ),
        ],
      ),
    );
  }
}

