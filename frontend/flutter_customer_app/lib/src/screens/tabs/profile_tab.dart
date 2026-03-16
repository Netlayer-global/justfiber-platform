import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  final passwordController = TextEditingController(text: 'Just@1234');

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final wifi = appState.wifi;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Text('Profile', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Wi-Fi Management', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              Text('2.4G: ${wifi.ssid24}'),
              const SizedBox(height: 8),
              Text('5G: ${wifi.ssid5}'),
              const SizedBox(height: 14),
              TextField(
                controller: passwordController,
                decoration: const InputDecoration(labelText: 'New Wi-Fi Password'),
              ),
              const SizedBox(height: 14),
              FilledButton(
                onPressed: appState.busy ? null : () => appState.changeWifiPassword(passwordController.text),
                child: Text(appState.busy ? 'Updating...' : 'Update Wi-Fi'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Account', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              _row('Plan', billing.currentPlan),
              _row('Due', 'Rp. ${billing.dueAmount.toStringAsFixed(0)}'),
              _row('Next bill', billing.nextBillDate),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Connected devices', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...(appState.connectedDevices.isEmpty
                  ? [const Text('No connected device data available.', style: TextStyle(color: Color(0xFFA3A9C2)))]
                  : appState.connectedDevices.take(5).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          children: [
                            const Icon(Icons.devices_rounded, size: 18, color: Color(0xFF9A7CFF)),
                            const SizedBox(width: 10),
                            Expanded(child: Text(item)),
                          ],
                        ),
                      ))),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Requests', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...(appState.requests.isEmpty
                  ? [const Text('No recent requests.', style: TextStyle(color: Color(0xFFA3A9C2)))]
                  : appState.requests.take(5).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 4),
                                  Text(item.createdAt, style: const TextStyle(color: Color(0xFFA3A9C2), fontSize: 12)),
                                ],
                              ),
                            ),
                            Text(item.status, style: const TextStyle(color: Color(0xFFB8A8FF))),
                          ],
                        ),
                      ))),
            ],
          ),
        ),
        const SizedBox(height: 18),
        FilledButton.tonal(
          onPressed: appState.logout,
          child: const Text('Logout'),
        ),
        if ((appState.error ?? '').isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(appState.error!, style: const TextStyle(color: Colors.redAccent)),
        ],
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFFA3A9C2))),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
