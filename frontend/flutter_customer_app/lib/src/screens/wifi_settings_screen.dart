import 'package:flutter/material.dart';

import '../core/app_state.dart';
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

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final appState = AppStateScope.of(context);
    if (_nameController.text.isEmpty) {
      _nameController.text = appState.wifi.ssid24;
      _guestSsidController.text = appState.wifi.guestSsid;
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

    return Scaffold(
      appBar: AppBar(
        title: Text('Wi-Fi Settings', style: Theme.of(context).textTheme.headlineSmall),
        centerTitle: true,
        backgroundColor: const Color(0xFFF7F9FC),
        foregroundColor: const Color(0xFF17181C),
      ),
      backgroundColor: const Color(0xFFF7F9FC),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF0B0F19), Color(0xFF111827)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: const [BoxShadow(color: Color(0x14030B14), blurRadius: 18, offset: Offset(0, 8))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Colors.white)),
                          const SizedBox(height: 6),
                          Text(
                            'Quality: ${appState.networkQuality.quality} | Devices: ${wifi.connectedDevicesCount}',
                            style: const TextStyle(color: Color(0xFFD1D5DB)),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: wifi.paused ? const Color(0x26EF4444) : const Color(0x1439FF14),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: wifi.paused ? const Color(0x66EF4444) : const Color(0x6639FF14)),
                      ),
                      child: Text(
                        wifi.paused ? 'Paused' : 'Online',
                        style: TextStyle(
                          color: wifi.paused ? const Color(0xFFFCA5A5) : const Color(0xFF39FF14),
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
                  icon: Icons.schedule_rounded,
                  title: 'Parental controls',
                  subtitle: 'Create scheduled rules to restrict access during selected hours',
                  onTap: () => _showParentalControlsSheet(context, appState),
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
          border: Border(bottom: last ? BorderSide.none : const BorderSide(color: Color(0x22FFFFFF))),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0x1439FF14),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0x6639FF14)),
              ),
              child: Icon(icon, color: const Color(0xFF39FF14)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Colors.white)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.4)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0x1439FF14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x6639FF14)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Colors.white),
          children: [
            TextSpan(text: '$label ', style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  Future<void> _showPauseSheet(BuildContext context, AppState appState) async {
    final wifi = appState.wifi;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
          child: AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF09111D), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  wifi.paused ? Icons.play_circle_fill_rounded : Icons.pause_circle_filled_rounded,
                  size: 80,
                  color: wifi.paused ? const Color(0xFF39FF14) : const Color(0xFFFF8A80),
                ),
                const SizedBox(height: 16),
                Text(
                  wifi.paused ? 'Resume internet on this connection?' : 'Pause internet on this connection?',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 26, color: Colors.white),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  wifi.paused
                      ? 'Your router and service will start working again after confirmation.'
                      : 'This will temporarily disable active internet access until you resume it again.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy
                        ? null
                        : () async {
                            final ok = await appState.toggleWifiPause(!wifi.paused);
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(ok ? (wifi.paused ? 'Wi-Fi resumed' : 'Wi-Fi paused') : (appState.error ?? 'Unable to update Wi-Fi status'))),
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
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding: EdgeInsets.fromLTRB(12, 16, 12, 12 + MediaQuery.of(context).viewInsets.bottom),
          child: AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF09111D), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Wi-Fi name & password', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Colors.white)),
                const SizedBox(height: 10),
                const Text(
                  'Rename your Wi-Fi and set a stronger password for secure usage.',
                  style: TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 18),
                TextField(controller: _nameController, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Wi-Fi name')),
                const SizedBox(height: 12),
                TextField(controller: _passwordController, style: const TextStyle(color: Colors.white), obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy
                        ? null
                        : () async {
                            final ok = await appState.changeWifiPasswordAndRefresh(
                              password: _passwordController.text.trim(),
                              ssid24: _nameController.text.trim(),
                              ssid5: _nameController.text.trim(),
                            );
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(ok ? 'Wi-Fi details updated' : (appState.error ?? 'Update failed'))),
                            );
                          },
                    child: const Text('Save Changes'),
                  ),
                ),
              ],
            ),
          ),
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
            gradient: const LinearGradient(
              colors: [Color(0xFF09111D), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Diagnostics summary', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Colors.white)),
                const SizedBox(height: 18),
                _diagnosticRow('Download speed', '${appState.speedTest.downloadMbps.toStringAsFixed(1)} Mbps'),
                _diagnosticRow('Upload speed', '${appState.speedTest.uploadMbps.toStringAsFixed(1)} Mbps'),
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
        final devices = appState.connectedDevices;
        final blockedCount = devices.where((device) => device.blocked).length;
        final allowedCount = devices.where((device) => !device.blocked).length;
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
          child: AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF09111D), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(accessMode ? 'Manage Wi-Fi access' : 'Connected devices', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Colors.white)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _statusChip('Connected', '${devices.length}'),
                    _statusChip('Allowed', '$allowedCount'),
                    _statusChip('Blocked', '$blockedCount'),
                  ],
                ),
                const SizedBox(height: 14),
                if (devices.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Text(
                      'No connected device at the moment. Try reconnecting to Wi-Fi or refresh later.',
                      style: TextStyle(color: Color(0xFFD1D5DB)),
                    ),
                  )
                else
                  ...devices.map((device) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF08131B),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x3339FF14)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(device.name, style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
                                const SizedBox(height: 4),
                                Text('${device.connectionType} | ${device.signal}', style: const TextStyle(color: Color(0xFFD1D5DB))),
                              ],
                            ),
                          ),
                          if (accessMode)
                            Switch(
                              value: !device.blocked,
                              activeColor: const Color(0xFF39FF14),
                              onChanged: appState.busy
                                  ? null
                                  : (allowed) async {
                                      final ok = await appState.setDeviceBlocked(device.clientId, !allowed);
                                      if (!context.mounted) return;
                                      if (!ok) {
                                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(appState.error ?? 'Unable to update device access')));
                                      }
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
                            Navigator.of(context).pop();
                            await _showConnectedDevices(context, appState, accessMode: accessMode);
                          },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.white,
                      side: const BorderSide(color: Color(0x6639FF14)),
                    ),
                    child: const Text('Refresh device list'),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showGuestWifiSheet(BuildContext context, AppState appState) async {
    final wifi = appState.wifi;
    _guestSsidController.text = wifi.guestSsid;
    _guestPasswordController.text = '';
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        bool enabled = wifi.guestEnabled;
        return StatefulBuilder(
          builder: (context, setLocalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(12, 16, 12, 12 + MediaQuery.of(context).viewInsets.bottom),
              child: AppCard(
                gradient: const LinearGradient(
                  colors: [Color(0xFF09111D), Color(0xFF111827)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Guest Wi-Fi', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Colors.white)),
                    const SizedBox(height: 10),
                    const Text(
                      'Create a separate guest network with its own name and password.',
                      style: TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Enable guest network', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                      value: enabled,
                      activeColor: const Color(0xFF39FF14),
                      onChanged: (value) => setLocalState(() => enabled = value),
                    ),
                    TextField(controller: _guestSsidController, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Guest Wi-Fi name')),
                    const SizedBox(height: 12),
                    TextField(controller: _guestPasswordController, style: const TextStyle(color: Colors.white), obscureText: true, decoration: const InputDecoration(labelText: 'Guest password')),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: appState.busy
                            ? null
                            : () async {
                                final ok = await appState.updateGuestWifi(
                                  enabled: enabled,
                                  ssid: _guestSsidController.text.trim(),
                                  password: _guestPasswordController.text.trim(),
                                );
                                if (!context.mounted) return;
                                Navigator.of(context).pop();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(ok ? 'Guest Wi-Fi updated' : (appState.error ?? 'Unable to update guest Wi-Fi'))),
                                );
                              },
                        child: const Text('Save guest Wi-Fi'),
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
        final rules = appState.parentalRules;
        return Padding(
          padding: EdgeInsets.fromLTRB(12, 16, 12, 12 + MediaQuery.of(context).viewInsets.bottom),
          child: AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF09111D), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Parental controls', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Colors.white)),
                const SizedBox(height: 10),
                if (rules.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: Text(
                      'No active rules right now. Add a schedule to automatically restrict Wi-Fi access.',
                      style: TextStyle(color: Color(0xFFD1D5DB), height: 1.4),
                    ),
                  )
                else
                  ...rules.map(
                    (rule) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF08131B),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0x3339FF14)),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(rule.targetName, style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
                                  const SizedBox(height: 4),
                                  Text('${rule.startTime} - ${rule.endTime}', style: const TextStyle(color: Color(0xFFD1D5DB))),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: rule.blocked ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text(
                                rule.blocked ? 'Blocked' : 'Allowed',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: rule.blocked ? const Color(0xFF92400E) : const Color(0xFF166534),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                TextField(controller: targetController, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Rule or device name')),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: TextField(controller: startController, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'Start time (HH:MM)'))),
                    const SizedBox(width: 12),
                    Expanded(child: TextField(controller: endController, style: const TextStyle(color: Colors.white), decoration: const InputDecoration(labelText: 'End time (HH:MM)'))),
                  ],
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy
                        ? null
                        : () async {
                            final ok = await appState.addParentalControl(
                              targetName: targetController.text.trim(),
                              startTime: startController.text.trim(),
                              endTime: endController.text.trim(),
                            );
                            if (!context.mounted) return;
                            Navigator.of(context).pop();
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(ok ? 'Parental control rule added' : (appState.error ?? 'Unable to add parental control'))),
                            );
                          },
                    child: const Text('Save parental control'),
                  ),
                ),
              ],
            ),
          ),
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
            gradient: const LinearGradient(
              colors: [Color(0xFF09111D), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.router_rounded, size: 88, color: Color(0xFF39FF14)),
                const SizedBox(height: 16),
                const Text('Restart router?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Colors.white), textAlign: TextAlign.center),
                const SizedBox(height: 10),
                const Text(
                  'This may take a few minutes, during which your Wi-Fi connection will be affected. Inform active users beforehand.',
                  style: TextStyle(color: Color(0xFFD1D5DB), height: 1.4),
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
                TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Maybe Later')),
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
        border: Border(bottom: last ? BorderSide.none : const BorderSide(color: Color(0x22FFFFFF))),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w600))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white)),
        ],
      ),
    );
  }
}

