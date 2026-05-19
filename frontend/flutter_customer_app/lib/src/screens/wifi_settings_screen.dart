import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';

enum WifiLaunchAction {
  devices,
  guest,
}

class WifiSettingsScreen extends StatefulWidget {
  const WifiSettingsScreen({super.key, this.initialAction});

  final WifiLaunchAction? initialAction;

  @override
  State<WifiSettingsScreen> createState() => _WifiSettingsScreenState();
}

class _WifiSettingsScreenState extends State<WifiSettingsScreen> {
  final _nameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _guestSsidController = TextEditingController();
  final _guestPasswordController = TextEditingController();
  String? _lastSyncedSsid;
  String? _lastSyncedGuestSsid;
  bool _handledInitialAction = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final appState = AppStateScope.of(context);
    if (_lastSyncedSsid != appState.wifi.ssid24) {
      _nameController.text = appState.wifi.ssid24;
      _lastSyncedSsid = appState.wifi.ssid24;
    }
    if (_lastSyncedGuestSsid != appState.wifi.guestSsid) {
      _guestSsidController.text = appState.wifi.guestSsid;
      _lastSyncedGuestSsid = appState.wifi.guestSsid;
    }
    if (!_handledInitialAction && widget.initialAction != null) {
      _handledInitialAction = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        switch (widget.initialAction!) {
          case WifiLaunchAction.devices:
            _showConnectedDevices(context, AppStateScope.of(context));
            break;
          case WifiLaunchAction.guest:
            _showGuestWifiSheet(context, AppStateScope.of(context));
            break;
        }
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _passwordController.dispose();
    _guestSsidController.dispose();
    _guestPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final wifi = appState.wifi;
    final ssidLabel = wifi.ssid24.isEmpty ? 'Not configured' : wifi.ssid24;
    final connectedCount = appState.connectedDevices.isNotEmpty
        ? appState.connectedDevices.length
        : wifi.connectedDevicesCount;

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refresh,
        child: CustomScrollView(
          slivers: [
            // ── Hero header ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 16, 22, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Back button + title
                      Row(
                        children: [
                          PressableScale(
                            onTap: () => Navigator.of(context).pop(),
                            haptic: true,
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: kSurface,
                                borderRadius: BorderRadius.circular(kRSmall),
                                border: Border.all(color: kBorderSoft),
                              ),
                              child: const Icon(Icons.arrow_back_rounded,
                                  color: kText, size: 18),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Text(
                            'Wi-Fi Settings',
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.4,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 22),

                      // Simple hero card — SSID + status + pause button
                      ClipRRect(
                        borderRadius: BorderRadius.circular(kRCard),
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [kAccent, kAccentDeep],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(kRCard),
                          ),
                          child: Padding(
                                padding: const EdgeInsets.all(20),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Container(
                                          width: 48,
                                          height: 48,
                                          decoration: BoxDecoration(
                                            color: Colors.white.withValues(alpha: 0.18),
                                            borderRadius: BorderRadius.circular(14),
                                            border: Border.all(
                                                color: Colors.white.withValues(alpha: 0.25)),
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
                                                ssidLabel,
                                                style: GoogleFonts.inter(
                                                  color: Colors.white,
                                                  fontSize: 20,
                                                  fontWeight: FontWeight.w800,
                                                  letterSpacing: -0.3,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              const SizedBox(height: 4),
                                              Row(
                                                children: [
                                                  Container(
                                                    width: 7,
                                                    height: 7,
                                                    decoration: BoxDecoration(
                                                      shape: BoxShape.circle,
                                                      color: wifi.paused
                                                          ? const Color(0xFFFBBF24)
                                                          : kSuccess,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    wifi.paused ? 'Paused' : 'Online',
                                                    style: GoogleFonts.inter(
                                                      color: Colors.white.withValues(alpha: 0.9),
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w600,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 12),
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
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 16),
                                    // Pause/Resume button
                                    PressableScale(
                                      onTap: () => _showPauseSheet(context, appState),
                                      haptic: true,
                                      child: Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.symmetric(vertical: 13),
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(alpha: 0.15),
                                          borderRadius: BorderRadius.circular(kRSmall),
                                          border: Border.all(
                                              color: Colors.white.withValues(alpha: 0.25)),
                                        ),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(
                                              wifi.paused
                                                  ? Icons.play_arrow_rounded
                                                  : Icons.pause_rounded,
                                              color: Colors.white,
                                              size: 18,
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                              wifi.paused ? 'Resume Wi-Fi' : 'Pause Wi-Fi',
                                              style: GoogleFonts.inter(
                                                color: Colors.white,
                                                fontSize: 14,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Actions grid ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(22, 22, 22, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('MANAGE'),
                    const SizedBox(height: 14),
                    Container(
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(kRCard),
                        border: Border.all(color: kBorderSoft),
                      ),
                      child: Column(
                        children: [
                          _ActionTile(
                            icon: Icons.password_rounded,
                            title: 'Wi-Fi name & password',
                            subtitle:
                                'Rename network and set a stronger password',
                            accentColor: kAccent,
                            onTap: () => _showRenameSheet(context, appState),
                          ),
                          _divider(),
                          _ActionTile(
                            icon: Icons.tune_rounded,
                            title: 'Run diagnostics',
                            subtitle:
                                'Speed, latency, packet loss & optical quality',
                            accentColor: kAccent,
                            onTap: () =>
                                _showDiagnosticsSheet(context, appState),
                          ),
                          _divider(),
                          _ActionTile(
                            icon: Icons.devices_rounded,
                            title: 'Connected devices',
                            subtitle:
                                'View and block / unblock devices',
                            accentColor: kAccent,
                            onTap: () => _showConnectedDevices(context, appState),
                          ),
                          _divider(),
                          _ActionTile(
                            icon: Icons.wifi_tethering_rounded,
                            title: 'Guest Wi-Fi',
                            subtitle:
                                'Separate network for guests',
                            accentColor: kAccent,
                            onTap: () =>
                                _showGuestWifiSheet(context, appState),
                            badge: wifi.guestEnabled ? 'ON' : null,
                            badgeColor: kSuccess,
                          ),
                          _divider(),
                          _ActionTile(
                            icon: Icons.restart_alt_rounded,
                            title: 'Restart router',
                            subtitle:
                                'Remotely reboot your router',
                            accentColor: kAccent,
                            onTap: () => _showRestartSheet(context, appState),
                            last: true,
                          ),
                        ],
                      ),
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

  Widget _divider() => const Divider(
        color: kBorder,
        height: 1,
        indent: 60,
        endIndent: 0,
      );

  Widget _sectionLabel(String text) => Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: kMuted,
          letterSpacing: 1.6,
        ),
      );

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  String _internetStatusLabel(AppState appState) {
    final selectedId = appState.selectedCustomerId;
    final conn = appState.connections.cast<dynamic>().firstWhere(
          (c) => c?.customerId == selectedId,
          orElse: () =>
              appState.connections.isNotEmpty ? appState.connections.first : null,
        );
    final status = (conn?.onlineStatus ?? '').toString().trim().toLowerCase();
    if (status == 'online') return 'Online';
    if (status == 'offline') return 'Offline';
    if (status.isEmpty) return 'Unknown';
    return status[0].toUpperCase() + status.substring(1);
  }

  IconData _deviceIcon(String type) {
    final t = type.toLowerCase();
    if (t.contains('tv')) return Icons.tv_rounded;
    if (t.contains('phone') || t.contains('mobile')) {
      return Icons.smartphone_rounded;
    }
    if (t.contains('laptop') || t.contains('pc')) return Icons.laptop_mac_rounded;
    if (t.contains('ethernet') || t.contains('lan') || t.contains('wired')) {
      return Icons.settings_ethernet_rounded;
    }
    return Icons.devices_other_rounded;
  }

  String _connTypeLabel(String t) {
    final s = t.trim();
    if (s.isEmpty) return 'Unknown';
    return s[0].toUpperCase() + s.substring(1);
  }

  // ─── Sheets ───────────────────────────────────────────────────────────────────

  Future<void> _showPauseSheet(BuildContext context, AppState appState) async {
    final wifi = appState.wifi;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF101018),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: kBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: (wifi.paused ? kPrimary : const Color(0xFFEF4444))
                      .withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  wifi.paused
                      ? Icons.play_circle_fill_rounded
                      : Icons.pause_circle_filled_rounded,
                  size: 38,
                  color: wifi.paused ? kPrimaryLight : const Color(0xFFFF6B6B),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                wifi.paused
                    ? 'Resume internet?'
                    : 'Pause internet?',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800,
                    fontSize: 22,
                    color: Colors.white),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                wifi.paused
                    ? 'Your router and service will start working again after confirmation.'
                    : 'This will temporarily disable active internet access until you resume it.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                    color: kMuted, height: 1.5, fontSize: 13),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: appState.busy
                      ? null
                      : () async {
                          messenger
                            ..hideCurrentSnackBar()
                            ..showSnackBar(SnackBar(
                              content: Text(wifi.paused
                                  ? 'Resuming Wi-Fi...'
                                  : 'Pausing Wi-Fi...'),
                              duration: const Duration(seconds: 20),
                            ));
                          navigator.pop();
                          final ok =
                              await appState.toggleWifiPause(!wifi.paused);
                          messenger.hideCurrentSnackBar();
                          messenger.showSnackBar(SnackBar(
                            content: Text(ok
                                ? (wifi.paused
                                    ? 'Wi-Fi resumed'
                                    : 'Wi-Fi paused')
                                : (appState.error ??
                                    'Unable to update Wi-Fi')),
                          ));
                        },
                  child: Text(wifi.paused ? 'Resume Now' : 'Pause Now'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showRenameSheet(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setLocal) {
          bool submitting = false;
          return Padding(
            padding: EdgeInsets.fromLTRB(
                12, 16, 12, 12 + MediaQuery.of(ctx).viewInsets.bottom),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF101018),
            borderRadius: BorderRadius.circular(28),
                border: Border.all(color: kBorder),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Wi-Fi name & password',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                          color: Colors.white)),
                  const SizedBox(height: 6),
                  Text(
                      'Rename your network and set a stronger password.',
                      style: GoogleFonts.inter(
                          color: kMuted, height: 1.5, fontSize: 13)),
                  const SizedBox(height: 18),
                  TextField(
                    controller: _nameController,
                    enabled: !submitting,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration:
                        const InputDecoration(labelText: 'Wi-Fi name'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _passwordController,
                    enabled: !submitting,
                    style: GoogleFonts.inter(color: Colors.white),
                    obscureText: true,
                    decoration:
                        const InputDecoration(labelText: 'Password'),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: submitting
                          ? null // ignore: dead_code
                          : () async {
                              final ssid = _nameController.text.trim();
                              final pw = _passwordController.text.trim();
                              if (ssid.isEmpty) {
                                ScaffoldMessenger.of(ctx).showSnackBar(
                                    const SnackBar(
                                        content: Text(
                                            'Enter a Wi-Fi name first.')));
                                return;
                              }
                              if (pw.length < 8) {
                                messenger.showSnackBar(const SnackBar(
                                    content: Text(
                                        'Password must be at least 8 characters.')));
                                return;
                              }
                              setLocal(() => submitting = true);
                              messenger
                                ..hideCurrentSnackBar()
                                ..showSnackBar(const SnackBar(
                                    content: Text('Saving Wi-Fi details...'),
                                    duration: Duration(seconds: 20)));
                              navigator.pop();
                              final ok =
                                  await appState.changeWifiPasswordAndRefresh(
                                      password: pw, ssid24: ssid, ssid5: ssid);
                              messenger.hideCurrentSnackBar();
                              messenger.showSnackBar(SnackBar(
                                  content: Text(ok
                                      ? 'Wi-Fi updated'
                                      : (appState.error ?? 'Update failed'))));
                            },
                      child:
                          Text(submitting ? 'Saving...' : 'Save Changes'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _showDiagnosticsSheet(
      BuildContext context, AppState appState) async {
    // Data-exhausted gate: if FUP cap reached, show alert before diagnostics
    final billing = appState.billing;
    if (billing.usageCapReached && billing.usageCapGb > 0) {
      final proceed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: kSurface,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20)),
          title: Row(children: [
            const Icon(Icons.warning_amber_rounded,
                color: Color(0xFFFBBF24)),
            const SizedBox(width: 8),
            Text('Data exhausted',
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w800)),
          ]),
          content: Text(
            'You have used ${billing.usageGb.toStringAsFixed(1)} GB of your ${billing.usageCapGb.toStringAsFixed(0)} GB FUP quota. Speeds may be reduced until your next billing cycle.',
            style: GoogleFonts.inter(color: kMuted, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Close'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Run anyway'),
            ),
          ],
        ),
      );
      if (proceed != true) return;
      if (!context.mounted) return;
    }
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF101018),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: kBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Diagnostics',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                          color: Colors.white)),
                  FilledButton.icon(
                    onPressed: appState.busy
                        ? null
                        : () async {
                            await appState.refresh();
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                            await _showDiagnosticsSheet(context, appState);
                          },
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('Refresh'),
                    style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 8),
                        textStyle: const TextStyle(fontSize: 13)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Stat chips row
              Row(
                children: [
                  _diagChip(
                      Icons.wifi_rounded, _internetStatusLabel(appState),
                      color: const Color(0xFF4ADE80)),
                  const SizedBox(width: 8),
                  _diagChip(Icons.speed_rounded,
                      appState.networkQuality.quality,
                      color: kPrimaryLight),
                  const SizedBox(width: 8),
                  _diagChip(Icons.devices_rounded,
                      '${appState.wifi.connectedDevicesCount} dev',
                      color: const Color(0xFFA78BFA)),
                ],
              ),
              const SizedBox(height: 16),
              _diagRow('Internet',
                  _internetStatusLabel(appState)),
              _diagRow('Latency',
                  '${appState.networkQuality.latencyMs.toStringAsFixed(0)} ms'),
              _diagRow('Packet loss',
                  '${appState.networkQuality.packetLossPercent.toStringAsFixed(1)} %'),
              _diagRow('Jitter',
                  '${appState.networkQuality.jitterMs.toStringAsFixed(0)} ms'),
              _diagRow('Optical RX',
                  '${appState.networkQuality.opticalRxPower.toStringAsFixed(1)} dBm'),
              _diagRow('Overall quality',
                  appState.networkQuality.quality, last: true),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showConnectedDevices(
      BuildContext context, AppState appState) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) {
        String query = '';
        bool blockedOnly = false;
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
          child: StatefulBuilder(
            builder: (ctx, setLocal) => AnimatedBuilder(
              animation: appState,
              builder: (_, __) {
                final devices = appState.connectedDevices;
                final hasLive = devices.isNotEmpty;
                final display = hasLive
                    ? devices
                    : List.generate(
                        appState.wifi.connectedDevicesCount,
                        (i) => ConnectedDevice(
                          clientId: 'anon-$i',
                          name: 'Device ${i + 1}',
                          connectionType: 'wifi',
                          signal: 'unavailable',
                          blocked: false,
                        ));
                final filtered = display.where((d) {
                  final q = query.trim().toLowerCase();
                  final mQ = q.isEmpty ||
                      d.name.toLowerCase().contains(q) ||
                      _connTypeLabel(d.connectionType)
                          .toLowerCase()
                          .contains(q);
                  final mB = !blockedOnly || d.blocked;
                  return mQ && mB;
                }).toList();

                return Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFF101018),
            borderRadius: BorderRadius.circular(28),
                    border: Border.all(color: kBorder),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Connected devices',
                          style: GoogleFonts.inter(
                              fontWeight: FontWeight.w800,
                              fontSize: 22,
                              color: Colors.white)),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          _statPill(
                              'Connected', '${display.length}',
                              const Color(0xFF4ADE80)),
                          const SizedBox(width: 8),
                          _statPill('Allowed',
                              '${display.where((d) => !d.blocked).length}',
                              kPrimaryLight),
                          const SizedBox(width: 8),
                          _statPill('Blocked',
                              '${display.where((d) => d.blocked).length}',
                              const Color(0xFFFF6B6B)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        onChanged: (v) => setLocal(() => query = v),
                        style: GoogleFonts.inter(color: Colors.white),
                        decoration: const InputDecoration(
                          labelText: 'Search device',
                          prefixIcon: Icon(Icons.search_rounded,
                              color: kPrimaryLight, size: 20),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _filterChip('All', !blockedOnly,
                              () => setLocal(() => blockedOnly = false)),
                          const SizedBox(width: 8),
                          _filterChip('Blocked only', blockedOnly,
                              () => setLocal(() => blockedOnly = true)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (!hasLive && display.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Text(
                            'Device names unavailable — router is counting connections only.',
                            style: GoogleFonts.inter(
                                color: kMuted,
                                fontSize: 12,
                                height: 1.4),
                          ),
                        ),
                      if (filtered.isEmpty)
                        Padding(
                          padding:
                              const EdgeInsets.symmetric(vertical: 16),
                          child: Text('No devices match.',
                              style: GoogleFonts.inter(color: kMuted)),
                        )
                      else
                        ...filtered.map((d) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _DeviceRow(
                                device: d,
                                icon: _deviceIcon(d.connectionType),
                                typeLabel: _connTypeLabel(d.connectionType),
                                hasLive: hasLive,
                                busy: appState.busy,
                                onToggle: () async {
                                  final ok = await appState.setDeviceBlocked(
                                      d.clientId, !d.blocked);
                                  if (!ctx.mounted) return;
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(
                                        content: Text(ok
                                            ? (d.blocked
                                                ? 'Internet restored'
                                                : 'Internet paused')
                                            : (appState.error ??
                                                'Unable to update'))),
                                  );
                                },
                              ),
                            )),
                      const SizedBox(height: 4),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton(
                          onPressed: appState.busy
                              ? null
                              : () async {
                                  await appState.refresh();
                                  if (!ctx.mounted) return;
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                      const SnackBar(
                                          content:
                                              Text('Device list refreshed')));
                                },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: BorderSide(
                                color: kPrimary.withValues(alpha: 0.4)),
                          ),
                          child: const Text('Refresh'),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _showGuestWifiSheet(
      BuildContext context, AppState appState) async {
    final wifi = appState.wifi;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    _guestSsidController.text = wifi.guestSsid;
    _guestPasswordController.text = '';
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setLocal) {
          bool enabled = wifi.guestEnabled;
          bool submitting = false;
          return Padding(
            padding: EdgeInsets.fromLTRB(
                12, 16, 12, 12 + MediaQuery.of(ctx).viewInsets.bottom),
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF101018),
            borderRadius: BorderRadius.circular(28),
                border: Border.all(color: kBorder),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Guest Wi-Fi',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                          color: Colors.white)),
                  const SizedBox(height: 6),
                  Text(
                      'Create a separate network for visitors.',
                      style: GoogleFonts.inter(
                          color: kMuted, height: 1.5, fontSize: 13)),
                  const SizedBox(height: 14),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('Enable guest network',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w700)),
                    subtitle: Text(
                        'Separate guests from your main network',
                        style: GoogleFonts.inter(
                            color: kMuted, fontSize: 12)),
                    value: enabled,
                    activeThumbColor: kPrimary,
                    onChanged: (v) => setLocal(() => enabled = v),
                  ),
                  TextField(
                    controller: _guestSsidController,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration: const InputDecoration(
                        labelText: 'Guest Wi-Fi name'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _guestPasswordController,
                    style: GoogleFonts.inter(color: Colors.white),
                    obscureText: true,
                    decoration: const InputDecoration(
                        labelText: 'Guest password'),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: submitting
                          ? null // ignore: dead_code
                          : () async {
                              final gSsid =
                                  _guestSsidController.text.trim();
                              final gPw =
                                  _guestPasswordController.text.trim();
                              if (enabled && gSsid.isEmpty) {
                                messenger.showSnackBar(const SnackBar(
                                    content: Text(
                                        'Enter a guest Wi-Fi name.')));
                                return;
                              }
                              if (enabled && gPw.length < 8) {
                                messenger.showSnackBar(const SnackBar(
                                    content: Text(
                                        'Guest password must be 8+ characters.')));
                                return;
                              }
                              setLocal(() => submitting = true);
                              messenger
                                ..hideCurrentSnackBar()
                                ..showSnackBar(const SnackBar(
                                    content:
                                        Text('Saving guest Wi-Fi...'),
                                    duration: Duration(seconds: 20)));
                              navigator.pop();
                              final ok =
                                  await appState.updateGuestWifi(
                                      enabled: enabled,
                                      ssid: gSsid,
                                      password: gPw);
                              messenger.hideCurrentSnackBar();
                              messenger.showSnackBar(SnackBar(
                                  content: Text(ok
                                      ? 'Guest Wi-Fi updated'
                                      : (appState.error ??
                                          'Unable to update guest Wi-Fi'))));
                            },
                      child: Text(
                          submitting ? 'Saving...' : 'Save Guest Wi-Fi'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _showRestartSheet(
      BuildContext context, AppState appState) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF101018),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: kBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: kPrimary.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.router_rounded,
                    color: kPrimaryLight, size: 34),
              ),
              const SizedBox(height: 16),
              Text(
                'Restart router?',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800,
                    fontSize: 22,
                    color: Colors.white),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'This may take a few minutes. Wi-Fi will be affected during the restart.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(
                    color: kMuted, height: 1.5, fontSize: 13),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: appState.busy
                      ? null
                      : () async {
                          final ok = await appState.rebootRouter();
                          if (!context.mounted) return;
                          Navigator.of(context).pop();
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                              content: Text(ok
                                  ? 'Router restart requested'
                                  : (appState.error ??
                                      'Unable to restart router'))));
                        },
                  child: const Text('Restart Now'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(
                        color: kPrimary.withValues(alpha: 0.3)),
                  ),
                  child: const Text('Maybe Later'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ─── Micro-widget helpers ─────────────────────────────────────────────────────

  Widget _diagChip(IconData icon, String label, {required Color color}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(height: 3),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: color)),
          ],
        ),
      ),
    );
  }

  Widget _diagRow(String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
            bottom: last
                ? BorderSide.none
                : const BorderSide(color: kBorder)),
      ),
      child: Row(
        children: [
          Expanded(
              child: Text(label,
                  style:
                      GoogleFonts.inter(color: kMuted, fontSize: 13))),
          Text(value,
              style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  fontSize: 13)),
        ],
      ),
    );
  }

  Widget _statPill(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Text(value,
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: color)),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 9,
                    color: kMuted,
                    fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(
      String label, bool selected, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? kPrimary.withValues(alpha: 0.15)
              : kSurface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
              color: selected
                  ? kPrimary.withValues(alpha: 0.4)
                  : kBorder),
        ),
        child: Text(label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? kPrimaryLight : kMuted,
            )),
      ),
    );
  }

}

// ── WiFi Hero Card ────────────────────────────────────────────────────────────

class _WifiHeroCard extends StatelessWidget {
  const _WifiHeroCard({
    required this.ssid,
    required this.isPaused,
    required this.quality,
    required this.connectedCount,
    required this.blockedCount,
    required this.guestEnabled,
    required this.onPause,
    this.heroImageUrl = '',
  });

  final String ssid, quality;
  final bool isPaused, guestEnabled;
  final int connectedCount, blockedCount;
  final VoidCallback onPause;
  final String heroImageUrl;

  int _signalBars(String q) {
    final s = q.toLowerCase();
    if (s.contains('excellent') || s.contains('great')) return 4;
    if (s.contains('good')) return 3;
    if (s.contains('fair') || s.contains('average')) return 2;
    if (s.contains('poor') || s.contains('weak')) return 1;
    return 3;
  }

  @override
  Widget build(BuildContext context) {
    final bars = _signalBars(quality);
    final qualityColor = bars >= 3
        ? const Color(0xFF4ADE80)
        : bars == 2
            ? const Color(0xFFFBBF24)
            : const Color(0xFFEF4444);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF13051F), Color(0xFF6D28D9), Color(0xFFA855F7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0x55D8B4FE)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFA855F7).withValues(alpha: 0.25),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          // Background hero image (admin-uploadable)
          if (heroImageUrl.isNotEmpty)
            Positioned.fill(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(26),
                child: Image.network(
                  heroImageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),
            ),
          // Dark overlay for readability when image is present
          if (heroImageUrl.isNotEmpty)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(26),
                  gradient: LinearGradient(
                    colors: [
                      Colors.black.withValues(alpha: 0.6),
                      Colors.black.withValues(alpha: 0.25),
                    ],
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                  ),
                ),
              ),
            ),
          // Decorative orbs
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
                    Colors.white.withValues(alpha: 0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            left: -40,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    qualityColor.withValues(alpha: 0.15),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status pill + Pause/Resume action
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
                          _WifiPulseDot(
                            color: isPaused
                                ? const Color(0xFFFBBF24)
                                : const Color(0xFF4ADE80),
                            animate: !isPaused,
                          ),
                          const SizedBox(width: 5),
                          Text(
                            isPaused ? 'PAUSED' : 'ONLINE',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    PressableScale(
                      onTap: onPause,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.25)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              isPaused
                                  ? Icons.play_arrow_rounded
                                  : Icons.pause_rounded,
                              color: Colors.white,
                              size: 14,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              isPaused ? 'Resume' : 'Pause',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // SSID + signal bars
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(15),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.18)),
                      ),
                      child: const Icon(Icons.wifi_rounded,
                          color: Colors.white, size: 28),
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
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              _SignalBars(level: bars, color: qualityColor),
                              const SizedBox(width: 8),
                              Text(
                                quality.isEmpty ? 'Unknown' : quality,
                                style: GoogleFonts.inter(
                                    color: qualityColor,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Stat tiles
                Row(
                  children: [
                    Expanded(
                      child: _heroStat(
                          icon: Icons.devices_rounded,
                          label: 'Devices',
                          value: '$connectedCount'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _heroStat(
                          icon: Icons.shield_rounded,
                          label: 'Blocked',
                          value: '$blockedCount'),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _heroStat(
                          icon: Icons.wifi_tethering_rounded,
                          label: 'Guest',
                          value: guestEnabled ? 'On' : 'Off',
                          highlight: guestEnabled),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _heroStat({
    required IconData icon,
    required String label,
    required String value,
    bool highlight = false,
  }) =>
      Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white
              .withValues(alpha: highlight ? 0.18 : 0.10),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: Colors.white
                  .withValues(alpha: highlight ? 0.3 : 0.15)),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.white, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(value,
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2)),
                  Text(label,
                      style: GoogleFonts.inter(
                          color: Colors.white60,
                          fontSize: 10,
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      );

}

// ── Signal Bars ───────────────────────────────────────────────────────────────

class _SignalBars extends StatelessWidget {
  const _SignalBars({required this.level, required this.color});
  final int level; // 1..4
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 22,
      height: 14,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(4, (i) {
          final on = i < level;
          return Padding(
            padding: const EdgeInsets.only(right: 2),
            child: Container(
              width: 3.5,
              height: 4.0 + i * 3,
              decoration: BoxDecoration(
                color: on
                    ? color
                    : Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ── Pulse Dot (WiFi hero) ─────────────────────────────────────────────────────

class _WifiPulseDot extends StatefulWidget {
  const _WifiPulseDot({required this.color, required this.animate});
  final Color color;
  final bool animate;

  @override
  State<_WifiPulseDot> createState() => _WifiPulseDotState();
}

class _WifiPulseDotState extends State<_WifiPulseDot>
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
  void didUpdateWidget(covariant _WifiPulseDot oldWidget) {
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
    required this.accentColor,
    required this.onTap,
    this.badge,
    this.badgeColor,
    this.last = false,
  });

  final IconData icon;
  final String title, subtitle;
  final Color accentColor;
  final VoidCallback onTap;
  final String? badge;
  final Color? badgeColor;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(13),
                border: Border.all(
                    color: accentColor.withValues(alpha: 0.2)),
              ),
              child: Icon(icon, color: accentColor, size: 20),
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
            if (badge != null) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: (badgeColor ?? accentColor)
                      .withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                      color: (badgeColor ?? accentColor)
                          .withValues(alpha: 0.3)),
                ),
                child: Text(
                  badge!,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: badgeColor ?? accentColor,
                  ),
                ),
              ),
            ],
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right_rounded,
                color: kMuted, size: 18),
          ],
        ),
      ),
    );
  }
}

// ── Device Row ────────────────────────────────────────────────────────────────

class _DeviceRow extends StatelessWidget {
  const _DeviceRow({
    required this.device,
    required this.icon,
    required this.typeLabel,
    required this.hasLive,
    required this.busy,
    required this.onToggle,
  });

  final ConnectedDevice device;
  final IconData icon;
  final String typeLabel;
  final bool hasLive, busy;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final isBlocked = device.blocked;
    // Switch: ON = internet active (not blocked), OFF = blocked
    final isOn = !isBlocked;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorderSoft),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: kAccentSoft,
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: kAccent, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  device.name,
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    color: kText,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  typeLabel,
                  style: GoogleFonts.inter(color: kTextMuted, fontSize: 11),
                ),
              ],
            ),
          ),
          // ON/OFF toggle switch
          if (hasLive)
            Switch(
              value: isOn,
              onChanged: busy ? null : (_) => onToggle(),
              activeColor: kSuccess,
              activeTrackColor: kSuccess.withValues(alpha: 0.35),
              inactiveThumbColor: const Color(0xFFFF6B6B),
              inactiveTrackColor: const Color(0xFFFF6B6B).withValues(alpha: 0.2),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
        ],
      ),
    );
  }
}


