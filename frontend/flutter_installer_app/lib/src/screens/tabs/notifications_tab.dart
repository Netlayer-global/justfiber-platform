import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class NotificationsTab extends StatelessWidget {
  const NotificationsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Text('Alerts', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        ...(appState.notifications.isEmpty
            ? [const AppCard(child: Text('No installer notifications right now.'))]
            : appState.notifications.map((item) => Padding(
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
