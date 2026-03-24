import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  Future<void> _openLeaveSheet(InstallerAppState appState) async {
    final reasonController = TextEditingController(text: 'Installer marked unavailable from field app.');
    bool submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF0C1018),
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                20,
                20,
                MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Start leave',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(color: const Color(0xFFEFEEE8)),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use this only when no active jobs are open. Expected return is set to 8 hours from now.',
                    style: TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: reasonController,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'Reason'),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: submitting
                          ? null
                          : () async {
                              final reason = reasonController.text.trim();
                              if (reason.length < 3) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Enter a proper leave reason')),
                                );
                                return;
                              }
                              setModalState(() => submitting = true);
                              final ok = await appState.startLeave(
                                reason: reason,
                                expectedEndAt: DateTime.now().add(const Duration(hours: 8)),
                              );
                              if (!mounted) return;
                              if (ok) {
                                Navigator.of(context).pop();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Leave started')),
                                );
                              } else {
                                setModalState(() => submitting = false);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(appState.error ?? 'Unable to start leave')),
                                );
                              }
                            },
                      child: Text(submitting ? 'Saving...' : 'Start leave'),
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

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final profile = appState.profile;
    final isOnLeave = profile.availabilityStatus == 'on_leave';

    return RefreshIndicator(
      color: const Color(0xFF8224E3),
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
                Text('Availability controls', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                Text(
                  isOnLeave
                      ? 'Installer is currently marked on leave.'
                      : 'Installer is currently available for dispatch.',
                  style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton(
                      onPressed: appState.busy || isOnLeave ? null : () => _openLeaveSheet(appState),
                      child: Text(appState.busy && !isOnLeave ? 'Saving...' : 'Start leave'),
                    ),
                    OutlinedButton(
                      onPressed: appState.busy || !isOnLeave
                          ? null
                          : () async {
                              final ok = await appState.endLeave();
                              if (!mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(ok ? 'Back to available' : (appState.error ?? 'Unable to end leave'))),
                              );
                            },
                      child: const Text('End leave'),
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
                _workflowStep('1', 'Open assigned job and verify customer location.'),
                _workflowStep('2', 'Accept, travel, and check in onsite.'),
                _workflowStep('3', 'Link ONT, activate service, and verify optical health.'),
                _workflowStep('4', 'Capture proof, verify OTP, and close job.'),
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
        border: Border.all(color: const Color(0x338224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
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
        border: Border.all(color: const Color(0x228224E3)),
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
              border: Border.all(color: const Color(0x558224E3)),
            ),
            child: Text(
              index,
              style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800),
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
