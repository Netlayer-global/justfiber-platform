import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class ShopTab extends StatelessWidget {
  const ShopTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final wifi = appState.wifi;
    final devices = appState.connectedDevices;
    final quality = appState.networkQuality;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 130),
      children: [
        Text('Wi-Fi & Network', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('SmartHub G-900', style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 8),
                    Text('Fiber connectivity established and performing optimally.', style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.circle, size: 10, color: Colors.green),
                        const SizedBox(width: 8),
                        Text('System online', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: const Color(0xFF8126CF))),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                height: 80,
                width: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFFF3E8FF),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(Icons.router_rounded, size: 42, color: Color(0xFF8126CF)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(child: _WifiCard(title: 'Primary Network', value: wifi.ssid24, icon: Icons.wifi_rounded)),
            const SizedBox(width: 12),
            Expanded(child: _WifiCard(title: 'Guest Network', value: wifi.guestSsid, icon: Icons.person_add_alt_1_rounded)),
          ],
        ),
        const SizedBox(height: 12),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Security Key', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(child: Text(wifi.passwordMask, style: Theme.of(context).textTheme.titleLarge)),
                  OutlinedButton(onPressed: () {}, child: const Text('View')),
                ],
              ),
              const SizedBox(height: 10),
              SwitchListTile.adaptive(
                value: wifi.guestEnabled,
                contentPadding: EdgeInsets.zero,
                title: const Text('Guest Network'),
                subtitle: const Text('Isolated visitor access'),
                onChanged: (value) async {
                  await appState.updateGuestWifi(enabled: value, ssid: wifi.guestSsid, password: 'Guest@1234');
                },
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text('Network quality', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _QualityCard(title: 'Latency', value: '${quality.latencyMs.toStringAsFixed(0)} ms')),
            const SizedBox(width: 12),
            Expanded(child: _QualityCard(title: 'Jitter', value: '${quality.jitterMs.toStringAsFixed(0)} ms')),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _QualityCard(title: 'Packet Loss', value: '${quality.packetLossPercent.toStringAsFixed(1)} %')),
            const SizedBox(width: 12),
            Expanded(child: _QualityCard(title: 'Quality', value: quality.quality)),
          ],
        ),
        const SizedBox(height: 18),
        Text('Connected devices', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 12),
        if (devices.isEmpty)
          const AppCard(child: Text('No connected devices returned from backend yet.'))
        else
          ...devices.map(
            (device) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: AppCard(
                child: Row(
                  children: [
                    Container(
                      height: 48,
                      width: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3E8FF),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        device.connectionType.toLowerCase().contains('ethernet') ? Icons.tv_rounded : Icons.smartphone_rounded,
                        color: const Color(0xFF8126CF),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(device.name, style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text('${device.connectionType} • ${device.signal}', style: Theme.of(context).textTheme.bodyMedium),
                        ],
                      ),
                    ),
                    Switch(
                      value: !device.blocked,
                      onChanged: (value) => appState.setDeviceBlocked(device.clientId, !value),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _WifiCard extends StatelessWidget {
  const _WifiCard({required this.title, required this.value, required this.icon});

  final String title;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 42,
            width: 42,
            decoration: BoxDecoration(color: const Color(0xFFF3E8FF), borderRadius: BorderRadius.circular(16)),
            child: Icon(icon, color: const Color(0xFF8126CF)),
          ),
          const SizedBox(height: 10),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _QualityCard extends StatelessWidget {
  const _QualityCard({required this.title, required this.value});

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
        ],
      ),
    );
  }
}
