import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';

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

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: () async => appState.refreshPlans(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ── Header ─────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF8224E3), Color(0xFF4A0D8F)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 8, 20, 0),
                        child: Row(
                          children: [
                            IconButton(
                              onPressed: () =>
                                  Navigator.of(context).maybePop(),
                              icon: const Icon(
                                  Icons.arrow_back_ios_new_rounded,
                                  color: Colors.white,
                                  size: 20),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '${plans.length} PLANS',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(22, 8, 22, 28),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Our Plans',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.8,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'High-speed fiber internet for your home',
                              style: GoogleFonts.inter(
                                  color: Colors.white60, fontSize: 13),
                            ),
                            const SizedBox(height: 16),
                            // Feature pills
                            Row(
                              children: [
                                _headerPill(
                                    Icons.bolt_rounded, 'Fast Install'),
                                const SizedBox(width: 8),
                                _headerPill(
                                    Icons.lock_rounded, 'No Lock-in'),
                                const SizedBox(width: 8),
                                _headerPill(
                                    Icons.support_agent_rounded, '24/7 Support'),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 40),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Top offer banner (first active banner)
                  if (appState.banners.isNotEmpty) ...[
                    ClipRRect(
                      borderRadius: BorderRadius.circular(kRSurface),
                      child: Container(
                        height: 130,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [kAccent, kAccentDeep],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(kRSurface),
                        ),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            if (appState.banners.first.imageUrl.isNotEmpty)
                              Image.network(
                                appState.banners.first.imageUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    const SizedBox.shrink(),
                              ),
                            Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                  colors: [
                                    Colors.black.withValues(alpha: 0.65),
                                    Colors.black.withValues(alpha: 0.1),
                                  ],
                                ),
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(18),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  Text(
                                    appState.banners.first.title,
                                    style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.3,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (appState.banners.first.description
                                      .isNotEmpty) ...[
                                    const SizedBox(height: 3),
                                    Text(
                                      appState.banners.first.description,
                                      style: GoogleFonts.inter(
                                        color: Colors.white
                                            .withValues(alpha: 0.85),
                                        fontSize: 12,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                  if (_loading || appState.busy) ...[
                    const SizedBox(height: 60),
                    const Center(
                      child: CircularProgressIndicator(
                          color: kPrimaryLight, strokeWidth: 2.5),
                    ),
                    const SizedBox(height: 20),
                    Center(
                      child: Text('Loading plans…',
                          style: GoogleFonts.inter(
                              color: kMuted, fontSize: 13)),
                    ),
                  ] else if (plans.isEmpty) ...[
                    _emptyCard(context, appState),
                  ] else ...[
                    for (int i = 0; i < plans.length; i++) ...[
                      _PlanCard(plan: plans[i]),
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

  Widget _headerPill(IconData icon, String label) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
          border:
              Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white70, size: 12),
            const SizedBox(width: 5),
            Text(
              label,
              style: GoogleFonts.inter(
                  color: Colors.white70,
                  fontSize: 11,
                  fontWeight: FontWeight.w600),
            ),
          ],
        ),
      );

  Widget _emptyCard(BuildContext context, AppState appState) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('No plans found',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: Colors.white)),
            const SizedBox(height: 8),
            Text(
              (appState.error ?? '').isNotEmpty
                  ? appState.error!
                  : 'Pull down to try loading plans again.',
              style: GoogleFonts.inter(
                  color: kMuted, height: 1.4, fontSize: 13),
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
}

// ─── Plan Card (banner-style, matching upgrade plan_catalog_screen) ───────────

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan});
  final PlanItem plan;

  @override
  Widget build(BuildContext context) {
    final premium = _isPremium(plan);
    final badges = <String>[
      if (premium || plan.recommended) 'Recommended',
      if (plan.dataPolicy == 'unlimited') 'Unlimited Data',
      if (plan.routerIncluded) 'Router Included',
      ...plan.merchandisingBadges,
    ];
    final subtitle = plan.merchandisingSubtitle.isNotEmpty
        ? plan.merchandisingSubtitle
        : '${plan.speedMbps.toStringAsFixed(0)} Mbps Fiber Broadband';
    final bannerUrl = plan.bannerImageUrl;

    return GestureDetector(
      onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => PlanDetailScreen(plan: plan))),
      child: Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRCard),
          border: Border.all(color: kBorderSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Banner area (image or gradient placeholder) ──────
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(28)),
              child: Container(
                height: 160,
                width: double.infinity,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: premium
                        ? [kAccent, kAccentDeep]
                        : [const Color(0xFF1A1A2E), const Color(0xFF0F0F1A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    // Banner image if available
                    if (bannerUrl.isNotEmpty)
                      Image.network(
                        bannerUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            const SizedBox.shrink(),
                      ),
                    // Gradient overlay for text readability
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.6),
                          ],
                        ),
                      ),
                    ),
                    // Speed badge pill on banner
                    Positioned(
                      left: 16,
                      bottom: 14,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(kRPill),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.bolt_rounded,
                                color: Colors.white, size: 14),
                            const SizedBox(width: 4),
                            Text(
                              '${plan.speedMbps.toStringAsFixed(0)} Mbps',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Wi-Fi icon (decorative, top-right)
                    if (bannerUrl.isEmpty)
                      Positioned(
                        right: 20,
                        top: 30,
                        child: Icon(
                          Icons.wifi_rounded,
                          color: Colors.white.withValues(alpha: 0.15),
                          size: 80,
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // ── Content below banner ────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Badges row
                  if (badges.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: badges
                            .map((b) => Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 5),
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
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ))
                            .toList(),
                      ),
                    ),

                  // Plan name (big bold)
                  Text(
                    plan.name,
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w900,
                      fontSize: 20,
                      color: kText,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // Subtitle
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      color: kTextMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Price + Speed + Data info row
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment:
                                  CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                Text(
                                  '₹${plan.monthlyPrice.toStringAsFixed(0)}',
                                  style: GoogleFonts.inter(
                                    color: kText,
                                    fontSize: 24,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                Text(
                                  '/mo',
                                  style: GoogleFonts.inter(
                                    color: kTextMuted,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            if (plan.pricesExcludeGst)
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
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            plan.speedMbps.toStringAsFixed(0),
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                            ),
                          ),
                          Text(
                            'Mbps',
                            style: GoogleFonts.inter(
                              color: kTextMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(width: 12),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Text(
                            _dataLabel(plan),
                            style: GoogleFonts.inter(
                              color: kText,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                            ),
                          ),
                          Text(
                            'Data',
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

                  // OTT apps row
                  if (plan.ottApps.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        ...plan.ottApps.take(4).map((app) => Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: kSurfaceLow,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: kBorderSoft),
                                ),
                                child: Center(
                                  child: Text(
                                    app.length > 2
                                        ? app.substring(0, 2).toUpperCase()
                                        : app.toUpperCase(),
                                    style: GoogleFonts.inter(
                                      color: kTextDim,
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ),
                            )),
                        if (plan.ottApps.length > 4)
                          Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              color: kSurfaceLow,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: kBorderSoft),
                            ),
                            child: Center(
                              child: Text(
                                '+${plan.ottApps.length - 4}',
                                style: GoogleFonts.inter(
                                  color: kTextMuted,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],

                  const SizedBox(height: 16),

                  // Single "Book Now" button
                  SizedBox(
                    width: double.infinity,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: kAccent,
                        borderRadius: BorderRadius.circular(kRSmall),
                        boxShadow: [
                          BoxShadow(
                            color: kAccent.withValues(alpha: 0.4),
                            blurRadius: 12,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          'Book Now',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
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

  String _dataLabel(PlanItem plan) {
    if (plan.dataPolicy == 'unlimited') return 'Unlimited';
    if (plan.dataLimitGb > 0) {
      return '${plan.dataLimitGb.toStringAsFixed(0)} GB';
    }
    return plan.dataPolicy.toUpperCase();
  }

  bool _isPremium(PlanItem plan) {
    final lower = plan.name.toLowerCase();
    return lower.contains('entertainment') ||
        lower.contains('ott') ||
        lower.contains('combo') ||
        plan.monthlyPrice >= 999 ||
        plan.speedMbps >= 200;
  }
}

// ─── Plan Detail Screen ───────────────────────────────────────────────────────

class PlanDetailScreen extends StatelessWidget {
  const PlanDetailScreen({super.key, required this.plan});
  final PlanItem plan;

  @override
  Widget build(BuildContext context) {
    final terms = _terms(plan);

    return Scaffold(
      backgroundColor: kBg,
      body: CustomScrollView(
        slivers: [
          // ── App bar ──────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF8224E3), Color(0xFF4A0D8F)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 8, 20, 28),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          IconButton(
                            onPressed: () =>
                                Navigator.of(context).maybePop(),
                            icon: const Icon(
                                Icons.arrow_back_ios_new_rounded,
                                color: Colors.white,
                                size: 20),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              'PLAN DETAILS',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    plan.name,
                                    style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 26,
                                      letterSpacing: -0.5,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.baseline,
                                    textBaseline:
                                        TextBaseline.alphabetic,
                                    children: [
                                      Text(
                                        'Rs ${plan.monthlyPrice.toStringAsFixed(0)}',
                                        style: GoogleFonts.inter(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w900,
                                          fontSize: 30,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        '/ month',
                                        style: GoogleFonts.inter(
                                            color: Colors.white60,
                                            fontSize: 13),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            // Speed circle
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color:
                                    Colors.white.withValues(alpha: 0.15),
                                border: Border.all(
                                    color: Colors.white.withValues(
                                        alpha: 0.3)),
                              ),
                              child: Column(
                                mainAxisAlignment:
                                    MainAxisAlignment.center,
                                children: [
                                  Text(
                                    plan.speedMbps.toStringAsFixed(0),
                                    style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w900,
                                      fontSize: 18,
                                    ),
                                  ),
                                  Text('Mbps',
                                      style: GoogleFonts.inter(
                                          color: Colors.white70,
                                          fontSize: 9)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 20, 18, 40),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                // ── Speed & Data stats ─────────────────────────────
                Row(
                  children: [
                    _bigStat(plan.speedMbps.toStringAsFixed(0),
                        'Mbps\nDownload'),
                    const SizedBox(width: 10),
                    _bigStat(plan.uploadSpeedMbps.toStringAsFixed(0),
                        'Mbps\nUpload'),
                    const SizedBox(width: 10),
                    _bigStat(_dataLabel(plan), 'Data\nLimit'),
                  ],
                ),

                const SizedBox(height: 24),

                // ── Duration & Pricing ─────────────────────────────
                _sectionLabel('CHOOSE DURATION'),
                const SizedBox(height: 12),
                for (final term in terms) ...[
                  _DurationCard(
                    term: term,
                    price: _priceForTerm(plan, term),
                    isPopular: term == 'yearly',
                  ),
                  const SizedBox(height: 10),
                ],

                const SizedBox(height: 24),

                // ── Features ──────────────────────────────────────
                if (plan.features.isNotEmpty) ...[
                  _sectionLabel('FEATURES'),
                  const SizedBox(height: 12),
                  _featureList(plan.features),
                  const SizedBox(height: 24),
                ],

                if (plan.staticBenefits.isNotEmpty) ...[
                  _sectionLabel('BENEFITS'),
                  const SizedBox(height: 12),
                  _featureList(plan.staticBenefits),
                  const SizedBox(height: 24),
                ],

                // ── Other charges ──────────────────────────────────
                if (plan.otcCharge > 0 ||
                    plan.installationCharge > 0 ||
                    plan.fupSpeedMbps > 0) ...[
                  _sectionLabel('OTHER DETAILS'),
                  const SizedBox(height: 12),
                  _detailsCard([
                    if (plan.fupSpeedMbps > 0)
                      ('After FUP Speed',
                          '${plan.fupSpeedMbps.toStringAsFixed(0)} Mbps'),
                    if (plan.otcCharge > 0)
                      ('OTC Charge',
                          'Rs ${plan.otcCharge.toStringAsFixed(0)}'),
                    if (plan.installationCharge > 0)
                      ('Installation',
                          'Rs ${plan.installationCharge.toStringAsFixed(0)}'),
                    ('Tax', plan.taxIncluded ? 'Included' : 'Extra'),
                  ]),
                  const SizedBox(height: 24),
                ],

                // ── Tags ──────────────────────────────────────────
                if (plan.tags.isNotEmpty) ...[
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: plan.tags
                        .map((t) => _tag(t))
                        .toList(),
                  ),
                  const SizedBox(height: 24),
                ],
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bigStat(String value, String label) => Expanded(
        child: Container(
          padding:
              const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(16),
            border:
                Border.all(color: kPrimary.withValues(alpha: 0.15)),
          ),
          child: Column(
            children: [
              Text(
                value,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: GoogleFonts.inter(color: kMuted, fontSize: 10),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );

  Widget _sectionLabel(String text) => Text(
        text,
        style: GoogleFonts.inter(
          color: kMuted,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.5,
        ),
      );

  Widget _featureList(List<String> items) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kBorder),
        ),
        child: Column(
          children: [
            for (int i = 0; i < items.length; i++) ...[
              if (i > 0)
                const Divider(height: 12, color: kBorder),
              Row(
                children: [
                  const Icon(Icons.check_circle_rounded,
                      color: Color(0xFF4ADE80), size: 15),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(items[i],
                        style: GoogleFonts.inter(
                            color: Colors.white70, fontSize: 13)),
                  ),
                ],
              ),
            ],
          ],
        ),
      );

  Widget _detailsCard(List<(String, String)> rows) => Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: kBorder),
        ),
        child: Column(
          children: [
            for (int i = 0; i < rows.length; i++) ...[
              if (i > 0)
                const Divider(
                    height: 1,
                    color: kBorder,
                    indent: 16,
                    endIndent: 16),
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(rows[i].$1,
                          style: GoogleFonts.inter(
                              color: kMuted, fontSize: 13)),
                    ),
                    Text(rows[i].$2,
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 13)),
                  ],
                ),
              ),
            ],
          ],
        ),
      );

  Widget _tag(String label) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
        ),
        child: Text(label,
            style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: kPrimaryLight)),
      );

  List<String> _terms(PlanItem plan) {
    final t = <String>[
      if (plan.validityMonthly || plan.monthlyPrice > 0) 'monthly',
      if (plan.validityQuarterly || plan.quarterlyPrice > 0) 'quarterly',
      if (plan.validityHalfYearly || plan.halfYearlyPrice > 0) 'halfYearly',
      if (plan.validityYearly || plan.yearlyPrice > 0) 'yearly',
    ];
    return t.isEmpty ? ['monthly'] : t;
  }

  double _priceForTerm(PlanItem plan, String term) {
    switch (term) {
      case 'quarterly':
        return plan.quarterlyPrice > 0
            ? plan.quarterlyPrice
            : plan.monthlyPrice;
      case 'halfYearly':
        return plan.halfYearlyPrice > 0
            ? plan.halfYearlyPrice
            : plan.monthlyPrice;
      case 'yearly':
        return plan.yearlyPrice > 0 ? plan.yearlyPrice : plan.monthlyPrice;
      default:
        return plan.monthlyPrice;
    }
  }

  String _dataLabel(PlanItem plan) {
    if (plan.dataPolicy == 'unlimited') return 'Unlimited';
    if (plan.dataLimitGb > 0) {
      return '${plan.dataLimitGb.toStringAsFixed(0)} GB';
    }
    return plan.dataPolicy.toUpperCase();
  }
}

// ─── Duration Card ────────────────────────────────────────────────────────────

class _DurationCard extends StatelessWidget {
  const _DurationCard({
    required this.term,
    required this.price,
    required this.isPopular,
  });

  final String term;
  final double price;
  final bool isPopular;

  @override
  Widget build(BuildContext context) {
    final months = _months(term);
    final perMonth = months > 1 ? price / months : price;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isPopular ? kPrimary.withValues(alpha: 0.08) : kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isPopular
                ? kPrimary.withValues(alpha: 0.45)
                : kBorder),
      ),
      child: Row(
        children: [
          // Month icon
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(13),
              border:
                  Border.all(color: kPrimary.withValues(alpha: 0.25)),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '$months',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 17,
                  ),
                ),
                Text(
                  'mo',
                  style:
                      GoogleFonts.inter(color: kMuted, fontSize: 9),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          // Labels
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      _label(term),
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                    if (isPopular) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: kPrimary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(5),
                          border: Border.all(
                              color:
                                  kPrimary.withValues(alpha: 0.4)),
                        ),
                        child: Text(
                          'BEST VALUE',
                          style: GoogleFonts.inter(
                            color: kPrimaryLight,
                            fontSize: 8,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.8,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                if (months > 1)
                  Text(
                    'Rs ${perMonth.toStringAsFixed(0)}/mo effective',
                    style:
                        GoogleFonts.inter(color: kMuted, fontSize: 11),
                  ),
              ],
            ),
          ),
          // Price
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'Rs ${price.toStringAsFixed(0)}',
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
              Text(
                'total',
                style: GoogleFonts.inter(color: kMuted, fontSize: 10),
              ),
            ],
          ),
        ],
      ),
    );
  }

  int _months(String term) {
    switch (term) {
      case 'quarterly':
        return 3;
      case 'halfYearly':
        return 6;
      case 'yearly':
        return 12;
      default:
        return 1;
    }
  }

  String _label(String term) {
    switch (term) {
      case 'quarterly':
        return '3 Months';
      case 'halfYearly':
        return '6 Months';
      case 'yearly':
        return '12 Months';
      default:
        return '1 Month';
    }
  }
}
