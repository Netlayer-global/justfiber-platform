import 'package:flutter/material.dart';

import '../core/app_state.dart';
import 'billing_history_screen.dart';
import 'plan_catalog_screen.dart';
import 'service_tracking_screen.dart';
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
  bool _handlingPendingNavigation = false;

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
    _handlePendingNavigation(appState);
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
      body: SafeArea(child: pages[index]),
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

  void _handlePendingNavigation(AppState appState) {
    if (_handlingPendingNavigation) return;
    final target = appState.consumePendingNavigationTarget();
    if (target == null || target.isEmpty) return;
    _handlingPendingNavigation = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) {
        _handlingPendingNavigation = false;
        return;
      }
      try {
        switch (target) {
          case 'billing':
            if (index != 2) {
              setState(() => index = 2);
            }
            break;
          case 'support':
            if (index != 3) {
              setState(() => index = 3);
            }
            break;
          case 'services':
            if (index != 1) {
              setState(() => index = 1);
            }
            break;
          case 'profile':
            if (index != 4) {
              setState(() => index = 4);
            }
            break;
          case 'plans':
            await Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
            );
            break;
          case 'tracking':
            await Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
            );
            break;
          default:
            if (index != 3) {
              setState(() => index = 3);
            }
        }
      } finally {
        _handlingPendingNavigation = false;
      }
    });
  }
}



