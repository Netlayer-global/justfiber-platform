import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class PointsTab extends StatelessWidget {
  const PointsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Text('Points', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(colors: [Color(0xFF2A1A69), Color(0xFF6F3DFF)]),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Legends Card'),
              const SizedBox(height: 18),
              RichText(
                text: TextSpan(
                  text: dashboard.points.toString(),
                  style: Theme.of(context).textTheme.headlineMedium,
                  children: const [
                    TextSpan(text: ' Points', style: TextStyle(fontSize: 18)),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              LinearProgressIndicator(
                value: 0.7,
                minHeight: 7,
                color: const Color(0xFF3D9BFF),
                backgroundColor: Colors.white24,
                borderRadius: BorderRadius.circular(999),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Benefit of Legends User'),
              SizedBox(height: 12),
              Text('1. Always get a discount up to 10 percent on all available items, Terms and Conditions apply.'),
              SizedBox(height: 12),
              Text('2. Get free admin fees on all transactions and on all items in this application.'),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text('Notifications', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        ...(appState.notifications.isEmpty
            ? [const AppCard(child: Text('No notifications right now.'))]
            : appState.notifications.take(5).map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.title, style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Text(item.body, style: Theme.of(context).textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ))),
      ],
    );
  }
}
