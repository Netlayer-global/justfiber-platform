import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
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
  int _index = 0;
  bool _handlingPendingNavigation = false;

  static const _navItems = [
    (icon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.receipt_long_rounded, label: 'Billing'),
    (icon: Icons.router_rounded, label: 'Network'),
    (icon: Icons.support_agent_rounded, label: 'Support'),
    (icon: Icons.person_rounded, label: 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    _handlePendingNavigation(appState);

    final pages = [
      HomeTab(onNavigate: _goTo),
      const BillingHistoryScreen(),
      const ServiceHubScreen(),
      const SupportHistoryScreen(),
      const ProfileTab(),
    ];

    return Scaffold(
      backgroundColor: kBg,
      body: GradientOrbBackground(child: pages[_index]),
      bottomNavigationBar: _BottomNav(
        current: _index,
        items: _navItems,
        onTap: _goTo,
      ),
    );
  }

  void _goTo(int i) => setState(() => _index = i);

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
            _goTo(2);
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
            await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
            if (mounted) await appState.refresh();
            return;
          case 'tracking_detail':
            if (!mounted) return;
            // ignore: use_build_context_synchronously
            await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()));
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

// Bottom Navigation

typedef _NavItem = ({IconData icon, String label});

class _BottomNav extends StatelessWidget {
  const _BottomNav({
    required this.current,
    required this.items,
    required this.onTap,
  });

  final int current;
  final List<_NavItem> items;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        child: Container(
          height: 70,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF100C1F), Color(0xFF161128)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: kPrimaryLight.withValues(alpha: 0.32)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.4),
                blurRadius: 32,
                offset: const Offset(0, 8),
              ),
              BoxShadow(
                color: kPrimary.withValues(alpha: 0.06),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: List.generate(items.length, (i) {
              final item = items[i];
              final selected = i == current;
              // Centre item (index 2) gets accent treatment
              if (i == 2) {
                return _CentreNavBtn(selected: selected, item: item, onTap: () => onTap(i));
              }
              return _NavBtn(selected: selected, item: item, onTap: () => onTap(i));
            }),
          ),
        ),
      ),
    );
  }
}

class _NavBtn extends StatelessWidget {
  const _NavBtn({required this.selected, required this.item, required this.onTap});

  final bool selected;
  final _NavItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          gradient: selected
              ? const LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFA855F7)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                )
              : null,
          color: selected ? null : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
          border: selected ? Border.all(color: Colors.white.withValues(alpha: 0.18)) : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              item.icon,
              size: 22,
              color: selected ? Colors.white : kPrimaryLight,
            ),
            const SizedBox(height: 3),
            Text(
              item.label,
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w700,
                color: selected ? Colors.white : kPrimaryLight,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CentreNavBtn extends StatelessWidget {
  const _CentreNavBtn({required this.selected, required this.item, required this.onTap});

  final bool selected;
  final _NavItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        width: 60,
        height: 56,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF22D3EE), Color(0xFFA855F7)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: selected ? 0.55 : 0.3),
              blurRadius: selected ? 20 : 10,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(item.icon, color: Colors.white, size: 22),
            const SizedBox(height: 2),
            Text(
              item.label,
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 9,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
