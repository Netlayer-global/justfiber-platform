import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';

class SupportHistoryScreen extends StatelessWidget {
  const SupportHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Support & requests')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFF4F5FF), Color(0xFFFFF3F4)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Get instant support', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 26)),
                const SizedBox(height: 10),
                const Text(
                  'Raise broadband, billing, shift connection, and service complaints from one place.',
                  style: TextStyle(color: Color(0xFF6B7280), height: 1.45),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _issueButton(
                      label: 'Internet issue',
                      onTap: () => _raiseQuickTicket(
                        context,
                        appState,
                        category: 'technical',
                        subject: 'Internet issue',
                        description: 'Customer is facing internet or connectivity issues.',
                      ),
                    ),
                    _issueButton(
                      label: 'Billing issue',
                      onTap: () => _raiseQuickTicket(
                        context,
                        appState,
                        category: 'billing',
                        subject: 'Billing help needed',
                        description: 'Customer needs help with bill, payment, or recharge.',
                      ),
                    ),
                    _issueButton(
                      label: 'Shift connection',
                      onTap: () => _createServiceRequest(
                        context,
                        appState,
                        type: 'shift_connection',
                        note: 'Customer wants to shift the Wi-Fi connection.',
                      ),
                    ),
                    _issueButton(
                      label: 'Plan issue',
                      onTap: () => _createServiceRequest(
                        context,
                        appState,
                        type: 'plan_issue',
                        note: 'Customer needs help with plan or recharge.',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Open requests',
            child: appState.requests.isEmpty
                ? const Text('No requests or complaints yet.', style: TextStyle(color: Color(0xFF6B7280)))
                : Column(
                    children: appState.requests
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _statusRow(item.title, item.createdAt, item.status),
                          ),
                        )
                        .toList(),
                  ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Recent notifications',
            child: appState.notifications.isEmpty
                ? const Text('No support notifications right now.', style: TextStyle(color: Color(0xFF6B7280)))
                : Column(
                    children: appState.notifications.take(8).map((item) {
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
                              Text(item.title, style: const TextStyle(fontWeight: FontWeight.w800)),
                              const SizedBox(height: 6),
                              Text(item.body, style: const TextStyle(color: Color(0xFF6B7280))),
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

  Widget _issueButton({required String label, required VoidCallback onTap}) {
    return OutlinedButton(
      onPressed: onTap,
      child: Text(label),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _statusRow(String title, String createdAt, String status) {
    final color = _statusColor(status);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(createdAt.isEmpty ? '-' : createdAt, style: const TextStyle(color: Color(0xFF6B7280))),
              ],
            ),
          ),
          Text(status, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
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

  Future<void> _createServiceRequest(
    BuildContext context,
    AppState appState, {
    required String type,
    required String note,
  }) async {
    final requestNumber = await appState.submitServiceRequest(type: type, note: note);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(requestNumber == null ? (appState.error ?? 'Unable to create request') : 'Request created: $requestNumber'),
      ),
    );
  }

  Color _statusColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('closed') || normalized.contains('resolved') || normalized.contains('done') || normalized.contains('completed')) {
      return const Color(0xFF16A34A);
    }
    if (normalized.contains('pending') || normalized.contains('open') || normalized.contains('in-progress')) {
      return const Color(0xFFF59E0B);
    }
    return const Color(0xFFD81F26);
  }
}
