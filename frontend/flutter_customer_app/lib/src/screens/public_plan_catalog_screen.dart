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

// ─── Plan Card ────────────────────────────────────────────────────────────────

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.plan});
  final PlanItem plan;

  @override
  Widget build(BuildContext context) {
    final premium = _isPremium(plan);
    final speed = plan.speedMbps.toStringAsFixed(0);
    final terms = _terms(plan);

    return GestureDetector(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => PlanDetailScreen(plan: plan))),
      child: Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: premium
                ? kPrimary.withValues(alpha: 0.5)
                : kBorder,
          ),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: premium ? 0.12 : 0.05),
              blurRadius: 28,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Top gradient header ───────────────────────────────
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    kPrimary.withValues(alpha: premium ? 0.22 : 0.12),
                    kPrimary.withValues(alpha: 0.03),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Badges
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if (premium)
                              _badge('RECOMMENDED', kPrimary,
                                  kPrimaryLight),
                            _badge(
                              terms.length > 1
                                  ? '${terms.length} DURATIONS'
                                  : 'MONTHLY',
                              kBg,
                              kMuted,
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          plan.name,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
                            letterSpacing: -0.4,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              'Rs ${plan.monthlyPrice.toStringAsFixed(0)}',
                              style: GoogleFonts.inter(
                                color: kPrimaryLight,
                                fontWeight: FontWeight.w900,
                                fontSize: 26,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Padding(
                              padding: const EdgeInsets.only(bottom: 2),
                              child: Text(
                                '/ month',
                                style: GoogleFonts.inter(
                                    color: kMuted, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Speed bubble
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          kPrimary.withValues(alpha: 0.35),
                          kPrimary.withValues(alpha: 0.08),
                        ],
                      ),
                      border: Border.all(
                          color: kPrimary.withValues(alpha: 0.35), width: 1.5),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          speed,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
                          ),
                        ),
                        Text(
                          'Mbps',
                          style: GoogleFonts.inter(
                              color: kPrimaryLight, fontSize: 9),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── Divider with stats ────────────────────────────────
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: kBorder),
                  bottom: BorderSide(color: kBorder),
                ),
              ),
              child: Row(
                children: [
                  _stat(Icons.download_rounded,
                      '${plan.speedMbps.toStringAsFixed(0)} Mbps', 'Download'),
                  _vertDiv(),
                  _stat(Icons.upload_rounded,
                      '${plan.uploadSpeedMbps.toStringAsFixed(0)} Mbps', 'Upload'),
                  _vertDiv(),
                  _stat(Icons.data_usage_rounded, _dataLabel(plan), 'Data'),
                ],
              ),
            ),

            // ── Features ─────────────────────────────────────────
            if ([...plan.features, ...plan.staticBenefits].isNotEmpty) ...[
              Padding(
                padding:
                    const EdgeInsets.fromLTRB(16, 14, 16, 0),
                child: Column(
                  children: [
                    for (final f in [...plan.features, ...plan.staticBenefits]
                        .take(3))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle_rounded,
                                color: Color(0xFF4ADE80), size: 14),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(f,
                                  style: GoogleFonts.inter(
                                      color: Colors.white70,
                                      fontSize: 12.5)),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],

            // ── CTA ──────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => PlanDetailScreen(plan: plan))),
                  style: FilledButton.styleFrom(
                    backgroundColor: kPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                  label: Text(
                    'View Details & Pricing',
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _badge(String label, Color bg, Color fg) => Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: fg.withValues(alpha: 0.3)),
        ),
        child: Text(label,
            style: GoogleFonts.inter(
                fontSize: 9,
                fontWeight: FontWeight.w800,
                color: fg,
                letterSpacing: 0.8)),
      );

  Widget _stat(IconData icon, String value, String label) => Expanded(
        child: Column(
          children: [
            Icon(icon, color: kPrimaryLight, size: 14),
            const SizedBox(height: 4),
            Text(value,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)),
            Text(label,
                style: GoogleFonts.inter(color: kMuted, fontSize: 10)),
          ],
        ),
      );

  Widget _vertDiv() => Container(
      width: 1, height: 36, color: Colors.white.withValues(alpha: 0.07));

  List<String> _terms(PlanItem plan) {
    final t = <String>[
      if (plan.validityMonthly || plan.monthlyPrice > 0) 'monthly',
      if (plan.validityQuarterly || plan.quarterlyPrice > 0) 'quarterly',
      if (plan.validityHalfYearly || plan.halfYearlyPrice > 0) 'halfYearly',
      if (plan.validityYearly || plan.yearlyPrice > 0) 'yearly',
    ];
    return t.isEmpty ? ['monthly'] : t;
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
