import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'plan_catalog_screen.dart';
import 'service_tracking_screen.dart';
import 'wifi_settings_screen.dart';

class ServiceHubScreen extends StatelessWidget {
  const ServiceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final billing = appState.billing;
    final wifi = appState.wifi;
    final session = appState.session;
    final networkQuality = appState.networkQuality;
    final speedTest = appState.speedTest;
    final displayWifiName = wifi.ssid24.isEmpty ? '${session?.mobile ?? ''}_wifi' : wifi.ssid24;
    final planName = billing.currentPlan.isNotEmpty ? billing.currentPlan : (dashboard.planName.isNotEmpty ? dashboard.planName : 'No active plan');
    final isActive = !wifi.paused && planName != 'No active plan';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          children: [
            Text('Wi-Fi', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 2),
            Text(displayWifiName, style: const TextStyle(fontSize: 18, color: Color(0xFF94A3B8))),
          ],
        ),
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
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 34),
          children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF090D15), Color(0xFF111827)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(32),
              border: Border.all(color: const Color(0x228224E3)),
              boxShadow: const [
                BoxShadow(color: Color(0x26030B14), blurRadius: 24, offset: Offset(0, 10)),
              ],
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your broadband control center',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              color: const Color(0xFF131313),
                              fontSize: 28,
                            ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Manage service actions here only: Wi-Fi controls, devices, diagnostics, shifts, and plan changes.',
                        style: TextStyle(color: Color(0xFF5F5A56), height: 1.4),
                      ),
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          _heroMetric('State', isActive ? 'Active' : 'Paused'),
                          _heroMetric('Devices', '${wifi.connectedDevicesCount}'),
                          _heroMetric('Mode', billing.billMode.isEmpty ? 'Unset' : billing.billMode),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10151A),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0x668224E3)),
                  ),
                  child: const Icon(Icons.wifi_rounded, color: Color(0xFF8224E3), size: 42),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _lightPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Current service', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
                const SizedBox(height: 10),
                Text(
                  '$planName | $displayWifiName',
                  style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(child: _serviceStat('Plan', planName)),
                    const SizedBox(width: 10),
                    Expanded(child: _serviceStat('Wi-Fi', displayWifiName)),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _serviceStat('Status', isActive ? 'Active' : 'Paused')),
                    const SizedBox(width: 10),
                    Expanded(child: _serviceStat('Quality', networkQuality.quality.isEmpty ? '-' : networkQuality.quality)),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                          );
                          if (context.mounted) {
                            await appState.refresh();
                          }
                        },
                        child: const Text('View plans'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                          );
                          if (context.mounted) {
                            await appState.refresh();
                          }
                        },
                        child: const Text('Change plan'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _lightPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Quick actions', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
                const SizedBox(height: 12),
                _quickAction(
                  context,
                  Icons.router_outlined,
                  'Wi-Fi settings',
                  'Passwords, guest Wi-Fi, devices, access, and router actions',
                  () async {
                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WifiSettingsScreen()));
                    if (context.mounted) {
                      await appState.refresh();
                    }
                  },
                ),
                _quickAction(
                  context,
                  Icons.home_work_outlined,
                  'Shift connection',
                  'Create a relocation request for your current broadband setup',
                  () => _showShiftConnectionSheet(context, appState),
                ),
                _quickAction(
                  context,
                  Icons.auto_awesome_motion_outlined,
                  'Change plan',
                  'Upgrade or downgrade your service using the current billing rules',
                  () async {
                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
                    if (context.mounted) {
                      await appState.refresh();
                    }
                  },
                ),
                _quickAction(
                  context,
                  Icons.track_changes_outlined,
                  'Track service activity',
                  'See booking steps, visits, requests, and complaint progress',
                  () async {
                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()));
                    if (context.mounted) {
                      await appState.refresh();
                    }
                  },
                  last: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _lightPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Service health', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _summaryHealthTile('Quality', networkQuality.quality)),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryHealthTile('Latency', '${networkQuality.latencyMs.toStringAsFixed(0)} ms')),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _summaryHealthTile('Packet Loss', '${networkQuality.packetLossPercent.toStringAsFixed(1)}%')),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryHealthTile('Speed Test', speedTest.status)),
                  ],
                ),
                const SizedBox(height: 14),
                _accountRow(Icons.track_changes_outlined, 'Open requests', '${appState.requests.length}'),
                _accountRow(Icons.support_agent_outlined, 'Open tickets', '${appState.tickets.length}', last: true),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                          );
                          if (context.mounted) {
                            await appState.refresh();
                          }
                        },
                        child: const Text('Open tracking'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const WifiSettingsScreen()),
                          );
                          if (context.mounted) {
                            await appState.refresh();
                          }
                        },
                        child: const Text('Run Wi-Fi actions'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (appState.addons.isNotEmpty) ...[
            const SizedBox(height: 18),
            _lightPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Add-ons', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
                  const SizedBox(height: 12),
                  ...appState.addons.take(2).map(
                        (addon) => Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF0B0F19), Color(0xFF111827)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: const Color(0x228224E3)),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 68,
                                  height: 68,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF10151A),
                                    borderRadius: BorderRadius.circular(18),
                                    border: Border.all(color: const Color(0x338224E3)),
                                  ),
                                  child: const Icon(Icons.add_box_outlined, size: 32, color: Color(0xFF8224E3)),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(addon.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
                                      const SizedBox(height: 4),
                                      Text(addon.description, style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4)),
                                    ],
                                  ),
                                ),
                                OutlinedButton(
                                  onPressed: () => _showAddonInterest(context, appState, addon.name),
                                  child: const Text('Request'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                ],
              ),
            ),
          ],
          ],
        ),
      ),
    );
  }

  Widget _heroMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF101722),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x338224E3)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: const Color(0xFF131313)),
          children: [
            TextSpan(text: '$value ', style: const TextStyle(fontWeight: FontWeight.w800)),
            TextSpan(text: label, style: const TextStyle(color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }

  Widget _lightPanel({required Widget child}) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      padding: const EdgeInsets.all(20),
      child: child,
    );
  }

  Widget _serviceStat(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF101722),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
        ],
      ),
    );
  }

  Widget _summaryHealthTile(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF101722),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(
            value.isEmpty ? '-' : value,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313)),
          ),
        ],
      ),
    );
  }

  Widget _quickAction(BuildContext context, IconData icon, String title, String subtitle, VoidCallback onTap, {bool last = false}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          border: Border(
          bottom: last ? BorderSide.none : const BorderSide(color: Color(0x228224E3)),
        ),
      ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0B0F19), Color(0xFF141A25)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: const Color(0xFF8224E3)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _accountRow(IconData icon, String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        border: Border(
          bottom: last ? BorderSide.none : const BorderSide(color: Color(0x228224E3)),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: const Color(0xFF101722),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0x228224E3)),
            ),
            child: Icon(icon, color: const Color(0xFF8224E3)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: Color(0xFF131313))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showAddonInterest(BuildContext context, AppState appState, String addonName) async {
    final request = await appState.submitServiceRequest(type: 'link_service', note: 'Interested in $addonName');
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(request == null ? (appState.error ?? 'Unable to submit add-on request') : '$addonName request created')),
    );
    if (request != null) {
      await appState.refresh();
    }
  }

  Future<void> _showShiftConnectionSheet(BuildContext context, AppState appState) async {
    String shiftMode = 'new_address';
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF0B0F19),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setLocalState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 52,
                      height: 6,
                      decoration: BoxDecoration(color: const Color(0x338224E3), borderRadius: BorderRadius.circular(99)),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Shift Wi-Fi',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 30, color: Color(0xFF131313)),
                  ),
                  const SizedBox(height: 14),
                  _radioCard(
                    title: 'New address',
                    subtitle: 'Move your connection to your new location',
                    value: 'new_address',
                    groupValue: shiftMode,
                    onChanged: (value) => setLocalState(() => shiftMode = value),
                  ),
                  const SizedBox(height: 12),
                  _radioCard(
                    title: 'Different spot at same address',
                    subtitle: 'Move your Wi-Fi setup within your house',
                    value: 'same_address',
                    groupValue: shiftMode,
                    onChanged: (value) => setLocalState(() => shiftMode = value),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF111827),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0x558224E3)),
                    ),
                    child: const Text('Shift your Wi-Fi connection for free!', style: TextStyle(color: const Color(0xFF131313), fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: appState.busy
                          ? null
                          : () async {
                              final request = await appState.submitServiceRequest(
                                type: 'shift',
                                note: shiftMode == 'new_address'
                                    ? 'Customer wants to shift Wi-Fi to a new address.'
                                    : 'Customer wants to shift Wi-Fi within the same address.',
                              );
                              if (!context.mounted) return;
                              Navigator.of(context).pop();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(request == null ? (appState.error ?? 'Unable to create shift request') : 'Shift request submitted')),
                              );
                              if (request != null) {
                                await appState.refresh();
                              }
                            },
                      child: const Text('Proceed'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _radioCard({
    required String title,
    required String subtitle,
    required String value,
    required String groupValue,
    required ValueChanged<String> onChanged,
  }) {
    final selected = value == groupValue;
    return InkWell(
      onTap: () => onChanged(value),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFF111827),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: selected ? const Color(0xFF8224E3) : const Color(0x338224E3), width: 1.5),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: Color(0xFF131313)),
                  ),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF5F5A56))),
                ],
              ),
            ),
            Radio<String>(value: value, groupValue: groupValue, onChanged: (next) => onChanged(next ?? value)),
          ],
        ),
      ),
    );
  }
}





