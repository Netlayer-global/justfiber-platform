import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/pressable_scale.dart';
import '../wifi_settings_screen.dart';

class ShopTab extends StatelessWidget {
  const ShopTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final wifi = appState.wifi;
    final devices = appState.connectedDevices;
    final quality = appState.networkQuality;
    final blockedCount = devices.where((d) => d.blocked).length;

    return ListView(
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 18,
        left: 18,
        right: 18,
        bottom: 100,
      ),
      children: [
        // Hero card
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF8224E3),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: const Color(0x55A855F7)),
          ),
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.wifi_rounded,
                        color: Colors.white, size: 26),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          wifi.ssid24.isEmpty ? 'Not configured' : wifi.ssid24,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.3,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          'Signal quality: ${quality.quality.isEmpty ? '—' : quality.quality}',
                          style: GoogleFonts.inter(
                              color: Colors.white60, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: wifi.paused
                                ? const Color(0xFFFBBF24)
                                : const Color(0xFF4ADE80),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          wifi.paused ? 'Paused' : 'Online',
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  _stat('Devices', '${wifi.connectedDevicesCount}'),
                  _statDiv(),
                  _stat(
                      'Allowed', '${devices.where((d) => !d.blocked).length}'),
                  _statDiv(),
                  _stat('Blocked', '$blockedCount'),
                  _statDiv(),
                  _stat('Guest', wifi.guestEnabled ? 'On' : 'Off'),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: PressableScale(
                      onTap: () async {
                        await Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => const WifiSettingsScreen()));
                        if (context.mounted) await appState.refresh();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2)),
                        ),
                        alignment: Alignment.center,
                        child: Text('Wi-Fi Settings',
                            style: GoogleFonts.inter(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: PressableScale(
                      onTap: () async {
                        await Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => const WifiSettingsScreen(
                                initialAction:
                                    WifiLaunchAction.parentalControls)));
                        if (context.mounted) await appState.refresh();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2)),
                        ),
                        alignment: Alignment.center,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.shield_rounded,
                                color: Colors.white, size: 14),
                            const SizedBox(width: 5),
                            Text('Parental',
                                style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13)),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 22),
        _sectionLabel('NETWORK QUALITY'),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _StatTile(
                  icon: Icons.speed_rounded,
                  label: 'Quality',
                  value: quality.quality.isEmpty ? '—' : quality.quality,
                  accent: const Color(0xFF4ADE80)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatTile(
                  icon: Icons.timer_rounded,
                  label: 'Latency',
                  value: '${quality.latencyMs.toStringAsFixed(0)} ms',
                  accent: const Color(0xFF60A5FA)),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _StatTile(
                  icon: Icons.wifi_off_rounded,
                  label: 'Packet Loss',
                  value: '${quality.packetLossPercent.toStringAsFixed(1)}%',
                  accent: const Color(0xFFFBBF24)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _StatTile(
                  icon: Icons.graphic_eq_rounded,
                  label: 'Jitter',
                  value: '${quality.jitterMs.toStringAsFixed(0)} ms',
                  accent: kPrimaryLight),
            ),
          ],
        ),

        const SizedBox(height: 22),
        _sectionLabel('SPEED TEST'),
        const SizedBox(height: 10),
        _SpeedTestCard(
          speedTest: appState.speedTest,
          busy: appState.speedTestBusy,
          error: appState.speedTestError,
          onRun: appState.runSpeedTest,
        ),

        if (devices.isNotEmpty) ...[
          const SizedBox(height: 22),
          _sectionLabel('CONNECTED DEVICES'),
          const SizedBox(height: 10),
          ...devices.take(5).map((d) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: kBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: kPrimary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Icon(
                          d.connectionType.toLowerCase().contains('ethernet')
                              ? Icons.settings_ethernet_rounded
                              : Icons.smartphone_rounded,
                          color: kPrimaryLight,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(d.name,
                                style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                    fontSize: 13)),
                            Text('${d.connectionType} · ${d.signal}',
                                style: GoogleFonts.inter(
                                    fontSize: 11, color: kMuted)),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: d.blocked
                              ? const Color(0x22EF4444)
                              : const Color(0x224ADE80),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: d.blocked
                                  ? const Color(0x44EF4444)
                                  : const Color(0x444ADE80)),
                        ),
                        child: Text(
                          d.blocked ? 'Blocked' : 'Active',
                          style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: d.blocked
                                  ? const Color(0xFFFF8A8A)
                                  : const Color(0xFF4ADE80)),
                        ),
                      ),
                    ],
                  ),
                ),
              )),
        ],
      ],
    );
  }

  Widget _sectionLabel(String t) => Text(
        t,
        style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: kMuted,
            letterSpacing: 1.6),
      );

  Widget _stat(String label, String value) => Expanded(
        child: Column(children: [
          Text(value,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label,
              style: GoogleFonts.inter(
                  color: Colors.white54,
                  fontSize: 10,
                  fontWeight: FontWeight.w500)),
        ]),
      );

  Widget _statDiv() => Container(
      width: 1, height: 24, color: Colors.white.withValues(alpha: 0.18));
}

class _StatTile extends StatelessWidget {
  const _StatTile({
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
        borderRadius: BorderRadius.circular(18),
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
          const SizedBox(height: 10),
          Text(value,
              style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -0.4)),
          const SizedBox(height: 3),
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 11,
                  color: Colors.white60,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _SpeedTestCard extends StatelessWidget {
  const _SpeedTestCard({
    required this.speedTest,
    required this.busy,
    required this.error,
    required this.onRun,
  });

  final SpeedTestData speedTest;
  final bool busy;
  final String? error;
  final VoidCallback onRun;

  bool get _hasResult => speedTest.downloadMbps > 0 || speedTest.uploadMbps > 0;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_hasResult && !busy) ...[
            Row(
              children: [
                Expanded(
                  child: _SpeedTile(
                    icon: Icons.download_rounded,
                    label: 'Download',
                    value: speedTest.downloadMbps.toStringAsFixed(1),
                    unit: 'Mbps',
                    accent: const Color(0xFF4ADE80),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _SpeedTile(
                    icon: Icons.upload_rounded,
                    label: 'Upload',
                    value: speedTest.uploadMbps.toStringAsFixed(1),
                    unit: 'Mbps',
                    accent: const Color(0xFF60A5FA),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _SpeedTile(
                    icon: Icons.timer_rounded,
                    label: 'Latency',
                    value: speedTest.latencyMs.toStringAsFixed(0),
                    unit: 'ms',
                    accent: kPrimaryLight,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
          ],
          if (error != null && !busy) ...[
            Text(
              error!,
              style: GoogleFonts.inter(
                  color: const Color(0xFFFF8A8A),
                  fontSize: 12,
                  height: 1.4),
            ),
            const SizedBox(height: 10),
          ],
          PressableScale(
            onTap: busy ? null : onRun,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: busy ? 0.05 : 0.12),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
              ),
              alignment: Alignment.center,
              child: busy
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                                kPrimaryLight.withValues(alpha: 0.7)),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text('Running speed test...',
                            style: GoogleFonts.inter(
                                color: kMuted,
                                fontWeight: FontWeight.w600,
                                fontSize: 13)),
                      ],
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.speed_rounded,
                            color: kPrimaryLight, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          _hasResult ? 'Run Again' : 'Run Speed Test',
                          style: GoogleFonts.inter(
                              color: kPrimaryLight,
                              fontWeight: FontWeight.w700,
                              fontSize: 13),
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpeedTile extends StatelessWidget {
  const _SpeedTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.unit,
    required this.accent,
  });

  final IconData icon;
  final String label, value, unit;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: accent, size: 15),
        ),
        const SizedBox(height: 8),
        Text(value,
            style: GoogleFonts.inter(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Colors.white,
                letterSpacing: -0.4)),
        Text(unit,
            style: GoogleFonts.inter(
                fontSize: 10, color: accent, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(label,
            style: GoogleFonts.inter(fontSize: 10, color: Colors.white60)),
      ],
    );
  }
}
