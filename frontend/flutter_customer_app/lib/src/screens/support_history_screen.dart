import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';

class SupportHistoryScreen extends StatelessWidget {
  const SupportHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Support & Complaints'),
        backgroundColor: const Color(0xFF090C1A),
        foregroundColor: Colors.white,
      ),
      backgroundColor: const Color(0xFF060816),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF5B132A), Color(0xFF9333EA)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Need help?', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
                const SizedBox(height: 10),
                Text(
                  'Raise broadband, billing, or plan change complaints and track recent requests here.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: appState.busy
                            ? null
                            : () => _raiseQuickTicket(
                                  context,
                                  appState,
                                  category: 'billing',
                                  subject: 'Need billing help',
                                  description: 'Customer needs help with billing, payment, or renewal.',
                                ),
                        child: const Text('Raise billing ticket'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: appState.busy
                            ? null
                            : () => _raiseQuickTicket(
                                  context,
                                  appState,
                                  category: 'technical',
                                  subject: 'Internet issue',
                                  description: 'Customer is facing internet or device related issues.',
                                ),
                        child: const Text('Raise internet issue'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Recent requests', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (appState.requests.isEmpty)
                  const Text('No requests or complaints yet.', style: TextStyle(color: Color(0xFF7B625A)))
                else
                  ...appState.requests.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              margin: const EdgeInsets.only(top: 6),
                              decoration: BoxDecoration(
                                color: _statusColor(item.status),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 4),
                                  Text(item.createdAt, style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12)),
                                ],
                              ),
                            ),
                            Text(
                              item.status,
                              style: TextStyle(color: _statusColor(item.status), fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      )),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Recent notifications', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (appState.notifications.isEmpty)
                  const Text('No support notifications yet.', style: TextStyle(color: Color(0xFF7B625A)))
                else
                  ...appState.notifications.take(6).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text(item.body, style: const TextStyle(color: Color(0xFF7B625A))),
                          ],
                        ),
                      )),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _raiseQuickTicket(
    BuildContext context,
    AppState appState, {
    required String category,
    required String subject,
    required String description,
  }) async {
    final ticketNumber = await appState.raiseComplaint(
      category: category,
      subject: subject,
      description: description,
    );
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ticketNumber == null ? (appState.error ?? 'Unable to create support ticket') : 'Support ticket created: $ticketNumber'),
      ),
    );
    if (ticketNumber != null) {
      await appState.refresh();
    }
  }

  Color _statusColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('closed') || normalized.contains('resolved') || normalized.contains('done')) {
      return const Color(0xFF22C55E);
    }
    if (normalized.contains('pending') || normalized.contains('open')) {
      return const Color(0xFFF59E0B);
    }
    return const Color(0xFFD81F26);
  }
}
