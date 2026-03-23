import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final profile = appState.profile;
    return RefreshIndicator(
      color: const Color(0xFFE6FF3C),
      backgroundColor: const Color(0xFF0C1018),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF090D15), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'INSTALLER CONSOLE',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF9CA3AF),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  profile.fullName.isEmpty ? 'Field engineer' : profile.fullName,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  'Manage job readiness, availability, and provisioning workflow details.',
                  style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _metricTile(
                        context,
                        label: 'Installer code',
                        value: profile.installerCode.isEmpty ? '-' : profile.installerCode,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _metricTile(
                        context,
                        label: 'Availability',
                        value: profile.availabilityStatus,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Account information', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 14),
                _infoRow('Full name', profile.fullName.isEmpty ? '-' : profile.fullName),
                _infoRow('Phone', profile.phone.isEmpty ? '-' : profile.phone),
                _infoRow('Installer code', profile.installerCode.isEmpty ? '-' : profile.installerCode),
                _infoRow('Availability', profile.availabilityStatus),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Field workflow', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 14),
                _workflowStep('1', 'Load provisioning preview before leaving for the site.'),
                _workflowStep('2', 'Open the pinned map link and verify service location.'),
                _workflowStep('3', 'Enter ONT serial and run activation onsite.'),
                _workflowStep('4', 'Refresh queue and confirm status moved correctly.'),
              ],
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: appState.logout,
              child: const Text('Logout'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _metricTile(BuildContext context, {required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF11161D),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x33E6FF3C)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF141A22),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x22E6FF3C)),
      ),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF9CA3AF))),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(color: Color(0xFFEFEEE8), fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _workflowStep(String index, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0xFF141A22),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0x55E6FF3C)),
            ),
            child: Text(
              index,
              style: const TextStyle(
                color: Color(0xFFE6FF3C),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 3),
              child: Text(
                text,
                style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
