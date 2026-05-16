import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../widgets/curved_nav_bar.dart';
import 'billing_history_screen.dart';
import 'plan_catalog_screen.dart';
import 'service_hub_screen.dart';
import 'service_tracking_screen.dart';
import 'support_screen.dart';
import 'tabs/home_tab.dart';
import 'tabs/profile_tab.dart';

// Tab indices (5 tabs)
// 0 Home | 1 Billing | 2 Services | 3 Support | 4 Profile

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;
  int _prevIndex = 0;
  bool _handlingPendingNavigation = false;

  static const _navItems = [
    CurvedNavItem(
      activeIcon: Icons.home_rounded,
      inactiveIcon: Icons.home_outlined,
    ),
    CurvedNavItem(
      activeIcon: Icons.receipt_long_rounded,
      inactiveIcon: Icons.receipt_long_outlined,
    ),
    CurvedNavItem(
      activeIcon: Icons.wifi_rounded,
      inactiveIcon: Icons.wifi_outlined,
    ),
    CurvedNavItem(
      activeIcon: Icons.support_agent_rounded,
      inactiveIcon: Icons.support_agent_outlined,
    ),
    CurvedNavItem(
      activeIcon: Icons.person_rounded,
      inactiveIcon: Icons.person_outline_rounded,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    _handlePendingNavigation(appState);

    final pages = [
      HomeTab(onNavigate: _goTo),
      const BillingHistoryScreen(),
      const ServiceHubScreen(),
      const SupportScreen(),
      const ProfileTab(),
    ];

    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: kBg,
      extendBody: true,
      body: Column(
        children: [
          if (appState.isOffline)
            Material(
              color: const Color(0xFF1A0A00),
              child: SafeArea(
                bottom: false,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  decoration: const BoxDecoration(
                    border: Border(
                        bottom:
                            BorderSide(color: Color(0xFF7C2D12), width: 1)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.wifi_off_rounded,
                          color: Color(0xFFFB923C), size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'No internet connection. Pull to refresh when back online.',
                          style: GoogleFonts.inter(
                              color: const Color(0xFFFED7AA),
                              fontSize: 12,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => appState.refresh(),
                        child: Text('Retry',
                            style: GoogleFonts.inter(
                                color: const Color(0xFFFB923C),
                                fontSize: 12,
                                fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) {
                final goingRight = _index >= _prevIndex;
                final begin = goingRight
                    ? const Offset(0.05, 0)
                    : const Offset(-0.05, 0);
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: begin,
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                );
              },
              child: KeyedSubtree(
                key: ValueKey<int>(_index),
                child: pages[_index],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: CurvedNavBar(
        items: _navItems,
        currentIndex: _index,
        onTap: _goTo,
        bottomInset: bottomInset,
      ),
    );
  }

  void _goTo(int i) {
    if (i == _index) return;
    setState(() {
      _prevIndex = _index;
      _index = i;
    });
  }

  void _handlePendingNavigation(AppState appState) {
    final target = appState.pendingNavigationTarget;
    if (target == null || target.isEmpty || _handlingPendingNavigation) return;
    _handlingPendingNavigation = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        if (!mounted) return;
        final next = appState.consumePendingNavigationTarget();
        final notifId = appState.consumePendingNotificationReadId();
        if (notifId != null && notifId.isNotEmpty) {
          await appState.markNotificationRead(notifId);
        }
        if (next == null || next.isEmpty) return;
        switch (next) {
          case 'billing':
            _goTo(1);
            await appState.refresh();
            return;
          case 'tracking':
            _goTo(3);
            await appState.refreshBookingTracking();
            return;
          case 'support':
            _goTo(3);
            await appState.refresh();
            return;
          case 'plans':
          case 'plans_resume':
            if (!mounted) return;
            // ignore: use_build_context_synchronously
            await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
            if (mounted) await appState.refresh();
            return;
          case 'tracking_detail':
            if (!mounted) return;
            // ignore: use_build_context_synchronously
            await Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const ServiceTrackingScreen()));
            if (mounted) await appState.refreshBookingTracking();
            return;
          default:
            _goTo(0);
            await appState.refresh();
        }
      } finally {
        _handlingPendingNavigation = false;
      }
    });
  }
}
