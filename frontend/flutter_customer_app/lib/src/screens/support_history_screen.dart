import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
import 'notifications_screen.dart';
import 'plan_catalog_screen.dart';

class SupportHistoryScreen extends StatelessWidget {
  const SupportHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final theme = Theme.of(context);
    final billing = appState.billing;
    CustomerConnection? selectedConnection;
    for (final item in appState.connections) {
      if (item.customerId == appState.selectedCustomerId) {
        selectedConnection = item;
        break;
      }
    }
    final usageRatio = billing.usageCapGb > 0 ? (billing.usageGb / billing.usageCapGb).clamp(0, 1) : 0.0;
    final showUpgradePrompt = billing.usageCapReached || (billing.usageCapGb > 0 && usageRatio >= 0.65);

    return Scaffold(
      appBar: AppBar(title: const Text('Support & requests')),
      body: RefreshIndicator(
        color: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFF6F1EB),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
          children: [
          if (selectedConnection != null) ...[
            _connectionStrip(selectedConnection),
            const SizedBox(height: 18),
          ],
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SUPPORT DESK',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: const Color(0xFFE9D5FF),
                    letterSpacing: 3.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Get instant support',
                  style: theme.textTheme.headlineSmall?.copyWith(
                    color: const Color(0xFFFFFFFF),
                    fontSize: 28,
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'Raise broadband, billing, shift connection, and service complaints from one place.',
                  style: TextStyle(color: Color(0xFFF3E8FF), height: 1.45),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(child: _summaryChip('Tickets', '${appState.tickets.length}')),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryChip('Requests', '${appState.requests.length}')),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryChip('Alerts', '${appState.notifications.length}')),
                  ],
                ),
                const SizedBox(height: 18),
                const Text(
                  'Quick actions',
                  style: TextStyle(
                    color: Color(0xFFE9D5FF),
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _issueButton(
                      label: 'Internet issue',
                      icon: Icons.wifi_tethering_error_rounded,
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
                      icon: Icons.receipt_long_rounded,
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
                      icon: Icons.swap_horiz_rounded,
                      onTap: () => _createServiceRequest(
                        context,
                        appState,
                        type: 'shift',
                        note: 'Customer wants to shift the Wi-Fi connection.',
                      ),
                    ),
                    _issueButton(
                      label: 'Plan issue',
                      icon: Icons.auto_awesome_motion_rounded,
                      onTap: () => _createServiceRequest(
                        context,
                        appState,
                        type: 'complaint',
                        note: 'Customer needs help with current plan or recharge.',
                      ),
                    ),
                    _issueButton(
                      label: 'Create ticket',
                      icon: Icons.support_agent_rounded,
                      onTap: () => _showCreateTicketSheet(context, appState),
                    ),
                    _issueButton(
                      label: 'Create request',
                      icon: Icons.assignment_rounded,
                      onTap: () => _showCreateRequestSheet(context, appState),
                    ),
                    FilledButton.tonal(
                      onPressed: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                        );
                        if (context.mounted) {
                          await appState.refresh();
                        }
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                      ),
                      child: const Text('Open alerts center'),
                    ),
                    if (showUpgradePrompt)
                      FilledButton(
                        onPressed: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                          );
                          if (context.mounted) {
                            await appState.refresh();
                          }
                        },
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                        ),
                        child: Text(billing.usageCapReached ? 'Upgrade capped plan' : 'Upgrade before FUP'),
                      ),
                  ],
                ),
                if (showUpgradePrompt) ...[
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFFFF),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: billing.usageCapReached ? const Color(0x55FF6B6B) : const Color(0x558224E3)),
                    ),
                    child: Text(
                      billing.usageCapReached
                          ? 'Your current plan has reached its data policy threshold. Upgrade from here if you want faster service restored.'
                          : 'You are close to your current plan limit. Upgrade now if you want to avoid reduced speed or cap action.',
                      style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),
          _sectionCard(
            title: 'Support tickets',
            child: appState.tickets.isEmpty
                ? _emptyState(
                    title: 'No support tickets yet.',
                    subtitle: 'Create a ticket for billing, internet, or account issues from the quick actions above.',
                    actionLabel: 'Create ticket',
                    onTap: () => _showCreateTicketSheet(context, appState),
                  )
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
                              onTap: () async {
                                await _showTicketDetails(context, item);
                                if (context.mounted) {
                                  await appState.refresh();
                                }
                              },
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
                ? _emptyState(
                    title: 'No service requests yet.',
                    subtitle: 'Need a shift, disconnect, or service change? Create a request from this screen.',
                    actionLabel: 'Create request',
                    onTap: () => _showCreateRequestSheet(context, appState),
                  )
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
                              onTap: () async {
                                await _showRequestDetails(context, item);
                                if (context.mounted) {
                                  await appState.refresh();
                                }
                              },
                            ),
                          ),
                        )
                        .toList(),
                  ),
          ),
          ],
        ),
      ),
    );
  }

  Widget _issueButton({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFFFFFFF),
        side: const BorderSide(color: Color(0x338224E3)),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    );
  }

  Widget _summaryChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0x26FFFFFF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x668224E3)),
      ),
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFFFFFFFF))),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFFE9D5FF), fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _connectionStrip(CustomerConnection connection) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CURRENT CONNECTION',
            style: TextStyle(
              color: Color(0xFF8224E3),
              fontWeight: FontWeight.w800,
              letterSpacing: 2.2,
              fontSize: 11,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            connection.planName.isEmpty ? 'Broadband connection' : connection.planName,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313)),
          ),
          const SizedBox(height: 6),
          Text(
            connection.address.isEmpty ? connection.serviceId : connection.address,
            style: const TextStyle(color: Color(0xFF6E6A67), height: 1.35),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _connectionPill('Service', connection.serviceId.isEmpty ? connection.customerId : connection.serviceId),
              _connectionPill('Billing', connection.paymentStatus.isEmpty ? 'pending' : connection.paymentStatus),
              _connectionPill('Mode', connection.billMode.isEmpty ? '-' : connection.billMode),
            ],
          ),
        ],
      ),
    );
  }

  Widget _connectionPill(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Text(
        '$label: $value',
        style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _sectionCard({required String title, required Widget child}) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: Color(0xFF131313))),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _emptyState({
    required String title,
    required String subtitle,
    required String actionLabel,
    required VoidCallback onTap,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(subtitle, style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45)),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: onTap,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
            ),
            child: Text(actionLabel),
          ),
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
          gradient: const LinearGradient(
            colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0x228224E3)),
          boxShadow: const [
            BoxShadow(color: Color(0x0A8224E3), blurRadius: 10, offset: Offset(0, 2)),
          ],
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
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF131313))),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(createdAt.isEmpty ? '-' : createdAt, style: const TextStyle(color: Color(0xFF6E6A67))),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: color.withValues(alpha: 0.28)),
              ),
              child: Text(status, style: TextStyle(color: color, fontWeight: FontWeight.w800)),
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
    if (ticketNumber != null) {
      await appState.refresh();
      final latestTicket = _findLatestTicket(appState, ticketNumber);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Support ticket created: $ticketNumber'),
          action: latestTicket == null
              ? null
              : SnackBarAction(
                  label: 'View',
                  onPressed: () {
                    _showTicketDetails(context, latestTicket);
                  },
                ),
        ),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(appState.error ?? 'Unable to create support ticket'),
      ),
    );
  }

  Future<void> _showTicketCreatedFeedback(
    BuildContext context,
    AppState appState,
    String ticketNumber,
  ) async {
    await appState.refresh();
    if (!context.mounted) return;
    final latestTicket = _findLatestTicket(appState, ticketNumber);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Support ticket created: $ticketNumber'),
        action: latestTicket == null
            ? null
            : SnackBarAction(
                label: 'View',
                onPressed: () {
                  _showTicketDetails(context, latestTicket);
                },
              ),
      ),
    );
  }

  Future<void> _createServiceRequest(
    BuildContext context,
    AppState appState, {
    required String type,
    required String note,
  }) async {
    final requestNumber = await appState.submitServiceRequest(type: type, note: note);
    if (!context.mounted) return;
    if (requestNumber != null) {
      await appState.refresh();
      final latestRequest = _findLatestRequest(appState, requestNumber);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Request created: $requestNumber'),
          action: latestRequest == null
              ? null
              : SnackBarAction(
                  label: 'View',
                  onPressed: () {
                    _showRequestDetails(context, latestRequest);
                  },
                ),
        ),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(appState.error ?? 'Unable to create request'),
      ),
    );
  }

  Future<void> _showCreateTicketSheet(BuildContext context, AppState appState) async {
    final subjectController = TextEditingController();
    final descriptionController = TextEditingController();
    String category = 'technical';
    bool submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (_, setModalState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(12, 16, 12, 12 + MediaQuery.of(sheetContext).viewInsets.bottom),
                child: AppCard(
                  color: const Color(0xFFFFFFFF),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Create support ticket',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: const Color(0xFF131313)),
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Open a broadband or billing support case and keep the conversation inside one ticket.',
                        style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: ['technical', 'billing', 'account', 'service'].map((item) {
                          final selected = category == item;
                          return ChoiceChip(
                            label: Text(item),
                            selected: selected,
                            labelStyle: TextStyle(
                              color: selected ? const Color(0xFF031B17) : const Color(0xFF131313),
                              fontWeight: FontWeight.w700,
                            ),
                            backgroundColor: const Color(0xFFF8F4FF),
                            selectedColor: const Color(0xFF8224E3),
                            side: const BorderSide(color: Color(0x668224E3)),
                            onSelected: submitting ? null : (_) => setModalState(() => category = item),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: subjectController,
                        enabled: !submitting,
                        style: const TextStyle(color: const Color(0xFF131313)),
                        decoration: const InputDecoration(labelText: 'Subject'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: descriptionController,
                        enabled: !submitting,
                        style: const TextStyle(color: const Color(0xFF131313)),
                        minLines: 3,
                        maxLines: 5,
                        decoration: const InputDecoration(labelText: 'Describe the issue'),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: submitting
                              ? null
                              : () async {
                            final subject = subjectController.text.trim();
                            final description = descriptionController.text.trim();
                            if (subject.isEmpty || description.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Enter subject and description before submitting.')),
                              );
                              return;
                            }
                            setModalState(() => submitting = true);
                            final ticketNumber = await appState.raiseComplaint(
                              category: category,
                              subject: subject,
                              description: description,
                            );
                            if (!context.mounted) return;
                            if (ticketNumber != null) {
                              Navigator.pop(sheetContext);
                              await _showTicketCreatedFeedback(context, appState, ticketNumber);
                              return;
                            }
                            setModalState(() => submitting = false);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(appState.error ?? 'Unable to create support ticket')),
                            );
                          },
                          child: Text(submitting ? 'Submitting...' : 'Submit ticket'),
                        ),
                      ),
                    ],
                  ),
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
    bool submitting = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (_, setModalState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(12, 16, 12, 12 + MediaQuery.of(sheetContext).viewInsets.bottom),
                child: AppCard(
                  color: const Color(0xFFFFFFFF),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Create service request',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: const Color(0xFF131313)),
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'Use a service request for shift, disconnect, linkage, or other connection changes.',
                        style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: ['complaint', 'shift', 'disconnect', 'link_service'].map((item) {
                          final selected = requestType == item;
                          return ChoiceChip(
                            label: Text(item),
                            selected: selected,
                            labelStyle: TextStyle(
                              color: selected ? const Color(0xFF031B17) : const Color(0xFF131313),
                              fontWeight: FontWeight.w700,
                            ),
                            backgroundColor: const Color(0xFFF8F4FF),
                            selectedColor: const Color(0xFF8224E3),
                            side: const BorderSide(color: Color(0x668224E3)),
                            onSelected: submitting ? null : (_) => setModalState(() => requestType = item),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: noteController,
                        enabled: !submitting,
                        style: const TextStyle(color: const Color(0xFF131313)),
                        minLines: 3,
                        maxLines: 5,
                        decoration: const InputDecoration(labelText: 'Request note'),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: submitting
                              ? null
                              : () async {
                            final note = noteController.text.trim();
                            if (note.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Enter request note before submitting.')),
                              );
                              return;
                            }
                            setModalState(() => submitting = true);
                            final requestNumber = await appState.submitServiceRequest(
                              type: requestType,
                              note: note,
                            );
                            if (!context.mounted) return;
                            if (requestNumber != null) {
                              Navigator.pop(sheetContext);
                              await appState.refresh();
                              final latestRequest = _findLatestRequest(appState, requestNumber);
                              if (!context.mounted) return;
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Request created: $requestNumber'),
                                  action: latestRequest == null
                                      ? null
                                      : SnackBarAction(
                                          label: 'View',
                                          onPressed: () {
                                            _showRequestDetails(context, latestRequest);
                                          },
                                        ),
                                ),
                              );
                              return;
                            }
                            setModalState(() => submitting = false);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(appState.error ?? 'Unable to create request')),
                            );
                          },
                          child: Text(submitting ? 'Submitting...' : 'Submit request'),
                        ),
                      ),
                    ],
                  ),
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
        statusColor: _statusColor(item.status),
        lines: [
          'Priority: ${item.priority}',
          'Created: ${item.createdAt.isEmpty ? '-' : item.createdAt}',
          'Description: ${item.description.isEmpty ? '-' : item.description}',
          'Latest update: ${item.latestUpdateNote.isEmpty ? '-' : item.latestUpdateNote}',
          'Updated at: ${item.latestUpdateAt.isEmpty ? '-' : item.latestUpdateAt}',
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
        statusColor: _statusColor(item.status),
        lines: [
          'Created: ${item.createdAt.isEmpty ? '-' : item.createdAt}',
          'Type: ${item.type}',
          'Note: ${item.note.isEmpty ? '-' : item.note}',
          'Latest update: ${item.latestUpdateNote.isEmpty ? '-' : item.latestUpdateNote}',
          'Updated at: ${item.latestUpdateAt.isEmpty ? '-' : item.latestUpdateAt}',
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

  SupportTicketItem? _findLatestTicket(AppState appState, String ticketNumber) {
    for (final item in appState.tickets) {
      if (item.ticketNumber == ticketNumber) return item;
    }
    return appState.tickets.isNotEmpty ? appState.tickets.first : null;
  }

  RequestItem? _findLatestRequest(AppState appState, String requestNumber) {
    for (final item in appState.requests) {
      if (item.referenceNumber == requestNumber) return item;
    }
    return appState.requests.isNotEmpty ? appState.requests.first : null;
  }
}

class _DetailSheet extends StatelessWidget {
  const _DetailSheet({
    required this.title,
    required this.subtitle,
    required this.reference,
    required this.status,
    required this.statusColor,
    required this.lines,
  });

  final String title;
  final String subtitle;
  final String reference;
  final String status;
  final Color statusColor;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 20),
        child: AppCard(
          color: const Color(0xFFFFFFFF),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: const Color(0xFF131313))),
              const SizedBox(height: 6),
              Text(subtitle, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: statusColor.withValues(alpha: 0.35)),
                    ),
                    child: Text(status, style: TextStyle(fontWeight: FontWeight.w800, color: statusColor)),
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
                  child: Text(line, style: const TextStyle(height: 1.45, color: Color(0xFF6E6A67))),
                ),
            ],
          ),
        ),
      ),
    );
  }
}






