import 'package:flutter/material.dart';

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
    const pages = [
      DashboardTab(),
      JobsTab(),
      NotificationsTab(),
      ProfileTab(),
    ];
    return Scaffold(
      body: FieldBackground(
        child: SafeArea(child: pages[index]),
      ),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.82),
          borderRadius: BorderRadius.circular(32),
          border: Border.all(color: Colors.white.withOpacity(0.7)),
          boxShadow: const [BoxShadow(color: Color(0x148126CF), blurRadius: 24, offset: Offset(0, 10))],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _InstallerNavItem(icon: Icons.dashboard_customize_rounded, label: 'Dashboard', selected: index == 0, onTap: () => setState(() => index = 0)),
            _InstallerNavItem(icon: Icons.assignment_rounded, label: 'Jobs', selected: index == 1, onTap: () => setState(() => index = 1)),
            _InstallerNavItem(icon: Icons.notifications_none_rounded, label: 'Alerts', selected: index == 2, onTap: () => setState(() => index = 2)),
            _InstallerNavItem(icon: Icons.person_outline_rounded, label: 'Profile', selected: index == 3, onTap: () => setState(() => index = 3)),
          ],
        ),
      ),
    );
  }
}

class _InstallerNavItem extends StatelessWidget {
  const _InstallerNavItem({
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
    final color = selected ? const Color(0xFF8126CF) : const Color(0xFF718096);
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
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
