import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';
import '../billing_history_screen.dart';
import '../plan_catalog_screen.dart';
import '../service_tracking_screen.dart';
import '../support_history_screen.dart';

class ShopTab extends StatelessWidget {
  const ShopTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final promoBanners = appState.banners;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        AppCard(
          color: const Color(0xFFFFFFFF),
          borderColor: const Color(0x228224E3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'OFFERS & HELP',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: const Color(0xFF8224E3),
                      letterSpacing: 2.6,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 10),
              Text('Shop', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text(
                'Explore upgrades, add-ons, and frequently asked questions from one place.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFF6E6A67)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        ...(promoBanners.isEmpty
            ? [
                _offer(context, 'Upgrade to JustFiber 200', 'Double speed for streaming and gaming', 'Upgrade'),
                const SizedBox(height: 14),
                _offer(context, 'OTT Add-on', 'Bundle your favorite content apps with broadband', 'Explore'),
                const SizedBox(height: 14),
                _offer(context, 'Static IP', 'For CCTV, office and remote access use cases', 'Activate'),
              ]
            : promoBanners.take(3).expand((banner) => [
                  _promoBanner(context, appState, banner),
                  const SizedBox(height: 14),
                ])),
        const SizedBox(height: 18),
        Text('Available add-ons', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 12),
        ...(appState.addons.isEmpty
            ? [
                const AppCard(
                  color: Color(0xFFFFFFFF),
                  borderColor: Color(0x228224E3),
                  child: Text('No add-ons returned from backend yet.', style: TextStyle(color: Color(0xFF6E6A67))),
                )
              ]
            : appState.addons.map((addon) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AppCard(
                    color: const Color(0xFFFFFFFF),
                    borderColor: const Color(0x228224E3),
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
                color: const Color(0xFFFFFFFF),
                borderColor: const Color(0x228224E3),
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
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
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

  Future<void> _openPromo(BuildContext context, AppState appState, AppBannerItem banner) async {
    switch (banner.targetType) {
      case 'plan_catalog':
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
        break;
      case 'billing':
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BillingHistoryScreen()));
        break;
      case 'support':
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SupportHistoryScreen()));
        break;
      case 'tracking':
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()));
        break;
      default:
        return;
    }
    if (context.mounted) {
      await appState.refresh();
    }
  }

  Widget _promoBanner(BuildContext context, AppState appState, AppBannerItem banner) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(banner.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 10),
          Text(banner.description, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerRight,
            child: FilledButton(
              onPressed: () => _openPromo(context, appState, banner),
              child: Text(banner.ctaLabel),
            ),
          ),
        ],
      ),
    );
  }
}



