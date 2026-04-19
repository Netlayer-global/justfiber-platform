import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'booking_flow_screen.dart';
import 'plan_catalog_screen.dart';
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
                        icon: Icons.add_home_work_rounded,
                        title: 'Book Connection',
                        subtitle: 'New broadband booking with plan & checkout',
                        accent: const Color(0xFF60A5FA),
                        onTap: () => _push(
                            context, appState, const BookingFlowScreen()),
                      ),
                      _ActionTile(
                        icon: Icons.home_work_rounded,
                        title: 'Shift Connection',
                        subtitle: 'Relocate your current broadband setup',
                        accent: const Color(0xFFFB923C),
                        onTap: () =>
                            _showShiftSheet(context, appState),
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

                    // ── Add-ons ─────────────────────────────────────────
                    if (appState.addons.isNotEmpty) ...[
                      const SizedBox(height: 22),
                      _sectionLabel('ADD-ONS'),
                      const SizedBox(height: 10),
                      ...appState.addons.take(3).map((addon) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _AddonCard(
                              name: addon.name,
                              description: addon.description,
                              onRequest: () => _requestAddon(
                                  context, appState, addon.name),
                            ),
                          )),
                    ],

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

  Future<void> _requestAddon(
      BuildContext context, AppState appState, String name) async {
    final req = await appState.submitServiceRequest(
        type: 'link_service', note: 'Interested in $name');
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(req == null
            ? (appState.error ?? 'Unable to submit add-on request')
            : '$name request created')));
    if (req != null) await appState.refresh();
  }

  Future<void> _showShiftSheet(
      BuildContext context, AppState appState) async {
    String mode = 'new_address';
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setLocal) => Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
          child: Container(
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: kBorder),
            ),
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // drag handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: kBorder,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text('Shift Wi-Fi',
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w800,
                        fontSize: 22,
                        color: Colors.white)),
                const SizedBox(height: 4),
                Text('Relocate your broadband connection.',
                    style: GoogleFonts.inter(
                        color: kMuted, fontSize: 13)),
                const SizedBox(height: 18),
                _shiftOption(
                  title: 'New address',
                  subtitle:
                      'Move your connection to a new location',
                  value: 'new_address',
                  groupValue: mode,
                  onChanged: (v) => setLocal(() => mode = v),
                ),
                const SizedBox(height: 10),
                _shiftOption(
                  title: 'Same address, different spot',
                  subtitle: 'Reroute within your current home',
                  value: 'same_address',
                  groupValue: mode,
                  onChanged: (v) => setLocal(() => mode = v),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy
                        ? null
                        : () async {
                            final req =
                                await appState.submitServiceRequest(
                              type: 'shift',
                              note: mode == 'new_address'
                                  ? 'Shift to new address'
                                  : 'Shift within same address',
                            );
                            if (!ctx.mounted) return;
                            Navigator.of(ctx).pop();
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              SnackBar(
                                  content: Text(req == null
                                      ? (appState.error ??
                                          'Unable to create request')
                                      : 'Shift request submitted')),
                            );
                            if (req != null) await appState.refresh();
                          },
                    child: const Text('Submit Request'),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _shiftOption({
    required String title,
    required String subtitle,
    required String value,
    required String groupValue,
    required ValueChanged<String> onChanged,
  }) {
    final selected = value == groupValue;
    return PressableScale(
      onTap: () => onChanged(value),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected
              ? kPrimary.withValues(alpha: 0.08)
              : kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: selected
                ? kPrimary.withValues(alpha: 0.5)
                : kBorder,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
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
                          color: kMuted, fontSize: 12)),
                ],
              ),
            ),
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? kPrimary : Colors.transparent,
                border: Border.all(
                  color: selected ? kPrimary : kMuted,
                  width: 2,
                ),
              ),
              child: selected
                  ? const Icon(Icons.check_rounded,
                      color: Colors.white, size: 12)
                  : null,
            ),
          ],
        ),
      ),
    );
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
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF8224E3),
        border: Border.all(color: const Color(0x55D8B4FE)),
        borderRadius: BorderRadius.circular(26),
      ),
      child: Stack(
        children: [
          // Decorative orb
          Positioned(
            top: -60,
            right: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.07),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status pill row
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(999),
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
                              color: isActive
                                  ? const Color(0xFF4ADE80)
                                  : const Color(0xFFFBBF24),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            isActive ? 'Active' : 'Paused',
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
                    if (quality.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          quality,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 18),

                // SSID + plan
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.router_rounded,
                          color: Colors.white, size: 26),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            ssid,
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.4,
                              height: 1.1,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              const Icon(Icons.wifi_rounded,
                                  color: Colors.white60, size: 12),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  planName,
                                  style: GoogleFonts.inter(
                                      color: Colors.white60,
                                      fontSize: 12),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Stats row
                Row(
                  children: [
                    _stat('Devices', '$connectedDevices'),
                    _statDiv(),
                    _stat('Quality',
                        quality.isEmpty ? '—' : quality),
                    _statDiv(),
                    _stat('Open', '$openItems'),
                    _statDiv(),
                    _stat(isActive ? 'Online' : 'Paused', ''),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String label, String value) => Expanded(
        child: Column(
          children: [
            if (value.isNotEmpty)
              Text(value,
                  style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3)),
            Text(
              label,
              style: GoogleFonts.inter(
                  color: Colors.white54,
                  fontSize: value.isEmpty ? 12 : 10,
                  fontWeight: value.isEmpty
                      ? FontWeight.w700
                      : FontWeight.w500),
            ),
          ],
        ),
      );

  Widget _statDiv() => Container(
        width: 1,
        height: 26,
        color: Colors.white.withValues(alpha: 0.18),
      );
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

// ── Add-on Card ────────────────────────────────────────────────────────────────

class _AddonCard extends StatelessWidget {
  const _AddonCard({
    required this.name,
    required this.description,
    required this.onRequest,
  });

  final String name, description;
  final VoidCallback onRequest;

  @override
  Widget build(BuildContext context) {
    return Container(
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
              color: kPrimary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(13),
              border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
            ),
            child: const Icon(Icons.add_box_rounded,
                color: kPrimaryLight, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: Colors.white)),
                const SizedBox(height: 2),
                Text(description,
                    style: GoogleFonts.inter(
                        fontSize: 12, color: kMuted, height: 1.3),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          const SizedBox(width: 10),
          PressableScale(
            onTap: onRequest,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border:
                    Border.all(color: kPrimary.withValues(alpha: 0.3)),
              ),
              child: Text('Request',
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: kPrimaryLight)),
            ),
          ),
        ],
      ),
    );
  }
}
