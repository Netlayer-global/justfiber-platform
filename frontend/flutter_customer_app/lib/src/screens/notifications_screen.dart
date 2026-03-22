import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'support_history_screen.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final notifications = appState.notifications;

    return Scaffold(
      appBar: AppBar(title: const Text('Alerts & updates')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFF4F5FF), Color(0xFFEFF6FF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Stay updated', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 26)),
                const SizedBox(height: 10),
                Text(
                  notifications.isEmpty
                      ? 'There are no active alerts right now.'
                      : 'You have ${notifications.length} recent service, billing, or support alerts.',
                  style: const TextStyle(color: Color(0xFF6B7280), height: 1.45),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton(
                      onPressed: appState.busy ? null : appState.refresh,
                      child: const Text('Refresh'),
                    ),
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
                      ),
                      child: const Text('Open Support Center'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: notifications.isEmpty
                ? const Text('No alerts to show right now.', style: TextStyle(color: Color(0xFF6B7280)))
                : Column(
                    children: notifications.map((item) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                              const SizedBox(height: 6),
                              Text(item.body, style: const TextStyle(color: Color(0xFF6B7280), height: 1.45)),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
          ),
        ],
      ),
    );
  }
}
