import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import 'tabs/complaints_tab.dart';
import 'tabs/dashboard_tab.dart';
import 'tabs/jobs_tab.dart';
import 'tabs/notifications_tab.dart';
import 'tabs/profile_tab.dart';
import 'tabs/sales_tab.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final unread =
        appState.notifications.where((n) => n.readAt == null).length;
    final pendingInstalls = appState.jobs
        .where((j) =>
            j.jobType.toLowerCase().contains('install') &&
            j.status.toLowerCase() == 'assigned')
        .length;
    final pendingComplaints = appState.jobs
        .where((j) =>
            j.jobType.toLowerCase().contains('complaint') &&
            j.status.toLowerCase() == 'assigned')
        .length;

    final pages = [
      const DashboardTab(),
      const JobsTab(),
      const ComplaintsTab(),
      const SalesTab(),
      NotificationsTab(
        onOpenJobs: () => setState(() => _index = 1),
        onOpenComplaints: () => setState(() => _index = 2),
        onOpenDashboard: () => setState(() => _index = 0),
      ),
      const ProfileTab(),
    ];

    return Scaffold(
      backgroundColor: kBg,
      body: SafeArea(
        bottom: false,
        child: pages[_index],
      ),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 14),
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 7),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: kBorder),
          boxShadow: const [
            BoxShadow(
              color: Color(0x558B1CF6),
              blurRadius: 28,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(
              icon: Icons.dashboard_customize_rounded,
              label: 'Dashboard',
              selected: _index == 0,
              onTap: () => setState(() => _index = 0),
            ),
            _NavItem(
              icon: Icons.router_rounded,
              label: 'Installs',
              selected: _index == 1,
              onTap: () => setState(() => _index = 1),
              badge: pendingInstalls > 0 ? '$pendingInstalls' : null,
            ),
            _NavItem(
              icon: Icons.build_circle_rounded,
              label: 'Complaints',
              selected: _index == 2,
              onTap: () => setState(() => _index = 2),
              badge: pendingComplaints > 0 ? '$pendingComplaints' : null,
              badgeColor: const Color(0xFFF59E0B),
            ),
            _NavItem(
              icon: Icons.sell_outlined,
              label: 'Sales',
              selected: _index == 3,
              onTap: () => setState(() => _index = 3),
            ),
            _NavItem(
              icon: Icons.notifications_none_rounded,
              label: 'Alerts',
              selected: _index == 4,
              onTap: () => setState(() => _index = 4),
              badge: unread > 0 ? '$unread' : null,
            ),
            _NavItem(
              icon: Icons.person_outline_rounded,
              label: 'Profile',
              selected: _index == 5,
              onTap: () => setState(() => _index = 5),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
    this.badge,
    this.badgeColor,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? badge;
  final Color? badgeColor;

  @override
  Widget build(BuildContext context) {
    final color = selected ? kPrimaryLight : kSubtle;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? kPrimary.withValues(alpha: 0.12)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icon, color: color, size: 21),
                if (badge != null)
                  Positioned(
                    top: -4,
                    right: -8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: badgeColor ?? kPrimary,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        badge!,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
