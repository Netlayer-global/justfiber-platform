import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';

class ShopTab extends StatelessWidget {
  const ShopTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Text('Shop', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        _offer(context, 'Upgrade to JustFiber 200', 'Double speed for streaming and gaming', 'Upgrade'),
        const SizedBox(height: 14),
        _offer(context, 'OTT Add-on', 'Bundle your favorite content apps with broadband', 'Explore'),
        const SizedBox(height: 14),
        _offer(context, 'Static IP', 'For CCTV, office and remote access use cases', 'Activate'),
        const SizedBox(height: 18),
        Text('Available add-ons', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        ...(appState.addons.isEmpty
            ? [const AppCard(child: Text('No add-ons returned from backend yet.'))]
            : appState.addons.map((addon) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(addon.name, style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 8),
                        Text(addon.description, style: Theme.of(context).textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ))),
        const SizedBox(height: 18),
        Text('Help & FAQs', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        ...(appState.faqs.take(4).map((faq) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(faq.question, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Text(faq.answer, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
            ))),
      ],
    );
  }

  Widget _offer(BuildContext context, String title, String description, String cta) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          Text(description, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(onPressed: () {}, child: Text(cta)),
          ),
        ],
      ),
    );
  }
}



