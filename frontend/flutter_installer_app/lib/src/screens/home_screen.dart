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
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        decoration: BoxDecoration(
          color: const Color(0xFF0C1018),
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: const Color(0x55E6FF3C)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x22000000),
              blurRadius: 24,
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
                icon: Icon(Icons.notifications_none_rounded),
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
}
