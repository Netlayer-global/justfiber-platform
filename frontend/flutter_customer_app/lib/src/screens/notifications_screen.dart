import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'billing_history_screen.dart';
import 'support_history_screen.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  static const _accent = Color(0xFF39FF14);

  _AlertKind _kindFor(NotificationItem item) {
    final text = '${item.title} ${item.body}'.toLowerCase();
    if (text.contains('bill') ||
        text.contains('invoice') ||
        text.contains('payment') ||
        text.contains('due') ||
        text.contains('receipt') ||
        text.contains('gst')) {
      return _AlertKind.billing;
    }
    if (text.contains('ticket') ||
        text.contains('request') ||
        text.contains('complaint') ||
        text.contains('support') ||
        text.contains('visit') ||
        text.contains('installer')) {
      return _AlertKind.support;
    }
    return _AlertKind.general;
  }

  String _labelFor(_AlertKind kind) {
    switch (kind) {
      case _AlertKind.billing:
        return 'Billing';
      case _AlertKind.support:
        return 'Support';
      case _AlertKind.general:
        return 'Update';
    }
  }

  Color _badgeBackgroundFor(_AlertKind kind) {
    switch (kind) {
      case _AlertKind.billing:
        return const Color(0x1439FF14);
      case _AlertKind.support:
        return const Color(0x1A00C2FF);
      case _AlertKind.general:
        return const Color(0x120B0F19);
    }
  }

  Color _badgeForegroundFor(_AlertKind kind) {
    switch (kind) {
      case _AlertKind.billing:
        return _accent;
      case _AlertKind.support:
        return const Color(0xFF00C2FF);
      case _AlertKind.general:
        return const Color(0xFF111827);
    }
  }

  String _primaryActionLabelFor(_AlertKind kind) {
    switch (kind) {
      case _AlertKind.billing:
        return 'Open Billing';
      case _AlertKind.support:
        return 'Open Support';
      case _AlertKind.general:
        return 'View Support';
    }
  }

  VoidCallback _primaryActionFor(BuildContext context, _AlertKind kind) {
    switch (kind) {
      case _AlertKind.billing:
        return () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const BillingHistoryScreen()),
            );
      case _AlertKind.support:
      case _AlertKind.general:
        return () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
            );
    }
  }

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
              colors: [Color(0xFF0B0F19), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Stay updated',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 26, color: Colors.white),
                ),
                const SizedBox(height: 10),
                Text(
                  notifications.isEmpty
                      ? 'There are no active alerts right now.'
                      : 'You have ${notifications.length} recent service, billing, or support alerts.',
                  style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton(
                      onPressed: appState.busy ? null : appState.refresh,
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF39FF14), foregroundColor: const Color(0xFF031B17)),
                      child: const Text('Refresh'),
                    ),
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0x6639FF14)),
                      ),
                      child: const Text('Open Support Center'),
                    ),
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const BillingHistoryScreen()),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Color(0x3322D3EE)),
                      ),
                      child: const Text('Open Billing'),
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
                      final kind = _kindFor(item);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FBFF),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0x2239FF14)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: _badgeBackgroundFor(kind),
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: _badgeForegroundFor(kind).withOpacity(0.22)),
                                    ),
                                    child: Text(
                                      _labelFor(kind),
                                      style: TextStyle(
                                        color: _badgeForegroundFor(kind),
                                        fontWeight: FontWeight.w800,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  Icon(
                                    kind == _AlertKind.billing
                                        ? Icons.receipt_long_rounded
                                        : kind == _AlertKind.support
                                            ? Icons.support_agent_rounded
                                            : Icons.notifications_active_rounded,
                                    size: 18,
                                    color: _badgeForegroundFor(kind),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(item.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                              const SizedBox(height: 6),
                              Text(item.body, style: const TextStyle(color: Color(0xFF6B7280), height: 1.45)),
                              const SizedBox(height: 14),
                              Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: [
                                  FilledButton(
                                    onPressed: _primaryActionFor(context, kind),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: const Color(0xFF111827),
                                      foregroundColor: Colors.white,
                                    ),
                                    child: Text(_primaryActionLabelFor(kind)),
                                  ),
                                  OutlinedButton(
                                    onPressed: appState.busy ? null : appState.refresh,
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFF111827),
                                      side: const BorderSide(color: Color(0x2239FF14)),
                                    ),
                                    child: const Text('Refresh alerts'),
                                  ),
                                ],
                              ),
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

enum _AlertKind {
  billing,
  support,
  general,
}
