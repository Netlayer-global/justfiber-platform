import 'package:flutter/material.dart';

import '../widgets/gradient_orb_background.dart';
import 'service_hub_screen.dart';
import 'tabs/home_tab.dart';
import 'tabs/profile_tab.dart';
import 'tabs/shop_tab.dart';
import 'tabs/points_tab.dart';

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
      const ShopTab(),
      const PointsTab(),
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
          BottomNavigationBarItem(icon: Icon(Icons.shopping_bag_rounded), label: 'Shop'),
          BottomNavigationBarItem(icon: Icon(Icons.stars_rounded), label: 'Points'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}
