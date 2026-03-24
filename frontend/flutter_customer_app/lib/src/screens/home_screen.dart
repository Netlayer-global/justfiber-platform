import 'package:flutter/material.dart';

import '../core/app_state.dart';
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
    final pages = [
      HomeTab(onNavigate: (value) => _setIndex(value)),
      const ServiceHubScreen(),
      const BillingHistoryScreen(),
      const SupportHistoryScreen(),
      const ProfileTab(),
    ];
    return Scaffold(
      backgroundColor: const Color(0xFFFCFAF7),
      body: GradientOrbBackground(
        child: SafeArea(child: pages[index]),
      ),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(28),
          boxShadow: const [
            BoxShadow(color: Color(0x18000000), blurRadius: 28, offset: Offset(0, 16)),
            BoxShadow(color: Color(0x08FFFFFF), blurRadius: 8, offset: Offset(0, -2)),
          ],
          border: Border.all(color: const Color(0x14B9B2AA)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(28),
          child: BottomNavigationBar(
            currentIndex: index,
            onTap: (value) => _setIndex(value),
            items: const [
              BottomNavigationBarItem(icon: Icon(Icons.home_rounded), label: 'Home'),
              BottomNavigationBarItem(icon: Icon(Icons.wifi_rounded), label: 'Services'),
              BottomNavigationBarItem(icon: Icon(Icons.receipt_long_rounded), label: 'Billing'),
              BottomNavigationBarItem(icon: Icon(Icons.support_agent_rounded), label: 'Support'),
              BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Profile'),
            ],
          ),
        ),
      ),
    );
  }
}



