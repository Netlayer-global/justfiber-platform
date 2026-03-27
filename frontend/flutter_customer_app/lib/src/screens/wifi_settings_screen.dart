import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';

class WifiSettingsScreen extends StatefulWidget {
  const WifiSettingsScreen({super.key});

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
    final title = wifi.ssid24.isEmpty ? 'Wi-Fi not configured' : wifi.ssid24;
    final blockedCount = appState.connectedDevices.where((device) => device.blocked).length;
    final allowedCount = appState.connectedDevices.where((device) => !device.blocked).length;
    final connectedCount = appState.connectedDevices.isNotEmpty ? appState.connectedDevices.length : wifi.connectedDevicesCount;

    return Scaffold(
      appBar: AppBar(
        title: Text('Wi-Fi Settings', style: Theme.of(context).textTheme.headlineSmall),
        centerTitle: true,
        backgroundColor: const Color(0xFFF6F1EB),
        foregroundColor: const Color(0xFF131313),
      ),
      backgroundColor: const Color(0xFFF6F1EB),
      body: RefreshIndicator(
        color: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFF6F1EB),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
          children: [
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: const [BoxShadow(color: Color(0x14030B14), blurRadius: 18, offset: Offset(0, 8))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'NETWORK CONSOLE',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFFE9D5FF),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Color(0xFFFFFFFF))),
                          const SizedBox(height: 6),
                          Text(
                            'Quality: ${appState.networkQuality.quality} | Devices: $connectedCount',
                            style: const TextStyle(color: Color(0xFFF3E8FF)),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0x26FFFFFF),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: wifi.paused ? const Color(0x55FFCDD2) : const Color(0x40FFFFFF)),
                      ),
                      child: Text(
                        wifi.paused ? 'Paused' : 'Online',
                        style: TextStyle(
                          color: const Color(0xFFFFFFFF),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _statusChip('Allowed devices', '$allowedCount'),
                    _statusChip('Blocked devices', '$blockedCount'),
                    _statusChip('Guest Wi-Fi', wifi.guestEnabled ? 'On' : 'Off'),
                  ],
                ),
                const SizedBox(height: 18),
                _actionTile(
                  icon: wifi.paused ? Icons.play_circle_outline_rounded : Icons.pause_circle_outline_rounded,
                  title: wifi.paused ? 'Resume Wi-Fi' : 'Pause Wi-Fi',
                  subtitle: wifi.paused ? 'Turn your broadband connection back on' : 'Temporarily pause internet access on this connection',
                  onTap: () => _showPauseSheet(context, appState),
                ),
                _actionTile(
                  icon: Icons.password_rounded,
                  title: 'Set Wi-Fi name & password',
                  subtitle: 'Add name and a strong password for secure usage',
                  onTap: () => _showRenameSheet(context, appState),
                ),
                _actionTile(
                  icon: Icons.tune_rounded,
                  title: 'Run diagnostics',
                  subtitle: 'Check current speed, latency, packet loss, and optical quality',
                  onTap: () => _showDiagnosticsSheet(context, appState),
                ),
                _actionTile(
                  icon: Icons.devices_rounded,
                  title: 'Connected devices & access',
                  subtitle: 'Track connected devices and block or unblock access from one place',
                  onTap: () => _showConnectedDevices(context, appState, accessMode: true),
                ),
                _actionTile(
                  icon: Icons.wifi_tethering_rounded,
                  title: 'Guest Wi-Fi',
                  subtitle: 'Set a separate name and password for your guests',
                  onTap: () => _showGuestWifiSheet(context, appState),
                ),
                _actionTile(
                  icon: Icons.restart_alt_rounded,
                  title: 'Restart router',
                  subtitle: 'Tap to remotely restart your router',
                  onTap: () => _showRestartSheet(context, appState),
                  last: true,
                ),
              ],
            ),
          ),
          ],
        ),
      ),
    );
  }

  Widget _actionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool last = false,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          border: Border(bottom: last ? BorderSide.none : const BorderSide(color: Color(0x12000000))),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFF8F4FF),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0x668224E3)),
              ),
              child: Icon(icon, color: const Color(0xFF8224E3)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFFFFFFFF))),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFFF3E8FF), height: 1.4)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Color(0xFFFFFFFF)),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0x26FFFFFF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x668224E3)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFFFFFFFF)),
          children: [
            TextSpan(text: '$label ', style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  Widget _sheetStatusChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x338224E3)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF131313)),
          children: [
            TextSpan(text: '$label ', style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  IconData _deviceIcon(String connectionType) {
    final normalized = connectionType.toLowerCase();
    if (normalized.contains('tv')) return Icons.tv_rounded;
    if (normalized.contains('phone') || normalized.contains('mobile')) return Icons.smartphone_rounded;
    if (normalized.contains('laptop') || normalized.contains('pc')) return Icons.laptop_mac_rounded;
    if (normalized.contains('ethernet') || normalized.contains('lan') || normalized.contains('wired')) {
      return Icons.settings_ethernet_rounded;
    }
    return Icons.devices_other_rounded;
  }

  String _connectionTypeLabel(String connectionType) {
    final normalized = connectionType.trim();
    if (normalized.isEmpty) return 'Unknown';
    return normalized[0].toUpperCase() + normalized.substring(1);
  }

  String _internetStatusLabel(AppState appState) {
    final selectedId = appState.selectedCustomerId;
    final activeConnection = appState.connections.cast<dynamic?>().firstWhere(
      (item) => item?.customerId == selectedId,
      orElse: () => appState.connections.isNotEmpty ? appState.connections.first : null,
    );
    final status = (activeConnection?.onlineStatus ?? '').toString().trim().toLowerCase();
    if (status == 'online') return 'Online';
    if (status == 'offline') return 'Offline';
    if (status.isEmpty) return 'Unknown';
    return status[0].toUpperCase() + status.substring(1);
  }

  Future<void> _showPauseSheet(BuildContext context, AppState appState) async {
    final wifi = appState.wifi;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
          child: AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  wifi.paused ? Icons.play_circle_fill_rounded : Icons.pause_circle_filled_rounded,
                  size: 80,
                  color: wifi.paused ? const Color(0xFF8224E3) : const Color(0xFFFF8A80),
                ),
                const SizedBox(height: 16),
                Text(
                  wifi.paused ? 'Resume internet on this connection?' : 'Pause internet on this connection?',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 26, color: const Color(0xFF131313)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  wifi.paused
                      ? 'Your router and service will start working again after confirmation.'
                      : 'This will temporarily disable active internet access until you resume it again.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy
                        ? null
                        : () async {
                            messenger
                              ..hideCurrentSnackBar()
                              ..showSnackBar(
                                SnackBar(
                                  content: Text(
                                    wifi.paused ? 'Resuming Wi-Fi...' : 'Pausing Wi-Fi...',
                                  ),
                                  duration: const Duration(seconds: 20),
                                ),
                              );
                            navigator.pop();
                            final ok = await appState.toggleWifiPause(!wifi.paused);
                            messenger.hideCurrentSnackBar();
                            messenger.showSnackBar(
                              SnackBar(
                                content: Text(
                                  ok
                                      ? (wifi.paused ? 'Wi-Fi resumed' : 'Wi-Fi paused')
                                      : (appState.error ?? 'Unable to update Wi-Fi status'),
                                ),
                              ),
                            );
                          },
                    child: Text(wifi.paused ? 'Resume Now' : 'Pause Now'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showRenameSheet(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        bool submitting = false;
        return StatefulBuilder(
          builder: (context, setLocalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(12, 16, 12, 12 + MediaQuery.of(context).viewInsets.bottom),
              child: AppCard(
                color: const Color(0xFFFFFFFF),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Wi-Fi name & password', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: const Color(0xFF131313))),
                    const SizedBox(height: 10),
                    const Text(
                      'Rename your Wi-Fi and set a stronger password for secure usage.',
                      style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                    ),
                    const SizedBox(height: 18),
                    TextField(
                      controller: _nameController,
                      enabled: !submitting,
                      style: const TextStyle(color: Color(0xFF131313)),
                      decoration: const InputDecoration(labelText: 'Wi-Fi name'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _passwordController,
                      enabled: !submitting,
                      style: const TextStyle(color: Color(0xFF131313)),
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Password'),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: submitting
                            ? null
                            : () async {
                                final ssid = _nameController.text.trim();
                                final password = _passwordController.text.trim();
                                if (ssid.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Enter a Wi-Fi name before saving.')),
                                  );
                                  return;
                                }
                                if (password.length < 8) {
                                  messenger.showSnackBar(
                                    const SnackBar(content: Text('Password must be at least 8 characters long.')),
                                  );
                                  return;
                                }
                                setLocalState(() => submitting = true);
                                messenger
                                  ..hideCurrentSnackBar()
                                  ..showSnackBar(
                                    const SnackBar(
                                      content: Text('Saving Wi-Fi details...'),
                                      duration: Duration(seconds: 20),
                                    ),
                                  );
                                navigator.pop();
                                final ok = await appState.changeWifiPasswordAndRefresh(
                                  password: password,
                                  ssid24: ssid,
                                  ssid5: ssid,
                                );
                                messenger.hideCurrentSnackBar();
                                if (ok) {
                                  messenger.showSnackBar(
                                    const SnackBar(content: Text('Wi-Fi details updated')),
                                  );
                                  return;
                                }
                                messenger.showSnackBar(
                                  SnackBar(content: Text(appState.error ?? 'Update failed')),
                                );
                              },
                        child: Text(submitting ? 'Saving...' : 'Save Changes'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _showDiagnosticsSheet(BuildContext context, AppState appState) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
          child: AppCard(
            color: const Color(0xFFFFFFFF),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Diagnostics summary', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: const Color(0xFF131313))),
                const SizedBox(height: 18),
                _diagnosticRow('Internet status', _internetStatusLabel(appState)),
                _diagnosticRow('Latency', '${appState.networkQuality.latencyMs.toStringAsFixed(0)} ms'),
                _diagnosticRow('Packet loss', '${appState.networkQuality.packetLossPercent.toStringAsFixed(1)} %'),
                _diagnosticRow('Jitter', '${appState.networkQuality.jitterMs.toStringAsFixed(0)} ms'),
                _diagnosticRow('Optical RX', '${appState.networkQuality.opticalRxPower.toStringAsFixed(1)} dBm'),
                _diagnosticRow('Overall quality', appState.networkQuality.quality, last: true),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy
                        ? null
                        : () async {
                            await appState.refresh();
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Diagnostics refreshed')),
                            );
                            Navigator.of(context).pop();
                            await _showDiagnosticsSheet(context, appState);
                          },
                    child: const Text('Refresh diagnostics'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showConnectedDevices(BuildContext context, AppState appState, {bool accessMode = true}) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
          child: AnimatedBuilder(
            animation: appState,
            builder: (context, _) {
              final devices = appState.connectedDevices;
              final hasLiveDevices = devices.isNotEmpty;
              final displayDevices = hasLiveDevices
                  ? devices
                  : List.generate(
                      appState.wifi.connectedDevicesCount,
                      (index) => ConnectedDevice(
                        clientId: 'anonymous-$index',
                        name: 'Connected device ${index + 1}',
                        connectionType: 'wifi',
                        signal: 'name unavailable',
                        blocked: false,
                      ),
                    );
              final blockedCount = displayDevices.where((device) => device.blocked).length;
              final allowedCount = displayDevices.where((device) => !device.blocked).length;
              return AppCard(
                gradient: const LinearGradient(
                  colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(accessMode ? 'Manage Wi-Fi access' : 'Connected devices', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Color(0xFF131313))),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _sheetStatusChip('Connected', '${displayDevices.length}'),
                        _sheetStatusChip('Allowed', '$allowedCount'),
                        _sheetStatusChip('Blocked', '$blockedCount'),
                      ],
                    ),
                    const SizedBox(height: 14),
                    if (displayDevices.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 20),
                        child: Text(
                          'No connected device at the moment. Try reconnecting to Wi-Fi or refresh later.',
                          style: TextStyle(color: Color(0xFF6E6A67)),
                        ),
                      )
                    else
                      if (!hasLiveDevices)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 12),
                          child: Text(
                            'The router can count connected devices, but it is not exposing their names yet. Refresh later to fetch real identities.',
                            style: TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                          ),
                        ),
                      ...displayDevices.map((device) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x338224E3)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEEF2FF),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Icon(_deviceIcon(device.connectionType), color: const Color(0xFF8224E3)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(device.name, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF))),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${_connectionTypeLabel(device.connectionType)} | ${device.signal}',
                                      style: const TextStyle(color: Color(0xFFCBD5E1)),
                                    ),
                                  ],
                                ),
                              ),
                              if (accessMode)
                                Switch(
                                  value: !device.blocked,
                                  activeColor: const Color(0xFF8224E3),
                                  onChanged: appState.busy || !hasLiveDevices
                                      ? null
                                      : (allowed) async {
                                          final ok = await appState.setDeviceBlocked(device.clientId, !allowed);
                                          if (!context.mounted) return;
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                ok
                                                    ? (allowed ? 'Device access restored' : 'Device blocked')
                                                    : (appState.error ?? 'Unable to update device access'),
                                              ),
                                            ),
                                          );
                                        },
                                ),
                            ],
                          ),
                        ),
                      )),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: appState.busy
                            ? null
                            : () async {
                                await appState.refresh();
                                if (!context.mounted) return;
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Refresh device list updated')),
                                );
                              },
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF131313),
                          backgroundColor: const Color(0xFFFFFFFF),
                          side: const BorderSide(color: Color(0x668224E3)),
                        ),
                        child: const Text('Refresh device list'),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  Future<void> _showGuestWifiSheet(BuildContext context, AppState appState) async {
    final wifi = appState.wifi;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    _guestSsidController.text = wifi.guestSsid;
    _guestPasswordController.text = '';
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        bool enabled = wifi.guestEnabled;
        bool submitting = false;
        return StatefulBuilder(
          builder: (context, setLocalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(12, 16, 12, 12 + MediaQuery.of(context).viewInsets.bottom),
              child: AppCard(
                color: const Color(0xFFFFFFFF),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Guest Wi-Fi', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: const Color(0xFF131313))),
                    const SizedBox(height: 10),
                    const Text(
                      'Create a separate guest network with its own name and password.',
                      style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Enable guest network', style: TextStyle(color: const Color(0xFF131313), fontWeight: FontWeight.w700)),
                      subtitle: const Text('Separate guests from your main home network', style: TextStyle(color: Color(0xFF6E6A67))),
                      value: enabled,
                      activeColor: const Color(0xFF8224E3),
                      inactiveThumbColor: const Color(0xFF6E6A67),
                      inactiveTrackColor: const Color(0xFF1F2937),
                      onChanged: (value) => setLocalState(() => enabled = value),
                    ),
                    TextField(controller: _guestSsidController, style: const TextStyle(color: const Color(0xFF131313)), decoration: const InputDecoration(labelText: 'Guest Wi-Fi name')),
                    const SizedBox(height: 12),
                    TextField(controller: _guestPasswordController, style: const TextStyle(color: const Color(0xFF131313)), obscureText: true, decoration: const InputDecoration(labelText: 'Guest password')),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: submitting
                            ? null
                            : () async {
                                final guestSsid = _guestSsidController.text.trim();
                                final guestPassword = _guestPasswordController.text.trim();
                                if (enabled && guestSsid.isEmpty) {
                                  messenger.showSnackBar(
                                    const SnackBar(content: Text('Enter a guest Wi-Fi name before saving.')),
                                  );
                                  return;
                                }
                                if (enabled && guestPassword.length < 8) {
                                  messenger.showSnackBar(
                                    const SnackBar(content: Text('Guest password must be at least 8 characters long.')),
                                  );
                                  return;
                                }
                                setLocalState(() => submitting = true);
                                messenger
                                  ..hideCurrentSnackBar()
                                  ..showSnackBar(
                                    const SnackBar(
                                      content: Text('Saving guest Wi-Fi...'),
                                      duration: Duration(seconds: 20),
                                    ),
                                  );
                                navigator.pop();
                                final ok = await appState.updateGuestWifi(
                                  enabled: enabled,
                                  ssid: guestSsid,
                                  password: guestPassword,
                                );
                                messenger.hideCurrentSnackBar();
                                if (ok) {
                                  messenger.showSnackBar(
                                    const SnackBar(content: Text('Guest Wi-Fi updated')),
                                  );
                                  return;
                                }
                                messenger.showSnackBar(
                                  SnackBar(content: Text(appState.error ?? 'Unable to update guest Wi-Fi')),
                                );
                              },
                        child: Text(submitting ? 'Saving...' : 'Save guest Wi-Fi'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _showParentalControlsSheet(BuildContext context, AppState appState) async {
    final targetController = TextEditingController();
    final startController = TextEditingController(text: '22:00');
    final endController = TextEditingController(text: '06:00');
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        bool submitting = false;
        return StatefulBuilder(
          builder: (context, setLocalState) {
            final rules = appState.parentalRules;
            return Padding(
              padding: EdgeInsets.fromLTRB(12, 16, 12, 12 + MediaQuery.of(context).viewInsets.bottom),
              child: AppCard(
                color: const Color(0xFFFFFFFF),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Parental controls', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Color(0xFF131313))),
                    const SizedBox(height: 10),
                    if (rules.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(bottom: 16),
                        child: Text(
                          'No active rules right now. Add a schedule to automatically restrict Wi-Fi access.',
                          style: TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                        ),
                      )
                    else
                      ...rules.map(
                        (rule) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8F4FF),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: const Color(0x338224E3)),
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(rule.targetName, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
                                      const SizedBox(height: 4),
                                      Text('${rule.startTime} - ${rule.endTime}', style: const TextStyle(color: Color(0xFF6E6A67))),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: rule.blocked ? const Color(0xFF2A1108) : const Color(0xFF0D1A12),
                                    borderRadius: BorderRadius.circular(99),
                                    border: Border.all(
                                      color: rule.blocked ? const Color(0x66F59E0B) : const Color(0x668224E3),
                                    ),
                                  ),
                                  child: Text(
                                    rule.blocked ? 'Blocked' : 'Allowed',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: rule.blocked ? const Color(0xFFFDE68A) : const Color(0xFF8224E3),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: targetController,
                      enabled: !submitting,
                      style: const TextStyle(color: Color(0xFF131313)),
                      decoration: const InputDecoration(labelText: 'Rule or device name'),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: startController,
                            enabled: !submitting,
                            style: const TextStyle(color: Color(0xFF131313)),
                            decoration: const InputDecoration(labelText: 'Start time (HH:MM)'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextField(
                            controller: endController,
                            enabled: !submitting,
                            style: const TextStyle(color: Color(0xFF131313)),
                            decoration: const InputDecoration(labelText: 'End time (HH:MM)'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: submitting
                            ? null
                            : () async {
                                final targetName = targetController.text.trim();
                                final startTime = startController.text.trim();
                                final endTime = endController.text.trim();
                                if (targetName.isEmpty) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Enter a rule or device name before saving.')),
                                  );
                                  return;
                                }
                                final timePattern = RegExp(r'^\d{2}:\d{2}$');
                                if (!timePattern.hasMatch(startTime) || !timePattern.hasMatch(endTime)) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Enter start and end time in HH:MM format.')),
                                  );
                                  return;
                                }
                                setLocalState(() => submitting = true);
                                final ok = await appState.addParentalControl(
                                  targetName: targetName,
                                  startTime: startTime,
                                  endTime: endTime,
                                );
                                if (!context.mounted) return;
                                if (ok) {
                                  Navigator.of(context).pop();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Parental control rule added')),
                                  );
                                  return;
                                }
                                setLocalState(() => submitting = false);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(appState.error ?? 'Unable to add parental control')),
                                );
                              },
                        child: Text(submitting ? 'Saving...' : 'Save parental control'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
    targetController.dispose();
    startController.dispose();
    endController.dispose();
  }

  Future<void> _showRestartSheet(BuildContext context, AppState appState) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
          child: AppCard(
                color: const Color(0xFFFFFFFF),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.router_rounded, size: 88, color: Color(0xFF8224E3)),
                const SizedBox(height: 16),
                const Text('Restart router?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: const Color(0xFF131313)), textAlign: TextAlign.center),
                const SizedBox(height: 10),
                const Text(
                  'This may take a few minutes, during which your Wi-Fi connection will be affected. Inform active users beforehand.',
                  style: TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy
                        ? null
                        : () async {
                            final ok = await appState.rebootRouter();
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(ok ? 'Router restart requested' : (appState.error ?? 'Unable to restart router'))),
                            );
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
                      foregroundColor: const Color(0xFF131313),
                      backgroundColor: const Color(0xFFFFFFFF),
                      side: const BorderSide(color: Color(0x228224E3)),
                    ),
                    child: const Text('Maybe Later'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _diagnosticRow(String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        border: Border(bottom: last ? BorderSide.none : const BorderSide(color: Color(0x14000000))),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w600))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, color: const Color(0xFF131313))),
        ],
      ),
    );
  }
}





