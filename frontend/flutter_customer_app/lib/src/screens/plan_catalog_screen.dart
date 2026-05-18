import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'billing_payment_screen.dart';

class PlanCatalogScreen extends StatefulWidget {
  const PlanCatalogScreen({super.key});

  @override
  State<PlanCatalogScreen> createState() => _PlanCatalogScreenState();
}

class _PlanCatalogScreenState extends State<PlanCatalogScreen> {
  String effectiveMode = 'immediate'; // Always immediate (mode switcher removed)
  String billingTerm = 'monthly';
  int step = 0;
  bool hydratedDraft = false;
  bool loadingCheckout = false;
  bool loadingPlans = false;
  PlanItem? selectedPlan;
  PlanChangePreview? preview;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (hydratedDraft) return;
    hydratedDraft = true;
    final appState = AppStateScope.of(context);
    if (appState.planChangeOptions.isEmpty &&
        appState.plans.isEmpty &&
        !loadingPlans) {
      loadingPlans = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        await appState.refreshPlans();
        if (!mounted) return;
        setState(() => loadingPlans = false);
      });
    }
    final draft = appState.planChangeDraft;
    if (draft == null) return;
    final availablePlans = _availablePlans(appState);
    final match = availablePlans.cast<PlanItem?>().firstWhere(
          (item) => item?.planCode == draft.planCode,
          orElse: () => null,
        );
    if (match == null) return;
    final terms = _terms(match);
    selectedPlan = match;
    effectiveMode = draft.effectiveMode;
    billingTerm =
        terms.contains(draft.billingTerm) ? draft.billingTerm : terms.first;
    step = draft.step.clamp(1, 2);
    if (step == 2) {
      WidgetsBinding.instance
          .addPostFrameCallback((_) => _loadCheckout(appState, quiet: true));
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final plans = _availablePlans(appState);

    return PopScope(
      canPop: step == 0 || selectedPlan == null,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _saveDraftAndExit(appState);
      },
      child: Scaffold(
        backgroundColor: kBg,
        body: RefreshIndicator(
          color: kPrimary,
          backgroundColor: kSurface,
          onRefresh: appState.refresh,
          child: CustomScrollView(
            slivers: [
              // ── Gradient header ────────────────────────────────────────
              SliverToBoxAdapter(
                child: Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFF8224E3),
                  ),
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(4, 8, 16, 24),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          IconButton(
                            onPressed: () {
                              if (step == 0 || selectedPlan == null) {
                                Navigator.of(context).maybePop();
                              } else {
                                _saveDraftAndExit(appState);
                              }
                            },
                            icon: Icon(
                              step == 0
                                  ? Icons.arrow_back_ios_new_rounded
                                  : Icons.close_rounded,
                              color: Colors.white,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 12),
                                Text(
                                  step == 0
                                      ? 'Choose Plan'
                                      : step == 1
                                          ? 'Choose Duration'
                                          : 'Checkout',
                                  style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.5,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  step == 0
                                      ? (billing.currentPlan.isEmpty
                                          ? 'Select a plan to get started'
                                          : 'Current: ${billing.currentPlan}')
                                      : step == 1
                                          ? selectedPlan?.name ??
                                              'Choose billing duration'
                                          : 'Review and confirm your plan change',
                                  style: GoogleFonts.inter(
                                      color: Colors.white60, fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text(
                              'PLAN STUDIO',
                              style: GoogleFonts.inter(
                                color: const Color(0xFFD8B4FE),
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.8,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 32),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    // ── Step 0: Plan selection ─────────────────────────
                    if (step == 0) ...[
                      if (appState.planChangeDraft != null) ...[
                        _card(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Resume saved change',
                                  style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15,
                                      color: Colors.white)),
                              const SizedBox(height: 8),
                              Text(
                                'Saved draft for ${appState.planChangeDraft!.planName}. Resumes only here.',
                                style: GoogleFonts.inter(
                                    color: kMuted, height: 1.4, fontSize: 13),
                              ),
                              const SizedBox(height: 12),
                              Row(children: [
                                Expanded(
                                    child: FilledButton(
                                        onPressed: () => setState(() {}),
                                        child: const Text('Resume'))),
                                const SizedBox(width: 10),
                                Expanded(
                                    child: OutlinedButton(
                                        onPressed:
                                            appState.clearPlanChangeDraft,
                                        child: const Text('Discard'))),
                              ]),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],
                      if (plans.isEmpty)
                        _card(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('No plans available',
                                  style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15,
                                      color: Colors.white)),
                              const SizedBox(height: 8),
                              Text(
                                loadingPlans
                                    ? 'Loading full plan catalog...'
                                    : 'Could not load plans. Pull to refresh and try again.',
                                style: GoogleFonts.inter(
                                    color: kMuted, height: 1.4, fontSize: 13),
                              ),
                              if (!loadingPlans &&
                                  (appState.error ?? '').isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(appState.error!,
                                    style: GoogleFonts.inter(
                                        color: const Color(0xFFFF8A8A),
                                        fontWeight: FontWeight.w700,
                                        fontSize: 12)),
                              ],
                              if (!loadingPlans) ...[
                                const SizedBox(height: 12),
                                SizedBox(
                                  width: double.infinity,
                                  child: FilledButton(
                                    onPressed: () async {
                                      setState(() => loadingPlans = true);
                                      await appState.refreshPlans();
                                      if (!mounted) return;
                                      setState(() => loadingPlans = false);
                                    },
                                    child: const Text('Reload plans'),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        )
                      else
                        ..._buildSpeedGroups(plans, billing.currentPlan, appState),
                    ]

                    // ── Step 1: Duration ───────────────────────────────
                    else if (step == 1 && selectedPlan != null) ...[
                      _durationCard(selectedPlan!),
                      const SizedBox(height: 14),
                      _card(
                        child: Column(
                          children: [
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: loadingCheckout
                                    ? null
                                    : () => _loadCheckout(appState),
                                child: Text(loadingCheckout
                                    ? 'Preparing...'
                                    : 'Continue to checkout'),
                              ),
                            ),
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton(
                                onPressed: () => setState(() => step = 0),
                                child: const Text('Back to plans'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ]

                    // ── Step 2: Checkout ───────────────────────────────
                    else if (step == 2 && selectedPlan != null) ...[
                      _card(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Plan Summary',
                                style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 16,
                                    color: Colors.white)),
                            const SizedBox(height: 16),
                            _row('Plan', selectedPlan!.name),
                            _row('Speed',
                                '${selectedPlan!.speedMbps.toStringAsFixed(0)} Mbps'),
                            _row('Duration', _termLabel(billingTerm)),
                            const SizedBox(height: 12),
                            Container(height: 1, color: kBorderSoft),
                            const SizedBox(height: 12),
                            // Price breakdown with GST
                            Builder(builder: (_) {
                              final basePrice = selectedPlan!.monthlyPrice;
                              final gstRate = selectedPlan!.gstRate > 0
                                  ? selectedPlan!.gstRate
                                  : 18.0;
                              final gstAmount = selectedPlan!.pricesExcludeGst
                                  ? (basePrice * gstRate / 100)
                                  : 0.0;
                              final totalPrice = basePrice + gstAmount;
                              return Column(
                                children: [
                                  _row('Base price',
                                      '₹${basePrice.toStringAsFixed(0)}'),
                                  if (selectedPlan!.pricesExcludeGst)
                                    _row('GST (${gstRate.toStringAsFixed(0)}%)',
                                        '₹${gstAmount.toStringAsFixed(0)}'),
                                  _row('Total',
                                      '₹${totalPrice.toStringAsFixed(0)}',
                                      last: preview != null),
                                ],
                              );
                            }),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      if (preview != null)
                        _card(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Payment Summary',
                                  style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 16,
                                      color: Colors.white)),
                              const SizedBox(height: 16),
                              _row('Current plan price',
                                  '₹${preview!.currentPrice.toStringAsFixed(0)}'),
                              _row('New plan price',
                                  '₹${preview!.nextPrice.toStringAsFixed(0)}'),
                              if (preview!.adjustmentAmount != 0)
                                _row(
                                    preview!.adjustmentAmount > 0
                                        ? 'Pro-rata adjustment'
                                        : 'Credit adjustment',
                                    '₹${preview!.adjustmentAmount.abs().toStringAsFixed(0)}'),
                              const SizedBox(height: 8),
                              Container(height: 1, color: kBorderSoft),
                              const SizedBox(height: 8),
                              if (preview!.payableNow > 0)
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text('Amount payable',
                                          style: GoogleFonts.inter(
                                              color: Colors.white,
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800)),
                                    ),
                                    Text(
                                      '₹${preview!.payableNow.toStringAsFixed(0)}',
                                      style: GoogleFonts.inter(
                                          color: kAccent,
                                          fontSize: 20,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -0.5),
                                    ),
                                  ],
                                )
                              else if (preview!.creditAmount > 0)
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text('Credit to account',
                                          style: GoogleFonts.inter(
                                              color: Colors.white,
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800)),
                                    ),
                                    Text(
                                      '₹${preview!.creditAmount.toStringAsFixed(0)}',
                                      style: GoogleFonts.inter(
                                          color: kSuccess,
                                          fontSize: 20,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -0.5),
                                    ),
                                  ],
                                )
                              else
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text('No payment needed',
                                          style: GoogleFonts.inter(
                                              color: Colors.white,
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800)),
                                    ),
                                    Text(
                                      '₹0',
                                      style: GoogleFonts.inter(
                                          color: kSuccess,
                                          fontSize: 20,
                                          fontWeight: FontWeight.w900),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        )
                      else
                        _card(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            child: Row(
                              children: [
                                const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: kPrimaryLight)),
                                const SizedBox(width: 12),
                                Text('Calculating pricing...',
                                    style: GoogleFonts.inter(
                                        color: kMuted, fontSize: 13)),
                              ],
                            ),
                          ),
                        ),
                      const SizedBox(height: 14),
                      _card(
                        child: Column(
                          children: [
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton(
                                onPressed: appState.busy || preview == null
                                    ? null
                                    : () => _confirm(appState),
                                child: const Text('Confirm plan change'),
                              ),
                            ),
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton(
                                onPressed: () => setState(() => step = 1),
                                child: const Text('Back to duration'),
                              ),
                            ),
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton(
                                onPressed: () => _cancelCheckout(appState),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFFFF8A8A),
                                  side: const BorderSide(
                                      color: Color(0x44EF4444)),
                                ),
                                child: const Text('Cancel plan change'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Mode switcher (removed — always immediate) ────────────────────────

  // ── Plan card ────────────────────────────────────────────────────────

  Widget _planCard(PlanItem plan, double currentRecurring, AppState appState) {
    final premium = _isPremium(plan);
    final badges = <String>[
      if (premium) 'Recommended',
      if (plan.dataPolicy == 'unlimited') 'Unlimited Data',
      if (plan.routerIncluded) 'Router Included',
    ];
    final subtitle = plan.merchandisingSubtitle.isNotEmpty
        ? plan.merchandisingSubtitle
        : '${plan.speedMbps.toStringAsFixed(0)} Mbps Fiber Broadband';
    final bannerUrl = plan.bannerImageUrl;

    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRCard),
        border: Border.all(color: kBorderSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Banner area (clean image, no overlay) ──────
          if (bannerUrl.isNotEmpty)
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(28)),
              child: CachedNetworkImage(
                imageUrl: bannerUrl,
                height: 160,
                width: double.infinity,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(color: kSurface, height: 160),
                errorWidget: (_, __, ___) => const SizedBox.shrink(),
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

                // Price row (Airtel style — big price + speed + data inline)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    // Price
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '₹${plan.monthlyPrice.toStringAsFixed(0)}',
                          style: GoogleFonts.inter(
                            color: kText,
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
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
                        if (plan.pricesExcludeGst)
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
                          '${plan.speedMbps.toStringAsFixed(0)} Mbps',
                          style: GoogleFonts.inter(
                            color: kText,
                            fontSize: 14,
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
                          _dataLabel(plan),
                          style: GoogleFonts.inter(
                            color: kText,
                            fontSize: 14,
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

                // OTT apps row (if any)
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

                // Action buttons (Airtel style — View Details left, Select Plan right)
                Row(
                  children: [
                    Expanded(
                      child: PressableScale(
                        onTap: () => _previewPlan(plan, appState),
                        haptic: true,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          decoration: BoxDecoration(
                            color: kSurfaceLow,
                            borderRadius: BorderRadius.circular(kRSmall),
                            border: Border.all(color: kBorderSoft),
                          ),
                          child: Center(
                            child: Text(
                              'View Details',
                              style: GoogleFonts.inter(
                                color: kAccent,
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: PressableScale(
                        onTap: () => _selectPlan(plan, appState),
                        haptic: true,
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
                              'Select Plan',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Speed-grouped plan cards ─────────────────────────────────────────

  List<Widget> _buildSpeedGroups(
      List<PlanItem> plans, String currentPlanName, AppState appState) {
    // Group by speed (same logic as booking flow)
    final speedMap = <int, List<PlanItem>>{};
    for (final p in plans) {
      int speed = p.speedMbps.round();
      if (speed == 0) {
        final match = RegExp(r'(\d+)\s*[Mm]').firstMatch(p.name);
        if (match != null) speed = int.tryParse(match.group(1)!) ?? 0;
      }
      speedMap.putIfAbsent(speed, () => []).add(p);
    }
    final groups = speedMap.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));

    return groups.map((entry) {
      final speedMbps = entry.key;
      final groupPlans = entry.value
        ..sort((a, b) => a.billingPeriodMonths.compareTo(b.billingPeriodMonths));
      final representative = groupPlans.first;
      final isActive = groupPlans.any((p) =>
          p.name == currentPlanName ||
          p.planCode == currentPlanName ||
          currentPlanName.contains(p.name) ||
          p.name.contains(currentPlanName));
      final bannerUrl = representative.bannerImageUrl;
      final lowestPrice = groupPlans
          .map((p) => p.monthlyPrice)
          .reduce((a, b) => a < b ? a : b);
      final badges = <String>[
        if (isActive) 'Active Plan',
        if (representative.recommended) 'Recommended',
        if (representative.dataPolicy == 'unlimited') 'Unlimited',
        if (representative.routerIncluded) 'Router Included',
      ];

      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: GestureDetector(
          onTap: () => _selectSpeedGroup(groupPlans, appState),
          child: Container(
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(kRCard),
              border: Border.all(
                color: isActive ? kAccent : kBorderSoft,
                width: isActive ? 1.5 : 1,
              ),
              boxShadow: isActive
                  ? [
                      BoxShadow(
                        color: kAccent.withValues(alpha: 0.2),
                        blurRadius: 14,
                        offset: const Offset(0, 5),
                      ),
                    ]
                  : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Banner
                if (bannerUrl.isNotEmpty)
                  ClipRRect(
                    borderRadius:
                        const BorderRadius.vertical(top: Radius.circular(28)),
                    child: Image.network(
                      bannerUrl,
                      height: 120,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                    ),
                  ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Badges
                      if (badges.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            children: badges
                                .map((b) => Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: b == 'Active Plan'
                                            ? kSuccess.withValues(alpha: 0.15)
                                            : kAccentSoft,
                                        borderRadius:
                                            BorderRadius.circular(kRPill),
                                      ),
                                      child: Text(
                                        b,
                                        style: GoogleFonts.inter(
                                          color: b == 'Active Plan'
                                              ? kSuccess
                                              : kAccent,
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ))
                                .toList(),
                          ),
                        ),
                      // Price + Speed + Data
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                '₹${lowestPrice.toStringAsFixed(0)}',
                                style: GoogleFonts.inter(
                                  color: kText,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              Text(
                                ' /m +GST',
                                style: GoogleFonts.inter(
                                  color: kTextMuted,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          const Spacer(),
                          Column(
                            children: [
                              Text(
                                '$speedMbps Mbps',
                                style: GoogleFonts.inter(
                                  color: kText,
                                  fontSize: 14,
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
                          const SizedBox(width: 16),
                          Column(
                            children: [
                              Text(
                                representative.dataPolicy == 'unlimited'
                                    ? 'Unlimited'
                                    : '${representative.dataLimitGb.toStringAsFixed(0)} GB',
                                style: GoogleFonts.inter(
                                  color: kText,
                                  fontSize: 14,
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
                      const SizedBox(height: 14),
                      // Button
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          color: isActive ? kSurface : kAccent,
                          borderRadius: BorderRadius.circular(kRSmall),
                          border: isActive
                              ? Border.all(color: kBorderSoft)
                              : null,
                          boxShadow: isActive
                              ? null
                              : [
                                  BoxShadow(
                                    color: kAccent.withValues(alpha: 0.35),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                        ),
                        child: Center(
                          child: Text(
                            isActive ? 'Change Duration' : 'Select Plan',
                            style: GoogleFonts.inter(
                              color: isActive ? kText : Colors.white,
                              fontSize: 13,
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
        ),
      );
    }).toList();
  }

  void _selectSpeedGroup(List<PlanItem> groupPlans, AppState appState) {
    final plan = groupPlans.first;
    final terms = _buildGroupTerms(groupPlans);
    setState(() {
      selectedPlan = plan;
      billingTerm = terms.first;
      step = 1;
      preview = null;
    });
    appState.savePlanChangeDraft(
        planCode: plan.planCode,
        planName: plan.name,
        billingTerm: billingTerm,
        effectiveMode: effectiveMode,
        step: 1);
  }

  List<String> _buildGroupTerms(List<PlanItem> groupPlans) {
    final terms = <String>{};
    for (final p in groupPlans) {
      final months = p.billingPeriodMonths;
      if (months <= 1) terms.add('monthly');
      else if (months == 3) terms.add('quarterly');
      else if (months == 6) terms.add('halfYearly');
      else if (months >= 12) terms.add('yearly');
    }
    if (terms.isEmpty) terms.add('monthly');
    return terms.toList();
  }

  // ── Duration card ────────────────────────────────────────────────────

  Widget _durationCard(PlanItem plan) {
    // Get all plans in the same speed group for duration options
    final appState = AppStateScope.of(context);
    final allPlans = _availablePlans(appState);
    int planSpeed = plan.speedMbps.round();
    if (planSpeed == 0) {
      final match = RegExp(r'(\d+)\s*[Mm]').firstMatch(plan.name);
      if (match != null) planSpeed = int.tryParse(match.group(1)!) ?? 0;
    }
    final groupPlans = allPlans.where((p) {
      int speed = p.speedMbps.round();
      if (speed == 0) {
        final match = RegExp(r'(\d+)\s*[Mm]').firstMatch(p.name);
        if (match != null) speed = int.tryParse(match.group(1)!) ?? 0;
      }
      return speed == planSpeed;
    }).toList()
      ..sort((a, b) => a.billingPeriodMonths.compareTo(b.billingPeriodMonths));

    // Build duration options from group
    final durationOptions = <(String, PlanItem)>[]; // (term, plan)
    for (final p in groupPlans) {
      final months = p.billingPeriodMonths;
      final term = months <= 1
          ? 'monthly'
          : months == 3
              ? 'quarterly'
              : months == 6
                  ? 'halfYearly'
                  : 'yearly';
      durationOptions.add((term, p));
    }
    if (durationOptions.isEmpty) durationOptions.add(('monthly', plan));

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Select duration',
              style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                  color: Colors.white)),
          const SizedBox(height: 6),
          Text(
            '$planSpeed Mbps — choose billing period',
            style:
                GoogleFonts.inter(color: kMuted, height: 1.4, fontSize: 13),
          ),
          const SizedBox(height: 16),
          ...durationOptions.map((opt) {
            final term = opt.$1;
            final p = opt.$2;
            final selected = billingTerm == term;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: PressableScale(
                onTap: () => setState(() {
                  billingTerm = term;
                  selectedPlan = p; // Switch to the correct plan for this duration
                }),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: selected ? kPrimary.withValues(alpha: 0.1) : kBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                        color: selected
                            ? kPrimary.withValues(alpha: 0.4)
                            : kBorder),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_termLabel(term),
                                style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                    color: Colors.white)),
                            const SizedBox(height: 3),
                            Text(_termBillingCaption(term),
                                style: GoogleFonts.inter(
                                    color: kPrimaryLight,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 11)),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'Rs ${p.monthlyPrice.toStringAsFixed(0)}',
                            style: GoogleFonts.inter(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                color: selected ? kPrimaryLight : Colors.white),
                          ),
                          if (selected)
                            Container(
                              margin: const EdgeInsets.only(top: 4),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: kPrimary,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text('Selected',
                                  style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 10)),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          }),
          const SizedBox(height: 4),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: kBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kBorder),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Summary',
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: Colors.white)),
                const SizedBox(height: 10),
                _row('Plan', '$planSpeed Mbps'),
                _row('Duration', _termLabel(billingTerm)),
                _row('Amount',
                    'Rs ${(selectedPlan?.monthlyPrice ?? plan.monthlyPrice).toStringAsFixed(0)}'),
                _row('Billing', _termBillingCaption(billingTerm), last: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _durationOption(PlanItem plan, String term) {
    final selected = billingTerm == term;
    return PressableScale(
      onTap: () => setState(() => billingTerm = term),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? kPrimary.withValues(alpha: 0.1) : kBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: selected ? kPrimary.withValues(alpha: 0.4) : kBorder),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_termLabel(term),
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: Colors.white)),
                  const SizedBox(height: 3),
                  Text(_durationHelp(term),
                      style: GoogleFonts.inter(
                          color: kMuted, fontSize: 12, height: 1.3)),
                  const SizedBox(height: 5),
                  Text(_termBillingCaption(term),
                      style: GoogleFonts.inter(
                          color: kPrimaryLight,
                          fontWeight: FontWeight.w600,
                          fontSize: 11)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Rs ${_price(plan, term).toStringAsFixed(0)}',
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                      color: selected ? kPrimaryLight : Colors.white),
                ),
                if (selected) ...[
                  const SizedBox(height: 4),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: kPrimary,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text('Selected',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 10)),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorder),
        ),
        child: child,
      );

  Widget _pill(String label, bool highlight) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: highlight ? kPrimary.withValues(alpha: 0.15) : kBg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
              color: highlight ? kPrimary.withValues(alpha: 0.4) : kBorder),
        ),
        child: Text(label,
            style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: highlight ? kPrimaryLight : kMuted)),
      );

  Widget _metric(String value, String label) => Expanded(
        child: Column(
          children: [
            Text(value,
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: Colors.white)),
            const SizedBox(height: 2),
            Text(label,
                style: GoogleFonts.inter(fontSize: 10, color: kMuted),
                textAlign: TextAlign.center),
          ],
        ),
      );

  Widget _metricDiv() => Container(
      width: 1, height: 24, color: Colors.white.withValues(alpha: 0.08));

  Widget _row(String label, String value, {bool last = false}) => Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          border: Border(
              bottom:
                  last ? BorderSide.none : const BorderSide(color: kBorder)),
        ),
        child: Row(
          children: [
            Expanded(
                child: Text(label,
                    style: GoogleFonts.inter(color: kMuted, fontSize: 13))),
            Flexible(
              child: Text(value,
                  textAlign: TextAlign.right,
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      fontSize: 13)),
            ),
          ],
        ),
      );

  // ── Business logic ───────────────────────────────────────────────────

  Future<void> _selectPlan(PlanItem plan, AppState appState) async {
    final terms = _terms(plan);
    setState(() {
      selectedPlan = plan;
      billingTerm = terms.first;
      step = 1;
      preview = null;
    });
    await appState.savePlanChangeDraft(
        planCode: plan.planCode,
        planName: plan.name,
        billingTerm: billingTerm,
        effectiveMode: effectiveMode,
        step: 1);
  }

  Future<void> _loadCheckout(AppState appState, {bool quiet = false}) async {
    if (selectedPlan == null) return;
    setState(() => loadingCheckout = true);
    final nextPreview = await appState.previewPlanChange(
        planCode: selectedPlan!.planCode,
        effectiveMode: effectiveMode,
        billingTerm: billingTerm);
    if (!mounted) return;
    setState(() {
      preview = nextPreview;
      loadingCheckout = false;
      if (nextPreview != null) step = 2;
    });
    if (nextPreview != null) {
      await appState.savePlanChangeDraft(
          planCode: selectedPlan!.planCode,
          planName: selectedPlan!.name,
          billingTerm: billingTerm,
          effectiveMode: effectiveMode,
          step: 2);
    } else if (!quiet) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(appState.error ?? 'Unable to prepare checkout')));
    }
  }

  Future<void> _confirm(AppState appState) async {
    if (selectedPlan == null) return;
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final request = await appState.requestPlanChange(
        planCode: selectedPlan!.planCode,
        effectiveMode: effectiveMode,
        billingTerm: billingTerm);
    if (!mounted) return;
    final result = appState.lastPlanChangeResult;
    if (result == null) {
      messenger.showSnackBar(SnackBar(
          content: Text(appState.error ?? 'Unable to apply plan change')));
      return;
    }
    messenger.showSnackBar(SnackBar(
        content: Text(result.paymentRequired
            ? 'Pay Rs ${result.payableNow.toStringAsFixed(0)} to complete this change.'
            : 'Plan change submitted: ${request ?? result.requestNumber}')));
    if (result.paymentRequired && result.payableNow > 0) {
      final paymentOrder =
          await appState.loadBillingPaymentOrder(amount: result.payableNow);
      if (!mounted || paymentOrder == null) return;
      final paymentCompleted = await navigator.push<bool>(MaterialPageRoute(
          builder: (_) => BillingPaymentScreen(paymentOrder: paymentOrder)));
      if (!mounted) return;
      if (paymentCompleted != true) {
        messenger.showSnackBar(const SnackBar(
            content: Text('Payment not completed yet. Plan change is still pending.')));
        return;
      }
      if (!mounted) return;
      // Explicitly complete the pending plan change in case the Razorpay webhook
      // hasn't fired yet when the user returns to the app.
      await appState.completePlanChange();
    }
    if (mounted) {
      await appState.refresh();
      navigator.pop();
    }
  }

  Future<void> _previewPlan(PlanItem plan, AppState appState) async {
    final tempPreview = await appState.previewPlanChange(
        planCode: plan.planCode,
        effectiveMode: effectiveMode,
        billingTerm: 'monthly');
    if (!mounted || tempPreview == null) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: kBorder),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                    width: 36,
                    height: 4,
                    decoration: BoxDecoration(
                        color: kBorder,
                        borderRadius: BorderRadius.circular(999))),
              ),
              const SizedBox(height: 16),
              Text(plan.name,
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                      color: Colors.white,
                      letterSpacing: -0.3)),
              const SizedBox(height: 14),
              _row('Monthly price',
                  'Rs ${tempPreview.nextPrice.toStringAsFixed(0)}'),
              _row('Durations', _terms(plan).map(_termLabel).join(' · '),
                  last: true),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      _selectPlan(plan, appState);
                    },
                    child: const Text('Select this plan')),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _saveDraftAndExit(AppState appState) async {
    if (selectedPlan != null && step > 0) {
      await appState.savePlanChangeDraft(
        planCode: selectedPlan!.planCode,
        planName: selectedPlan!.name,
        billingTerm: billingTerm,
        effectiveMode: effectiveMode,
        step: step,
        notifyResume: true,
      );
    }
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _cancelCheckout(AppState appState) async {
    final ok = await appState.cancelPlanChangeCheckout();
    if (!mounted) return;
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ok
            ? 'Plan change checkout cancelled'
            : (appState.error ?? 'Unable to cancel plan change'))));
  }

  // ── Data helpers ─────────────────────────────────────────────────────

  List<PlanItem> _availablePlans(AppState appState) {
    final currentPlanCode = appState.connections
        .cast<CustomerConnection?>()
        .firstWhere(
          (item) => item?.customerId == appState.selectedCustomerId,
          orElse: () => null,
        )
        ?.planName;
    final alternates = appState.planChangeOptions
        .where((item) => item.planCode.isNotEmpty)
        .toList(growable: false);
    if (alternates.isNotEmpty) return alternates;
    final catalog =
        appState.plans.where((item) => item.planCode.isNotEmpty).toList();
    if (catalog.isEmpty) return const <PlanItem>[];
    final filtered =
        catalog.where((item) => item.name != currentPlanCode).toList();
    return filtered.isNotEmpty ? filtered : catalog;
  }

  List<String> _terms(PlanItem plan) {
    final terms = <String>[
      if (plan.validityMonthly || plan.monthlyPrice > 0) 'monthly',
      if (plan.validityQuarterly || plan.quarterlyPrice > 0) 'quarterly',
      if (plan.validityHalfYearly || plan.halfYearlyPrice > 0) 'halfYearly',
      if (plan.validityYearly || plan.yearlyPrice > 0) 'yearly',
    ];
    return terms.isEmpty ? const ['monthly'] : terms;
  }

  double _price(PlanItem plan, String term) {
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

  String _termLabel(String term) {
    switch (term) {
      case 'quarterly':
        return '3 months';
      case 'halfYearly':
        return '6 months';
      case 'yearly':
        return '12 months';
      default:
        return '1 month';
    }
  }

  String _termShort(String term) {
    switch (term) {
      case 'quarterly':
        return 'QTR';
      case 'halfYearly':
        return 'HALF';
      case 'yearly':
        return 'YEAR';
      default:
        return 'MONTH';
    }
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

  String _durationHelp(String term) {
    switch (term) {
      case 'quarterly':
        return '3 month commitment with fewer renewals.';
      case 'halfYearly':
        return '6 month uninterrupted billing cycle.';
      case 'yearly':
        return '12 month duration for maximum stability.';
      default:
        return 'Flexible monthly cycle.';
    }
  }

  String _termBillingCaption(String term) {
    switch (term) {
      case 'quarterly':
        return 'Billed once for 3 months';
      case 'halfYearly':
        return 'Billed once for 6 months';
      case 'yearly':
        return 'Billed once for 12 months';
      default:
        return 'Billed monthly';
    }
  }
}


// ── Info Chip (used in plan cards for speed/data) ─────────────────────────────

class _InfoChip extends StatelessWidget {
  const _InfoChip({super.key, required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          value,
          style: GoogleFonts.inter(
            color: kText,
            fontSize: 16,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
          ),
        ),
        Text(
          label,
          style: GoogleFonts.inter(
            color: kTextMuted,
            fontSize: 10,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
