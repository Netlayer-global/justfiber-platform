import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class NotificationsTab extends StatelessWidget {
  const NotificationsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    return RefreshIndicator(
      color: const Color(0xFFE6FF3C),
      backgroundColor: const Color(0xFF0C1018),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
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
                  'ALERT CONSOLE',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF9CA3AF),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Installer alerts',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  appState.notifications.isEmpty
                      ? 'No active dispatch or provisioning alerts right now.'
                      : 'Track dispatch, activation, and system alerts from one queue.',
                  style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: _metricChip(
                        context,
                        label: 'Alerts',
                        value: appState.notifications.length.toString(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _metricChip(
                        context,
                        label: 'Status',
                        value: appState.notifications.isEmpty ? 'Clear' : 'Live',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (appState.notifications.isEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'No installer notifications right now.',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Pull down to refresh when new jobs, dispatch updates, or activation notices come in.',
                    style: TextStyle(color: Color(0xFF9CA3AF), height: 1.45),
                  ),
                ],
              ),
            )
          else
            ...appState.notifications.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.title,
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFF141A22),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: const Color(0x33E6FF3C)),
                            ),
                            child: const Text(
                              'Live',
                              style: TextStyle(
                                color: Color(0xFFE6FF3C),
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        item.body,
                        style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _metricChip(BuildContext context, {required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFF11161D),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x33E6FF3C)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: const Color(0xFFEFEEE8),
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
          ),
        ],
      ),
    );
  }
}
