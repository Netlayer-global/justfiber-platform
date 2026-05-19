import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'plan_catalog_screen.dart';
import 'shift_connection_screen.dart';
import 'wifi_settings_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  SERVICES — Premium, matches home page quality.
//  Accent gradient hero + clean action list.
// ─────────────────────────────────────────────────────────────────────────────

class ServiceHubScreen extends StatelessWidget {
  const ServiceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final wifi = appState.wifi;
    final billing = appState.billing;
    final dashboard = appState.dashboard;
    final session = appState.session;

    final ssid = wifi.ssid24.isEmpty
        ? '${session?.mobile ?? ''}_wifi'
        : wifi.ssid24;
    final planName = billing.currentPlan.isNotEmpty
        ? billing.currentPlan
        : (dashboard.planName.isNotEmpty
            ? dashboard.planName
            : 'No active plan');
    final isActive = !wifi.paused && planName != 'No active plan';
    final connectedCount = appState.connectedDevices.isNotEmpty
        ? appState.connectedDevices.length
        : wifi.connectedDevicesCount;

    return Scaffold(
      backgroundColor: kBg,
      body: appState.wifiHeroImageUrl.isNotEmpty
          ? _buildWithHeroImage(context, appState, wifi, ssid, planName, isActive, connectedCount)
          : _buildWithoutHeroImage(context, appState, wifi, ssid, planName, isActive, connectedCount),
    );
  }

  Widget _buildWithHeroImage(
    BuildContext context,
    AppState appState,
    dynamic wifi,
    String ssid,
    String planName,
    bool isActive,
    int connectedCount,
  ) {
    final screenHeight = MediaQuery.of(context).size.height;
    final topPadding = MediaQuery.of(context).padding.top;

    return RefreshIndicator(
      color: kAccent,
      backgroundColor: const Color(0xFF0A0A14),
      onRefresh: appState.refresh,
      child: Stack(
        children: [
          // ── Full-screen background image ──────────────────────
          Positioned.fill(
            child: Image.network(
              appState.wifiHeroImageUrl,
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
              errorBuilder: (_, __, ___) => Container(color: kBg),
            ),
          ),
          // ── Gradient overlay — dark at bottom, subtle at top ──
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    kBg.withValues(alpha: 0.85),
                    kBg.withValues(alpha: 0.5),
                    Colors.transparent,
                    Colors.transparent,
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.1),
                  ],
                  stops: const [0.0, 0.3, 0.45, 0.65, 0.85, 1.0],
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                ),
              ),
            ),
          ),
          // ── Scrollable content ────────────────────────────────
          ListView(
            padding: EdgeInsets.only(top: topPadding + 16, bottom: 140),
            children: [
              // Title
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: Text(
                  'Services',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.6,
                  ),
                ),
              ),

              // Spacer to push content down — image visible in top half
              SizedBox(height: screenHeight * 0.52),

              // ── Wi-Fi info overlay on image ──────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Status row
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(kRPill),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.2)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isActive ? kSuccess : kDanger,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                isActive ? 'Active' : 'Offline',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '$connectedCount devices',
                          style: GoogleFonts.inter(
                            color: Colors.white.withValues(alpha: 0.75),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // SSID
                    Text(
                      'WI-FI NETWORK',
                      style: GoogleFonts.inter(
                        color: Colors.white.withValues(alpha: 0.5),
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.6,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      ssid,
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                        height: 1.1,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      planName,
                      style: GoogleFonts.inter(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 24),

                    // Wi-Fi Settings CTA
                    PressableScale(
                      onTap: () =>
                          _push(context, appState, const WifiSettingsScreen()),
                      haptic: true,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 15),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(kRButton),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.15),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Wi-Fi Settings',
                              style: GoogleFonts.inter(
                                color: kAccentDeep,
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Icon(Icons.arrow_forward_rounded,
                                color: kAccentDeep, size: 16),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),

              // ── Quick actions ──────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Eyebrow('MANAGE'),
                    const SizedBox(height: 14),
                    Container(
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(kRCard),
                        border: Border.all(color: kBorderSoft),
                      ),
                      child: Column(
                        children: [
                          _ActionRow(
                            icon: Icons.swap_horiz_rounded,
                            title: 'Shift Connection',
                            subtitle: 'Move to a new address',
                            onTap: () => _push(context, appState,
                                const ShiftConnectionScreen()),
                          ),
                          const _Div(),
                          _ActionRow(
                            icon: Icons.auto_awesome_motion_rounded,
                            title: 'Change Plan',
                            subtitle: 'Upgrade or downgrade your service',
                            onTap: () => _push(
                                context, appState, const PlanCatalogScreen()),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildWithoutHeroImage(
    BuildContext context,
    AppState appState,
    dynamic wifi,
    String ssid,
    String planName,
    bool isActive,
    int connectedCount,
  ) {
    return RefreshIndicator(
      color: kAccent,
      backgroundColor: const Color(0xFF0A0A14),
      onRefresh: appState.refresh,
      child: ListView(
        padding: EdgeInsets.only(
          top: MediaQuery.of(context).padding.top + 16,
          bottom: 140,
        ),
        children: [
          // ── Greeting ───────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Text(
              'Services',
              style: GoogleFonts.inter(
                color: kText,
                fontSize: 28,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.6,
              ),
            ),
          ),
          const SizedBox(height: 20),

          // ── Hero card — solid gradient ──────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(kRCard),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [kAccent, kAccentDeep],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(kRCard),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(kRPill),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.22)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isActive ? kSuccess : kDanger,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                isActive ? 'Active' : 'Offline',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '$connectedCount devices',
                          style: GoogleFonts.inter(
                            color: Colors.white.withValues(alpha: 0.8),
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'WI-FI NETWORK',
                      style: GoogleFonts.inter(
                        color: Colors.white.withValues(alpha: 0.7),
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.6,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      ssid,
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                        height: 1.15,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      planName,
                      style: GoogleFonts.inter(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 18),
                    PressableScale(
                      onTap: () =>
                          _push(context, appState, const WifiSettingsScreen()),
                      haptic: true,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(kRButton),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              'Wi-Fi Settings',
                              style: GoogleFonts.inter(
                                color: kAccentDeep,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: 6),
                            const Icon(Icons.arrow_forward_rounded,
                                color: kAccentDeep, size: 16),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 28),

          // ── Quick actions ──────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Eyebrow('MANAGE'),
                const SizedBox(height: 14),
                Container(
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(kRCard),
                    border: Border.all(color: kBorderSoft),
                  ),
                  child: Column(
                    children: [
                      _ActionRow(
                        icon: Icons.swap_horiz_rounded,
                        title: 'Shift Connection',
                        subtitle: 'Move to a new address',
                        onTap: () => _push(
                            context, appState, const ShiftConnectionScreen()),
                      ),
                      const _Div(),
                      _ActionRow(
                        icon: Icons.auto_awesome_motion_rounded,
                        title: 'Change Plan',
                        subtitle: 'Upgrade or downgrade your service',
                        onTap: () => _push(
                            context, appState, const PlanCatalogScreen()),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _push(
      BuildContext context, AppState appState, Widget screen) async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => screen));
    if (context.mounted) await appState.refresh();
  }
}

// ═══════════════════════════════════════════════════════════════════════════

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 2),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: kTextMuted,
          letterSpacing: 1.6,
        ),
      ),
    );
  }
}

class _Div extends StatelessWidget {
  const _Div();
  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 18),
      child: Divider(color: kBorderSoft, height: 1, thickness: 1),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      haptic: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: kAccentSoft,
                borderRadius: BorderRadius.circular(kRSmall),
              ),
              child: Icon(icon, color: kAccent, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      color: kText,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      color: kTextMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: kTextFaint, size: 18),
          ],
        ),
      ),
    );
  }
}
