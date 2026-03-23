import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
import 'billing_history_screen.dart';
import 'service_tracking_screen.dart';
import 'support_history_screen.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  static const _accent = Color(0xFFE6FF3C);

  _AlertKind _kindFor(NotificationItem item) {
    final type = item.type.toLowerCase();
    if (type.contains('billing_') || type.contains('refund') || type.contains('receipt')) {
      return _AlertKind.billing;
    }
    if (type.contains('booking') || type.contains('installer') || type.contains('job')) {
      return _AlertKind.tracking;
    }
    if (type.contains('ticket') || type.contains('request') || type.contains('support')) {
      return _AlertKind.support;
    }
    final text = '${item.title} ${item.body}'.toLowerCase();
    if (text.contains('bill') ||
        text.contains('invoice') ||
        text.contains('payment') ||
        text.contains('due') ||
        text.contains('receipt') ||
        text.contains('gst')) {
      return _AlertKind.billing;
    }
    if (text.contains('booking') ||
        text.contains('install') ||
        text.contains('installer') ||
        text.contains('assigned job') ||
        text.contains('visit')) {
      return _AlertKind.tracking;
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
      case _AlertKind.tracking:
        return 'Tracking';
      case _AlertKind.general:
        return 'Update';
    }
  }

  Color _badgeBackgroundFor(_AlertKind kind) {
    switch (kind) {
      case _AlertKind.billing:
        return const Color(0x14E6FF3C);
      case _AlertKind.support:
        return const Color(0x221F2937);
      case _AlertKind.tracking:
        return const Color(0x14F59E0B);
      case _AlertKind.general:
        return const Color(0x120B0F19);
    }
  }

  Color _badgeForegroundFor(_AlertKind kind) {
    switch (kind) {
      case _AlertKind.billing:
        return _accent;
      case _AlertKind.support:
        return const Color(0xFFEFEEE8);
      case _AlertKind.tracking:
        return const Color(0xFFF59E0B);
      case _AlertKind.general:
        return const Color(0xFFD1D5DB);
    }
  }

  String _primaryActionLabelFor(_AlertKind kind) {
    switch (kind) {
      case _AlertKind.billing:
        return 'Open Billing';
      case _AlertKind.support:
        return 'Open Support';
      case _AlertKind.tracking:
        return 'Open Tracking';
      case _AlertKind.general:
        return 'View Support';
    }
  }

  Future<void> _openPrimaryAction(BuildContext context, AppState appState, NotificationItem item) async {
    if (item.id.isNotEmpty) {
      await appState.markNotificationRead(item.id);
    }
    switch (_kindFor(item)) {
      case _AlertKind.billing:
        if (context.mounted) {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BillingHistoryScreen()));
          if (context.mounted) {
            await appState.refresh();
          }
        }
        return;
      case _AlertKind.support:
      case _AlertKind.general:
        if (context.mounted) {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SupportHistoryScreen()));
          if (context.mounted) {
            await appState.refresh();
          }
        }
        return;
      case _AlertKind.tracking:
        if (context.mounted) {
          await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()));
          if (context.mounted) {
            await appState.refresh();
          }
        }
        return;
    }
  }

  String _relativeTime(NotificationItem item) {
    if (item.createdAt.isEmpty) return 'Latest';
    final parsed = DateTime.tryParse(item.createdAt);
    if (parsed == null) return item.createdAt;
    final diff = DateTime.now().difference(parsed.toLocal());
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final notifications = appState.notifications;

    return Scaffold(
      appBar: AppBar(title: const Text('Alerts & updates')),
      body: RefreshIndicator(
        color: const Color(0xFFE6FF3C),
        backgroundColor: const Color(0xFF0C1018),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
          children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF090D15), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ALERTS CENTER',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF9CA3AF),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Stay updated',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: const Color(0xFFEFEEE8), fontSize: 28),
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
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE6FF3C), foregroundColor: const Color(0xFF031B17)),
                      child: const Text('Refresh'),
                    ),
                    OutlinedButton(
                      onPressed: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
                        );
                        if (context.mounted) {
                          await appState.refresh();
                        }
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEFEEE8),
                        backgroundColor: const Color(0xFF0E1520),
                        side: const BorderSide(color: Color(0x66E6FF3C)),
                      ),
                      child: const Text('Open Support Center'),
                    ),
                    OutlinedButton(
                      onPressed: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const BillingHistoryScreen()),
                        );
                        if (context.mounted) {
                          await appState.refresh();
                        }
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEFEEE8),
                        backgroundColor: const Color(0xFF0E1520),
                        side: const BorderSide(color: Color(0x66E6FF3C)),
                      ),
                      child: const Text('Open Billing'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    SizedBox(width: 136, child: _heroMetric('Alerts', '${notifications.length}')),
                    SizedBox(width: 136, child: _heroMetric('Billing', '${notifications.where((n) => _kindFor(n) == _AlertKind.billing).length}')),
                    SizedBox(width: 136, child: _heroMetric('Support', '${notifications.where((n) => _kindFor(n) == _AlertKind.support).length}')),
                    SizedBox(width: 136, child: _heroMetric('Tracking', '${notifications.where((n) => _kindFor(n) == _AlertKind.tracking).length}')),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFF0C1018),
            borderColor: const Color(0x22E6FF3C),
            child: notifications.isEmpty
                ? const Text('No alerts to show right now.', style: TextStyle(color: Color(0xFF9CA3AF)))
                : Column(
                    children: notifications.map((item) {
                      final kind = _kindFor(item);
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF0B0F19), Color(0xFF111827)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: const Color(0x22E6FF3C)),
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
                                  if (item.readAt.isEmpty)
                                    Container(
                                      width: 10,
                                      height: 10,
                                      decoration: const BoxDecoration(
                                        color: Color(0xFFE6FF3C),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  if (item.readAt.isEmpty) const SizedBox(width: 10),
                                  Text(
                                    _relativeTime(item),
                                    style: const TextStyle(
                                      color: Color(0xFF9CA3AF),
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text(item.title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFFEFEEE8))),
                              const SizedBox(height: 6),
                              Text(item.body, style: const TextStyle(color: Color(0xFF9CA3AF), height: 1.45)),
                              const SizedBox(height: 14),
                              Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: [
                                  FilledButton(
                                    onPressed: () => _openPrimaryAction(context, appState, item),
                                    style: FilledButton.styleFrom(
                                      backgroundColor: const Color(0xFFE6FF3C),
                                      foregroundColor: const Color(0xFF111111),
                                    ),
                                    child: Text(_primaryActionLabelFor(kind)),
                                  ),
                                  OutlinedButton(
                                    onPressed: () async {
                                      if (item.id.isNotEmpty) {
                                        await appState.markNotificationRead(item.id);
                                      }
                                      if (context.mounted) {
                                        await appState.refresh();
                                      }
                                    },
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFFEFEEE8),
                                      backgroundColor: const Color(0xFF0E1520),
                                      side: const BorderSide(color: Color(0x33E6FF3C)),
                                    ),
                                    child: Text(item.readAt.isEmpty ? 'Mark as read' : 'Refresh alerts'),
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
      ),
    );
  }

  Widget _heroMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF101722),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x33E6FF3C)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(color: const Color(0xFFEFEEE8), fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }
}

enum _AlertKind {
  billing,
  support,
  tracking,
  general,
}
