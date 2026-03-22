import 'package:flutter/material.dart';

import '../widgets/gradient_orb_background.dart';
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

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeTab(onNavigate: (value) => setState(() => index = value)),
      const ServiceHubScreen(),
      const BillingHistoryScreen(),
      const SupportHistoryScreen(),
      const ProfileTab(),
    ];
    return Scaffold(
      body: GradientOrbBackground(
        child: SafeArea(child: pages[index]),
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: index,
        onTap: (value) => setState(() => index = value),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.wifi_rounded), label: 'Services'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_rounded), label: 'Billing'),
          BottomNavigationBarItem(icon: Icon(Icons.support_agent_rounded), label: 'Support'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
