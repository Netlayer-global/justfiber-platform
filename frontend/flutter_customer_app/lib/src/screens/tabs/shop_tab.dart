import 'dart:convert';

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
    final promoBanners = _displayBanners(appState.banners);
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
        if (appState.banners.isEmpty)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Text(
              'Showing default JustFiber offers while live promotions sync in.',
              style: TextStyle(color: Color(0xFF6E6A67), height: 1.4),
            ),
          ),
        ...promoBanners.take(3).expand((banner) => [
              _promoBanner(context, appState, banner),
              const SizedBox(height: 14),
            ]),
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

  Future<void> _openPromo(BuildContext context, AppState appState, AppBannerItem banner) async {
    switch (banner.targetType) {
      case 'plans':
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
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _promoMedia(banner),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
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
          ),
        ],
      ),
    );
  }

  List<AppBannerItem> _displayBanners(List<AppBannerItem> source) {
    if (source.isNotEmpty) return source;
    return const [
      AppBannerItem(
        title: 'Upgrade to JustFiber 200',
        description: 'Move to a faster plan for streaming, gaming, and office use.',
        imageUrl: '',
        targetType: 'plan_catalog',
        targetValue: '',
        ctaLabel: 'Upgrade',
      ),
      AppBannerItem(
        title: 'Pay your latest bill',
        description: 'Open billing to review dues, invoices, and payment history.',
        imageUrl: '',
        targetType: 'billing',
        targetValue: '',
        ctaLabel: 'Open billing',
      ),
      AppBannerItem(
        title: 'Need service help?',
        description: 'Raise a complaint or service request from the support center.',
        imageUrl: '',
        targetType: 'support',
        targetValue: '',
        ctaLabel: 'Get help',
      ),
    ];
  }

  Widget _promoMedia(AppBannerItem banner) {
    final imageUrl = banner.imageUrl.trim();
    if (imageUrl.isEmpty) {
      return Container(
        height: 112,
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          gradient: LinearGradient(
            colors: [Color(0xFF8224E3), Color(0xFFD8B4FE)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: const Text(
          'JustFiber Offers',
          style: TextStyle(
            color: Color(0xFFFFFFFF),
            fontWeight: FontWeight.w800,
            fontSize: 22,
          ),
        ),
      );
    }
    if (imageUrl.startsWith('data:image')) {
      final base64Index = imageUrl.indexOf('base64,');
      if (base64Index != -1) {
        try {
          final bytes = base64Decode(imageUrl.substring(base64Index + 7));
          return ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            child: Image.memory(
              bytes,
              height: 112,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          );
        } catch (_) {}
      }
    }
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: Image.network(
        imageUrl,
        height: 112,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          height: 112,
          color: const Color(0xFFF8F4FF),
          alignment: Alignment.center,
          child: const Text(
            'JustFiber Offers',
            style: TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800, fontSize: 22),
          ),
        ),
      ),
    );
  }
}



