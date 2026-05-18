import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'lead_booking_flow_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC PLAN CATALOG — Speed-grouped → Duration picker → Booking flow
//  Flow: Plans list (1 card per speed) → Tap → Duration selection → Book
// ─────────────────────────────────────────────────────────────────────────────

class PublicPlanCatalogScreen extends StatefulWidget {
  const PublicPlanCatalogScreen({super.key});

  @override
  State<PublicPlanCatalogScreen> createState() =>
      _PublicPlanCatalogScreenState();
}

class _PublicPlanCatalogScreenState extends State<PublicPlanCatalogScreen> {
  bool _loading = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final appState = AppStateScope.of(context);
    if (appState.plans.isEmpty && !_loading) {
      _loading = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        await appState.refreshPlans();
        if (mounted) setState(() => _loading = false);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final plans = appState.plans.where((p) => p.planCode.isNotEmpty).toList();

    // Group plans by speed — one card per speed tier
    final speedGroups = _groupBySpeed(plans);

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kAccent,
        backgroundColor: const Color(0xFF0A0A14),
        onRefresh: () async => appState.refreshPlans(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ── Header ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 16, 22, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          PressableScale(
                            onTap: () => Navigator.of(context).maybePop(),
                            haptic: true,
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: kSurface,
                                borderRadius: BorderRadius.circular(kRSmall),
                                border: Border.all(color: kBorderSoft),
                              ),
                              child: const Icon(Icons.arrow_back_rounded,
                                  color: kText, size: 18),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Text(
                            'Our Plans',
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.4,
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: kAccentSoft,
                              borderRadius: BorderRadius.circular(kRPill),
                            ),
                            child: Text(
                              '${speedGroups.length} plans',
                              style: GoogleFonts.inter(
                                color: kAccent,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Padding(
                        padding: const EdgeInsets.only(left: 54),
                        child: Text(
                          'High-speed fiber broadband for your home',
                          style: GoogleFonts.inter(
                            color: kTextMuted,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Banner (first active banner) ──────────────────
            if (appState.banners.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 20, 22, 0),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(kRSurface),
                    child: AspectRatio(
                      aspectRatio: 1080 / 400,
                      child: appState.banners.first.imageUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: appState.banners.first.imageUrl,
                              fit: BoxFit.fill,
                              width: double.infinity,
                              placeholder: (_, __) => Container(color: kSurface),
                              errorWidget: (_, __, ___) =>
                                  const SizedBox.shrink(),
                            )
                          : Container(
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [kAccent, kAccentDeep],
                                ),
                              ),
                            ),
                    ),
                  ),
                ),
              ),

            // ── Plan cards ────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(22, 22, 22, 40),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if (_loading || appState.busy) ...[
                    const SizedBox(height: 60),
                    const Center(
                      child: CircularProgressIndicator(
                          color: kAccent, strokeWidth: 2.5),
                    ),
                    const SizedBox(height: 20),
                    Center(
                      child: Text('Loading plans…',
                          style: GoogleFonts.inter(
                              color: kTextMuted, fontSize: 13)),
                    ),
                  ] else if (speedGroups.isEmpty) ...[
                    _emptyState(appState),
                  ] else ...[
                    for (final group in speedGroups) ...[
                      _SpeedCard(
                        speedMbps: group.speedMbps,
                        lowestPrice: group.lowestPrice,
                        dataPolicy: group.dataPolicy,
                        bannerUrl: group.bannerUrl,
                        badges: group.badges,
                        plans: group.plans,
                        pricesExcludeGst: group.pricesExcludeGst,
                        onSelect: (plan, term) =>
                            _openBooking(context, appState, plan, term),
                      ),
                      const SizedBox(height: 16),
                    ],
                  ],
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState(AppState appState) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRCard),
          border: Border.all(color: kBorderSoft),
        ),
        child: Column(
          children: [
            Text('No plans found',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: kText)),
            const SizedBox(height: 8),
            Text(
              'Pull down to try loading plans again.',
              style: GoogleFonts.inter(color: kTextMuted, fontSize: 13),
            ),
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () async {
                  setState(() => _loading = true);
                  await appState.refreshPlans();
                  if (mounted) setState(() => _loading = false);
                },
                child: const Text('Reload plans'),
              ),
            ),
          ],
        ),
      );

  void _openBooking(BuildContext context, AppState appState, PlanItem plan,
      String term) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => LeadBookingFlowScreen(
        initialMobile: appState.session?.mobile,
      ),
    ));
  }

  // ── Group plans by speed ─────────────────────────────────────────────────

  List<_SpeedGroup> _groupBySpeed(List<PlanItem> plans) {
    final map = <int, List<PlanItem>>{};
    for (final p in plans) {
      final speed = p.speedMbps.round();
      map.putIfAbsent(speed, () => []).add(p);
    }
    final groups = map.entries.map((e) {
      final sorted = e.value
        ..sort((a, b) => a.monthlyPrice.compareTo(b.monthlyPrice));
      final representative = sorted.first;
      return _SpeedGroup(
        speedMbps: e.key,
        lowestPrice: representative.monthlyPrice,
        dataPolicy: representative.dataPolicy,
        bannerUrl: representative.bannerImageUrl,
        badges: [
          if (representative.recommended) 'Recommended',
          if (representative.dataPolicy == 'unlimited') 'Unlimited',
          if (representative.routerIncluded) 'Router Included',
          ...representative.merchandisingBadges,
        ],
        plans: sorted,
        pricesExcludeGst: representative.pricesExcludeGst,
      );
    }).toList()
      ..sort((a, b) => a.speedMbps.compareTo(b.speedMbps));
    return groups;
  }
}

// ─── Speed Group model ────────────────────────────────────────────────────────

class _SpeedGroup {
  const _SpeedGroup({
    required this.speedMbps,
    required this.lowestPrice,
    required this.dataPolicy,
    required this.bannerUrl,
    required this.badges,
    required this.plans,
    required this.pricesExcludeGst,
  });
  final int speedMbps;
  final double lowestPrice;
  final String dataPolicy;
  final String bannerUrl;
  final List<String> badges;
  final List<PlanItem> plans;
  final bool pricesExcludeGst;
}

// ─── Speed Card (one per speed tier) ──────────────────────────────────────────

class _SpeedCard extends StatelessWidget {
  const _SpeedCard({
    required this.speedMbps,
    required this.lowestPrice,
    required this.dataPolicy,
    required this.bannerUrl,
    required this.badges,
    required this.plans,
    required this.pricesExcludeGst,
    required this.onSelect,
  });

  final int speedMbps;
  final double lowestPrice;
  final String dataPolicy;
  final String bannerUrl;
  final List<String> badges;
  final List<PlanItem> plans;
  final bool pricesExcludeGst;
  final void Function(PlanItem plan, String term) onSelect;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () => _showDurationPicker(context),
      haptic: true,
      child: Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRCard),
          border: Border.all(color: kBorderSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Banner image (if available)
            if (bannerUrl.isNotEmpty)
              ClipRRect(
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(28)),
                child: CachedNetworkImage(
                  imageUrl: bannerUrl,
                  height: 140,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => Container(color: kSurface, height: 140),
                  errorWidget: (_, __, ___) => const SizedBox.shrink(),
                ),
              ),

            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Badges
                  if (badges.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: badges
                            .map((b) => Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: kAccentSoft,
                                    borderRadius:
                                        BorderRadius.circular(kRPill),
                                  ),
                                  child: Text(
                                    b,
                                    style: GoogleFonts.inter(
                                      color: kAccent,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ))
                            .toList(),
                      ),
                    ),

                  // Price + Speed + Data row (Airtel style)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // Price
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            '₹${lowestPrice.toStringAsFixed(0)}',
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.8,
                            ),
                          ),
                          Text(
                            ' /m',
                            style: GoogleFonts.inter(
                              color: kTextMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (pricesExcludeGst)
                            Text(
                              ' +GST',
                              style: GoogleFonts.inter(
                                color: kTextFaint,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                        ],
                      ),
                      const Spacer(),
                      // Speed
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            '$speedMbps Mbps',
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'Speed',
                            style: GoogleFonts.inter(
                              color: kTextMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 18),
                      // Data
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            dataPolicy == 'unlimited'
                                ? 'Unlimited'
                                : dataPolicy.toUpperCase(),
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            'Internet',
                            style: GoogleFonts.inter(
                              color: kTextMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Select Plan button
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: kAccent,
                      borderRadius: BorderRadius.circular(kRSmall),
                      boxShadow: [
                        BoxShadow(
                          color: kAccent.withValues(alpha: 0.35),
                          blurRadius: 12,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        'Select Plan',
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showDurationPicker(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _DurationPickerSheet(
        speedMbps: speedMbps,
        plans: plans,
        onSelect: onSelect,
      ),
    );
  }
}

// ─── Duration Picker Bottom Sheet ─────────────────────────────────────────────

class _DurationPickerSheet extends StatelessWidget {
  const _DurationPickerSheet({
    required this.speedMbps,
    required this.plans,
    required this.onSelect,
  });

  final int speedMbps;
  final List<PlanItem> plans;
  final void Function(PlanItem plan, String term) onSelect;

  @override
  Widget build(BuildContext context) {
    // Build duration options from available plans
    final options = <_DurationOption>[];
    for (final plan in plans) {
      if (plan.validityMonthly || plan.monthlyPrice > 0) {
        options.add(_DurationOption(
          plan: plan,
          term: 'monthly',
          months: 1,
          price: plan.monthlyPrice,
        ));
      }
      if (plan.validityQuarterly || plan.quarterlyPrice > 0) {
        options.add(_DurationOption(
          plan: plan,
          term: 'quarterly',
          months: 3,
          price: plan.quarterlyPrice > 0
              ? plan.quarterlyPrice
              : plan.monthlyPrice * 3,
        ));
      }
      if (plan.validityHalfYearly || plan.halfYearlyPrice > 0) {
        options.add(_DurationOption(
          plan: plan,
          term: 'halfYearly',
          months: 6,
          price: plan.halfYearlyPrice > 0
              ? plan.halfYearlyPrice
              : plan.monthlyPrice * 6,
        ));
      }
      if (plan.validityYearly || plan.yearlyPrice > 0) {
        options.add(_DurationOption(
          plan: plan,
          term: 'yearly',
          months: 12,
          price: plan.yearlyPrice > 0
              ? plan.yearlyPrice
              : plan.monthlyPrice * 12,
        ));
      }
    }

    // Deduplicate by months (keep lowest price)
    final deduped = <int, _DurationOption>{};
    for (final opt in options) {
      if (!deduped.containsKey(opt.months) ||
          opt.price < deduped[opt.months]!.price) {
        deduped[opt.months] = opt;
      }
    }
    final sorted = deduped.values.toList()
      ..sort((a, b) => a.months.compareTo(b.months));

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 20),
      child: Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          color: const Color(0xFF101018),
          borderRadius: BorderRadius.circular(kRCard),
          border: Border.all(color: kBorderSoft),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: kBorderSoft,
                  borderRadius: BorderRadius.circular(kRPill),
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Title
            Text(
              '$speedMbps Mbps Plan',
              style: GoogleFonts.inter(
                color: kText,
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Choose your billing duration',
              style: GoogleFonts.inter(
                color: kTextMuted,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 20),

            // Duration options
            ...sorted.map((opt) {
              final perMonth =
                  opt.months > 1 ? opt.price / opt.months : opt.price;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: PressableScale(
                  onTap: () {
                    Navigator.of(context).pop();
                    onSelect(opt.plan, opt.term);
                  },
                  haptic: true,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(kRSurface),
                      border: Border.all(color: kBorderSoft),
                    ),
                    child: Row(
                      children: [
                        // Month badge
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: kAccentSoft,
                            borderRadius: BorderRadius.circular(kRSmall),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                '${opt.months}',
                                style: GoogleFonts.inter(
                                  color: kAccent,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              Text(
                                'mo',
                                style: GoogleFonts.inter(
                                  color: kAccent,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 14),
                        // Label
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _durationLabel(opt.months),
                                style: GoogleFonts.inter(
                                  color: kText,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              if (opt.months > 1)
                                Text(
                                  '₹${perMonth.toStringAsFixed(0)}/mo effective',
                                  style: GoogleFonts.inter(
                                    color: kTextMuted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        // Price
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '₹${opt.price.toStringAsFixed(0)}',
                              style: GoogleFonts.inter(
                                color: kText,
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.3,
                              ),
                            ),
                            if (opt.plan.pricesExcludeGst)
                              Text(
                                '+GST',
                                style: GoogleFonts.inter(
                                  color: kTextFaint,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(width: 10),
                        const Icon(Icons.arrow_forward_rounded,
                            color: kAccent, size: 18),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  String _durationLabel(int months) {
    switch (months) {
      case 1:
        return '1 Month';
      case 3:
        return '3 Months';
      case 6:
        return '6 Months';
      case 12:
        return '12 Months';
      default:
        return '$months Months';
    }
  }
}

class _DurationOption {
  const _DurationOption({
    required this.plan,
    required this.term,
    required this.months,
    required this.price,
  });
  final PlanItem plan;
  final String term;
  final int months;
  final double price;
}
