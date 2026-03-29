import 'package:flutter/material.dart';

import '../core/app_state.dart';
import 'billing_history_screen.dart';
import 'service_hub_screen.dart';
import 'support_history_screen.dart';
import 'tabs/home_tab.dart';
import 'tabs/profile_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int index = 0;

  String _syncLabel(DateTime? value) {
    if (value == null) return 'Not synced yet';
    final diff = DateTime.now().difference(value);
    if (diff.inMinutes < 1) return 'Synced just now';
    if (diff.inHours < 1) return 'Synced ${diff.inMinutes}m ago';
    if (diff.inDays < 1) return 'Synced ${diff.inHours}h ago';
    return 'Synced ${diff.inDays}d ago';
  }

  Future<void> _setIndex(int value) async {
    final appState = AppStateScope.of(context);
    if (value == index) {
      if (appState.session != null && !appState.busy) {
        await appState.refresh();
      }
      return;
    }
    setState(() => index = value);
    if (appState.session != null && !appState.busy) {
      await appState.refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final unreadAlerts = appState.notifications.where((item) => item.readAt.isEmpty).length;
    final billingAttention = appState.billing.dueAmount > 0;
    final pages = [
      HomeTab(onNavigate: (value) => _setIndex(value)),
      const ServiceHubScreen(),
      const BillingHistoryScreen(),
      const SupportHistoryScreen(),
      const ProfileTab(),
    ];
    return Scaffold(
      backgroundColor: const Color(0xFFFCFAF7),
      body: SafeArea(
        child: Column(
          children: [
            if (appState.session != null)
              Container(
                margin: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: appState.error == null ? const Color(0xFFFFFFFF) : const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: appState.error == null ? const Color(0x228224E3) : const Color(0x33F97316),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      appState.busy ? Icons.sync_rounded : (appState.error == null ? Icons.cloud_done_rounded : Icons.wifi_off_rounded),
                      size: 18,
                      color: appState.error == null ? const Color(0xFF8224E3) : const Color(0xFFEA580C),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        appState.busy
                            ? 'Syncing latest account data...'
                            : (appState.error ?? _syncLabel(appState.lastSyncedAt)),
                        style: TextStyle(
                          color: appState.error == null ? const Color(0xFF4B5563) : const Color(0xFF9A3412),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: appState.busy ? null : () => appState.refresh(),
                      child: const Text('Refresh'),
                    ),
                  ],
                ),
              ),
            Expanded(child: pages[index]),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(28),
          boxShadow: const [
            BoxShadow(color: Color(0x12000000), blurRadius: 28, offset: Offset(0, 16)),
          ],
          border: Border.all(color: const Color(0x228224E3)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: BottomNavigationBar(
            currentIndex: index,
            onTap: (value) => _setIndex(value),
            items: [
              BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
              BottomNavigationBarItem(icon: Icon(Icons.wifi_rounded), label: 'Services'),
              BottomNavigationBarItem(
                icon: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.receipt_long_rounded),
                    if (billingAttention)
                      Positioned(
                        right: -8,
                        top: -6,
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDC2626),
                            borderRadius: BorderRadius.circular(99),
                            border: Border.all(color: const Color(0xFFFFFFFF), width: 2),
                          ),
                        ),
                      ),
                  ],
                ),
                label: 'Billing',
              ),
              BottomNavigationBarItem(
                icon: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    const Icon(Icons.support_agent_rounded),
                    if (unreadAlerts > 0)
                      Positioned(
                        right: -12,
                        top: -10,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                            color: const Color(0xFF8224E3),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: const Color(0xFFFFFFFF), width: 2),
                          ),
                          child: Text(
                            unreadAlerts > 9 ? '9+' : '$unreadAlerts',
                            style: const TextStyle(
                              color: Color(0xFFFFFFFF),
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                label: 'Support',
              ),
              const BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Profile'),
            ],
          ),
        ),
      ),
    );
  }
}



