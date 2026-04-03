import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final profile = appState.profile;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 130),
      children: [
        Text('Profile', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFF8126CF), Color(0xFFC284FF)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(profile.fullName, style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
              const SizedBox(height: 8),
              _row('Installer code', profile.installerCode),
              _row('Phone', profile.phone),
              _row('Availability', profile.availabilityStatus),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Workflow', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              const Text('1. Accept job'),
              const SizedBox(height: 8),
              const Text('2. Start travel and onsite'),
              const SizedBox(height: 8),
              const Text('3. Add serial and optical readings'),
              const SizedBox(height: 8),
              const Text('4. Save checklist and activate'),
            ],
          ),
        ),
        const SizedBox(height: 18),
        FilledButton.tonal(
          onPressed: appState.logout,
          child: const Text('Logout'),
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Colors.white70)),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
        ],
      ),
    );
  }
}
