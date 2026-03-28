import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/field_background.dart';
import 'tabs/dashboard_tab.dart';
import 'tabs/jobs_tab.dart';
import 'tabs/notifications_tab.dart';
import 'tabs/profile_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    const pages = [
      DashboardTab(),
      JobsTab(),
      NotificationsTab(),
      ProfileTab(),
    ];
    final hasError = (appState.error ?? '').trim().isNotEmpty;
    final syncLabel = appState.busy
        ? 'Syncing latest field data...'
        : hasError
            ? appState.error!.trim()
            : appState.lastSyncedAt == null
                ? 'Waiting for first sync...'
                : 'Last synced ${_formatSyncTime(appState.lastSyncedAt!)}';
    final syncIcon = appState.busy
        ? Icons.sync_rounded
        : hasError
            ? Icons.wifi_tethering_error_rounded
            : Icons.cloud_done_rounded;
    final syncTint = hasError ? const Color(0xFFB45309) : const Color(0xFF8224E3);
    final syncBg = hasError ? const Color(0xFFFFF7ED) : const Color(0xFFF8F4FF);
    final syncBorder = hasError ? const Color(0xFFFCD34D) : const Color(0x558224E3);

    return Scaffold(
      backgroundColor: const Color(0xFFFCFAF7),
      body: FieldBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: syncBg,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: syncBorder),
                  ),
                  child: Row(
                    children: [
                      Icon(syncIcon, size: 18, color: syncTint),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          syncLabel,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: hasError ? const Color(0xFF9A3412) : const Color(0xFF4B1D95),
                            fontWeight: FontWeight.w700,
                            fontSize: 12.5,
                          ),
                        ),
                      ),
                      if (!appState.busy)
                        TextButton(
                          onPressed: () => appState.refresh(),
                          child: const Text('Refresh now'),
                        ),
                    ],
                  ),
                ),
              ),
              Expanded(child: pages[index]),
            ],
          ),
        ),
      ),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: const Color(0x140F172A)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x18000000),
              blurRadius: 26,
              offset: Offset(0, 16),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(26),
          child: BottomNavigationBar(
            currentIndex: index,
            onTap: (value) => setState(() => index = value),
            items: const [
              BottomNavigationBarItem(
                icon: Icon(Icons.dashboard_customize_rounded),
                label: 'Dashboard',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.assignment_rounded),
                label: 'Jobs',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.notifications_active_outlined),
                label: 'Alerts',
              ),
              BottomNavigationBarItem(
                icon: Icon(Icons.person_outline_rounded),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatSyncTime(DateTime value) {
    final now = DateTime.now();
    final difference = now.difference(value);
    if (difference.inSeconds < 30) return 'just now';
    if (difference.inMinutes < 1) return '${difference.inSeconds}s ago';
    if (difference.inHours < 1) return '${difference.inMinutes}m ago';
    if (difference.inDays < 1) return '${difference.inHours}h ago';
    return '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')} ${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
  }
}
