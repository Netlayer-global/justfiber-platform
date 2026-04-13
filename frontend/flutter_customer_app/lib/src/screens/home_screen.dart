import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/gradient_orb_background.dart';
import 'billing_history_screen.dart';
import 'plan_catalog_screen.dart';
import 'service_hub_screen.dart';
import 'service_tracking_screen.dart';
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

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    _handlePendingNavigation(appState);
    final pages = [
      HomeTab(onNavigate: _openTab),
      const BillingHistoryScreen(),
      const ServiceHubScreen(),
      const SupportHistoryScreen(),
      const ProfileTab(),
    ];
    return Scaffold(
      body: GradientOrbBackground(
        child: SafeArea(child: pages[index]),
      ),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.82),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0x228224E3)),
          boxShadow: const [
            BoxShadow(color: Color(0x148126CF), blurRadius: 24, offset: Offset(0, 10)),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(icon: Icons.home_rounded, label: 'Home', selected: index == 0, onTap: () => _openTab(0)),
            _NavItem(icon: Icons.payments_rounded, label: 'Billing', selected: index == 1, onTap: () => _openTab(1)),
            _CenterNavItem(selected: index == 2, onTap: () => _openTab(2)),
            _NavItem(icon: Icons.support_agent_rounded, label: 'Support', selected: index == 3, onTap: () => _openTab(3)),
            _NavItem(icon: Icons.person_rounded, label: 'Profile', selected: index == 4, onTap: () => _openTab(4)),
          ],
        ),
      ),
    );
  }

  void _openTab(int value) => setState(() => index = value);

  void _handlePendingNavigation(AppState appState) {
    final target = appState.pendingNavigationTarget;
    if (target == null || target.isEmpty || _handlingPendingNavigation) return;
    _handlingPendingNavigation = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        if (!mounted) return;
        final nextTarget = appState.consumePendingNavigationTarget();
        final notificationId = appState.consumePendingNotificationReadId();
        if (notificationId != null && notificationId.isNotEmpty) {
          await appState.markNotificationRead(notificationId);
        }
        if (nextTarget == null || nextTarget.isEmpty) return;
        switch (nextTarget) {
          case 'billing':
            _openTab(1);
            await appState.refresh();
            return;
          case 'tracking':
            _openTab(2);
            await appState.refreshBookingTracking();
            return;
          case 'support':
            _openTab(3);
            await appState.refresh();
            return;
          case 'plans':
          case 'plans_resume':
            await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
            if (mounted) {
              await appState.refresh();
            }
            return;
          case 'tracking_detail':
            await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()));
            if (mounted) {
              await appState.refreshBookingTracking();
            }
            return;
          default:
            _openTab(0);
            await appState.refresh();
        }
      } finally {
        _handlingPendingNavigation = false;
      }
    });
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? const Color(0xFF8126CF) : const Color(0xFF8F8B99);
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFF3EDFB) : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: color)),
          ],
        ),
      ),
    );
  }
}

class _CenterNavItem extends StatelessWidget {
  const _CenterNavItem({required this.selected, required this.onTap});

  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(24),
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 58,
        height: 58,
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xFFA855F7), Color(0xFF8126CF)]),
          borderRadius: BorderRadius.circular(20),
          boxShadow: selected
              ? const [BoxShadow(color: Color(0x228126CF), blurRadius: 18, offset: Offset(0, 8))]
              : null,
        ),
        child: const Icon(Icons.router_rounded, color: Colors.white),
      ),
    );
  }
}
