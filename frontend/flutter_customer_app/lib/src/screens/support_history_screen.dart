import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
import 'notifications_screen.dart';

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
              colors: [Color(0xFF0B0F19), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Get instant support',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 26, color: Colors.white),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Raise broadband, billing, shift connection, and service complaints from one place.',
                  style: TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _summaryChip('Tickets', '${appState.tickets.length}')),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryChip('Requests', '${appState.requests.length}')),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryChip('Alerts', '${appState.notifications.length}')),
                  ],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0x6600F5D4)),
                      ),
                      child: const Text('Open alerts center'),
                    ),
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
                        type: 'shift',
                        note: 'Customer wants to shift the Wi-Fi connection.',
                      ),
                    ),
                    _issueButton(
                      label: 'Plan issue',
                      onTap: () => _createServiceRequest(
                        context,
                        appState,
                        type: 'complaint',
                        note: 'Customer needs help with current plan or recharge.',
                      ),
                    ),
                    _issueButton(
                      label: 'Create ticket',
                      onTap: () => _showCreateTicketSheet(context, appState),
                    ),
                    _issueButton(
                      label: 'Create request',
                      onTap: () => _showCreateRequestSheet(context, appState),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Support tickets',
            child: appState.tickets.isEmpty
                ? const Text('No support tickets yet.', style: TextStyle(color: Color(0xFF6B7280)))
                : Column(
                    children: appState.tickets
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _statusRow(
                              title: item.subject,
                              subtitle: '${item.ticketNumber} | ${item.category}',
                              createdAt: item.createdAt,
                              status: item.status,
                              onTap: () => _showTicketDetails(context, item),
                            ),
                          ),
                        )
                        .toList(),
                  ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Service requests',
            child: appState.requests.isEmpty
                ? const Text('No service requests yet.', style: TextStyle(color: Color(0xFF6B7280)))
                : Column(
                    children: appState.requests
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _statusRow(
                              title: item.title,
                              subtitle: '${item.referenceNumber} | ${item.type}',
                              createdAt: item.createdAt,
                              status: item.status,
                              onTap: () => _showRequestDetails(context, item),
                            ),
                          ),
                        )
                        .toList(),
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

  Widget _summaryChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0x1400F5D4),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x6600F5D4)),
      ),
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Colors.white)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w700)),
        ],
      ),
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

  Widget _statusRow({
    required String title,
    required String subtitle,
    required String createdAt,
    required String status,
    required VoidCallback onTap,
  }) {
    final color = _statusColor(status);
    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FBFF),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0x2200C2FF)),
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
                  Text(subtitle, style: const TextStyle(color: Color(0xFF4B5563), fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(createdAt.isEmpty ? '-' : createdAt, style: const TextStyle(color: Color(0xFF6B7280))),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(status, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                const Icon(Icons.chevron_right_rounded, color: Color(0xFF9CA3AF)),
              ],
            ),
          ],
        ),
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
    if (requestNumber != null) {
      await appState.refresh();
    }
  }

  Future<void> _showCreateTicketSheet(BuildContext context, AppState appState) async {
    final subjectController = TextEditingController();
    final descriptionController = TextEditingController();
    String category = 'technical';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (_, setModalState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Create support ticket', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: ['technical', 'billing', 'account', 'service'].map((item) {
                        return ChoiceChip(
                          label: Text(item),
                          selected: category == item,
                          onSelected: (_) => setModalState(() => category = item),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: subjectController,
                      decoration: const InputDecoration(labelText: 'Subject'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: descriptionController,
                      minLines: 3,
                      maxLines: 5,
                      decoration: const InputDecoration(labelText: 'Describe the issue'),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () async {
                          final subject = subjectController.text.trim();
                          final description = descriptionController.text.trim();
                          if (subject.isEmpty || description.isEmpty) return;
                          Navigator.pop(sheetContext);
                          await _raiseQuickTicket(
                            context,
                            appState,
                            category: category,
                            subject: subject,
                            description: description,
                          );
                        },
                        child: const Text('Submit ticket'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _showCreateRequestSheet(BuildContext context, AppState appState) async {
    final noteController = TextEditingController();
    String requestType = 'complaint';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (_, setModalState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + MediaQuery.of(sheetContext).viewInsets.bottom),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Create service request', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: ['complaint', 'shift', 'disconnect', 'link_service'].map((item) {
                        return ChoiceChip(
                          label: Text(item),
                          selected: requestType == item,
                          onSelected: (_) => setModalState(() => requestType = item),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 14),
                    TextField(
                      controller: noteController,
                      minLines: 3,
                      maxLines: 5,
                      decoration: const InputDecoration(labelText: 'Request note'),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () async {
                          final note = noteController.text.trim();
                          if (note.isEmpty) return;
                          Navigator.pop(sheetContext);
                          await _createServiceRequest(
                            context,
                            appState,
                            type: requestType,
                            note: note,
                          );
                        },
                        child: const Text('Submit request'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _showTicketDetails(BuildContext context, SupportTicketItem item) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _DetailSheet(
        title: item.subject,
        subtitle: '${item.ticketNumber} | ${item.category}',
        reference: item.ticketNumber,
        status: item.status,
        lines: [
          'Priority: ${item.priority}',
          'Created: ${item.createdAt.isEmpty ? '-' : item.createdAt}',
          'Description: ${item.description.isEmpty ? '-' : item.description}',
        ],
      ),
    );
  }

  Future<void> _showRequestDetails(BuildContext context, RequestItem item) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _DetailSheet(
        title: item.title,
        subtitle: '${item.referenceNumber} | ${item.type}',
        reference: item.referenceNumber,
        status: item.status,
        lines: [
          'Created: ${item.createdAt.isEmpty ? '-' : item.createdAt}',
          'Type: ${item.type}',
          'Note: ${item.note.isEmpty ? '-' : item.note}',
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('closed') || normalized.contains('resolved') || normalized.contains('done') || normalized.contains('completed')) {
      return const Color(0xFF16A34A);
    }
    if (normalized.contains('pending') || normalized.contains('open') || normalized.contains('in_progress') || normalized.contains('in-progress')) {
      return const Color(0xFFF59E0B);
    }
    return const Color(0xFFD81F26);
  }
}

class _DetailSheet extends StatelessWidget {
  const _DetailSheet({
    required this.title,
    required this.subtitle,
    required this.reference,
    required this.status,
    required this.lines,
  });

  final String title;
  final String subtitle;
  final String reference;
  final String status;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24)),
            const SizedBox(height: 6),
            Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280), fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(status, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFD81F26))),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: reference));
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Reference copied')),
                      );
                    }
                  },
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: const Text('Copy ref'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            for (final line in lines)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Text(line, style: const TextStyle(height: 1.45)),
              ),
          ],
        ),
      ),
    );
  }
}
