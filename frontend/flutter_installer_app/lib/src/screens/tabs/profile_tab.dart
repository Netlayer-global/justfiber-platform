import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  Future<void> _confirmLogout(InstallerAppState appState) async {
    final shouldLogout = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: const Color(0xFFF8FAFC),
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Logout installer session',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(color: const Color(0xFF0F172A)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Use this only after finishing or handing over active jobs. You can sign in again anytime.',
                style: TextStyle(color: Color(0xFF64748B), height: 1.45),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(false),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      onPressed: () => Navigator.of(context).pop(true),
                      child: const Text('Logout'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
    if (shouldLogout == true && mounted) {
      appState.logout();
    }
  }

  Future<void> _openLeaveSheet(InstallerAppState appState) async {
    final reasonController = TextEditingController(text: 'Installer marked unavailable from field app.');
    bool submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFFF7F8FC),
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
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(color: const Color(0xFF131313)),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use this only when no active jobs are open. Expected return is set to 8 hours from now.',
                    style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
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
      backgroundColor: const Color(0xFFF7F8FC),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x140F172A),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF5F7FB),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x140F172A)),
                      ),
                      child: const Icon(Icons.engineering_rounded, color: Color(0xFF8224E3), size: 28),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0x120F172A)),
                      ),
                      child: Text(
                        isOnLeave ? 'On leave' : 'Ready for dispatch',
                        style: const TextStyle(
                          color: Color(0xFF0F172A),
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  'INSTALLER CONSOLE',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF64748B),
                        letterSpacing: 2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  profile.fullName.isEmpty ? 'Field engineer' : profile.fullName,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: const Color(0xFF0F172A)),
                ),
                const SizedBox(height: 8),
                Text(
                  'Manage job readiness, availability, and provisioning workflow details.',
                  style: const TextStyle(color: Color(0xFF64748B), height: 1.45),
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
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x228224E3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Availability controls', style: Theme.of(context).textTheme.titleLarge),
                    const Spacer(),
                    _sectionChip(
                      isOnLeave ? 'On leave' : 'Available',
                      icon: isOnLeave ? Icons.pause_circle_outline_rounded : Icons.check_circle_outline_rounded,
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  isOnLeave
                      ? 'Installer is currently marked on leave.'
                      : 'Installer is currently available for dispatch.',
                  style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x120F172A)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFFFF),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0x120F172A)),
                        ),
                        child: Icon(
                          isOnLeave ? Icons.event_busy_rounded : Icons.local_shipping_outlined,
                          color: const Color(0xFF8224E3),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          isOnLeave
                              ? 'Jobs should not be accepted until leave is ended. Dispatch can restore availability from this tab.'
                              : 'Use leave only when no active field work is in progress. The dispatch queue will reflect your live availability.',
                          style: const TextStyle(color: Color(0xFF64748B), height: 1.45),
                        ),
                      ),
                    ],
                  ),
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
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x228224E3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Account information', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 14),
                _infoRow(Icons.badge_outlined, 'Full name', profile.fullName.isEmpty ? '-' : profile.fullName),
                _infoRow(Icons.call_outlined, 'Phone', profile.phone.isEmpty ? '-' : profile.phone),
                _infoRow(Icons.qr_code_rounded, 'Installer code', profile.installerCode.isEmpty ? '-' : profile.installerCode),
                _infoRow(Icons.event_available_rounded, 'Availability', profile.availabilityStatus),
                _infoRow(Icons.refresh_rounded, 'Session state', appState.busy ? 'Syncing' : 'Ready'),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x228224E3),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Field workflow', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 14),
                _workflowStep('1', 'Review job and customer details', 'Check location, plan, and customer contact before starting field action.'),
                _workflowStep('2', 'Accept and move to site', 'Accept the job, start travel, and mark onsite after reaching the address.'),
                _workflowStep('3', 'Link and verify device health', 'Scan ONT serial, review RX/TX power, and confirm provisioning readiness.'),
                _workflowStep('4', 'Activate and complete handover', 'Run activation, capture proof, verify OTP, and close the job cleanly.'),
              ],
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: appState.busy ? null : appState.refresh,
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: const Text('Refresh'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () => _confirmLogout(appState),
                    child: const Text('Logout'),
                  ),
                ),
              ],
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
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x140F172A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _sectionChip(String label, {required IconData icon}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFD8B4FE)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: const Color(0xFF8224E3)),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x140F172A)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0x140F172A)),
            ),
            child: Icon(icon, size: 18, color: const Color(0xFF8224E3)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontSize: 12, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _workflowStep(String index, String title, String text) {
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
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0xFFD8B4FE)),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    text,
                    style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
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
