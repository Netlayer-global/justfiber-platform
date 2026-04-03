import 'package:flutter/material.dart';

import '../widgets/gradient_orb_background.dart';
import 'tabs/home_tab.dart';
import 'tabs/points_tab.dart';
import 'tabs/profile_tab.dart';
import 'tabs/stats_tab.dart';
import 'tabs/shop_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeTab(onNavigate: _openTab),
      const StatsTab(),
      const ShopTab(),
      const PointsTab(),
      const ProfileTab(),
    ];
    return Scaffold(
      body: GradientOrbBackground(
        child: SafeArea(child: pages[index]),
      ),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.78),
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: Colors.white.withOpacity(0.7)),
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
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
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
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xFFA855F7), Color(0xFF8126CF)]),
          borderRadius: BorderRadius.circular(22),
          boxShadow: selected
              ? const [BoxShadow(color: Color(0x228126CF), blurRadius: 18, offset: Offset(0, 8))]
              : null,
        ),
        child: const Icon(Icons.router_rounded, color: Colors.white),
      ),
    );
  }
}
