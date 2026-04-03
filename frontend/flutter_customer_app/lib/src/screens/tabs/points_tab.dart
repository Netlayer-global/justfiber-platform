import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class PointsTab extends StatelessWidget {
  const PointsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final requests = appState.requests;
    final notifications = appState.notifications;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 130),
      children: [
        Text('Support & Tickets', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(colors: [Color(0xFF2A1A69), Color(0xFF6F3DFF)]),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('24/7 Concierge Support', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
              const SizedBox(height: 10),
              Text(
                'Raise a complaint, track ticket progress and reach support without leaving the app.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () async {
                  final ticketNumber = await appState.raiseComplaint(
                    category: 'internet',
                    subject: 'Connection issue',
                    description: 'Raised from customer app support tab.',
                  );
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        ticketNumber == null ? (appState.error ?? 'Unable to raise ticket') : 'Ticket created: $ticketNumber',
                      ),
                    ),
                  );
                },
                style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: const Color(0xFF4A3B81)),
                child: const Text('Raise Ticket'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ticket History', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              if (requests.isEmpty)
                const Text('No recent tickets or service requests yet.')
              else
                ...requests.take(5).map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: item.status.toLowerCase().contains('close') ? Colors.grey : Colors.green,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.title, style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 4),
                              Text(item.createdAt, style: Theme.of(context).textTheme.bodyMedium),
                            ],
                          ),
                        ),
                        Text(item.status, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: const Color(0xFF8126CF))),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text('Help updates', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        ...(notifications.isEmpty
            ? [const AppCard(child: Text('No notifications right now.'))]
            : notifications.take(5).map(
                (item) => Padding(
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
                ),
              )),
      ],
    );
  }
}
