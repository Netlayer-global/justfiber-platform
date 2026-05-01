import 'package:flutter/material.dart';
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
  String effectiveMode = 'immediate';
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
                    // Stepper
                    _stepper(),
                    const SizedBox(height: 18),

                    // ── Step 0: Plan selection ─────────────────────────
                    if (step == 0) ...[
                      _modeSwitcher(),
                      const SizedBox(height: 14),
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
                        ...plans.map((plan) => Padding(
                              padding: const EdgeInsets.only(bottom: 14),
                              child: _planCard(
                                  plan, billing.recurringAmount, appState),
                            )),
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
                            Text('Review checkout',
                                style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15,
                                    color: Colors.white)),
                            const SizedBox(height: 14),
                            _row('Plan', selectedPlan!.name),
                            _row('Speed',
                                '${selectedPlan!.speedMbps.toStringAsFixed(0)} Mbps'),
                            _row('Duration', _termLabel(billingTerm)),
                            _row(
                                'Mode',
                                effectiveMode == 'next_cycle'
                                    ? 'Apply next cycle'
                                    : 'Apply now'),
                            _row('Price',
                                'Rs ${_price(selectedPlan!, billingTerm).toStringAsFixed(0)}',
                                last: true),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      _card(
                        child: preview == null
                            ? Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 8),
                                child: Row(
                                  children: [
                                    const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: kPrimaryLight)),
                                    const SizedBox(width: 12),
                                    Text('Loading checkout summary...',
                                        style: GoogleFonts.inter(
                                            color: kMuted, fontSize: 13)),
                                  ],
                                ),
                              )
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Pricing breakdown',
                                      style: GoogleFonts.inter(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 15,
                                          color: Colors.white)),
                                  const SizedBox(height: 14),
                                  _row('Current price',
                                      'Rs ${preview!.currentPrice.toStringAsFixed(0)}'),
                                  _row('Next price',
                                      'Rs ${preview!.nextPrice.toStringAsFixed(0)}'),
                                  _row('Adjustment',
                                      'Rs ${preview!.adjustmentAmount.toStringAsFixed(0)}'),
                                  if (preview!.payableNow > 0)
                                    _row('Payable now',
                                        'Rs ${preview!.payableNow.toStringAsFixed(0)}'),
                                  if (preview!.creditAmount > 0)
                                    _row('Credit',
                                        'Rs ${preview!.creditAmount.toStringAsFixed(0)}',
                                        last: true),
                                ],
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

  // ── Stepper ──────────────────────────────────────────────────────────

  Widget _stepper() {
    const labels = ['Plan', 'Duration', 'Checkout'];
    return _card(
      child: Column(
        children: [
          Row(
            children: List.generate(labels.length, (i) {
              final active = i <= step;
              return Expanded(
                child: Container(
                  height: 4,
                  margin: EdgeInsets.only(
                      left: i == 0 ? 0 : 4,
                      right: i == labels.length - 1 ? 0 : 4),
                  decoration: BoxDecoration(
                    color: active ? kPrimary : kBorder,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              );
            }),
          ),
          const SizedBox(height: 14),
          Row(
            children: List.generate(labels.length, (i) {
              final active = i == step;
              final complete = i < step;
              return Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: active || complete
                            ? kPrimary
                            : kPrimary.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                            color: active || complete
                                ? kPrimary
                                : kPrimary.withValues(alpha: 0.2)),
                      ),
                      child: Icon(
                        complete ? Icons.check_rounded : Icons.circle,
                        size: complete ? 16 : 10,
                        color:
                            active || complete ? Colors.white : kPrimaryLight,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      labels[i],
                      textAlign: TextAlign.center,
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 11,
                        color: active || complete ? Colors.white : kMuted,
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  // ── Mode switcher ────────────────────────────────────────────────────

  Widget _modeSwitcher() => _card(
        child: Row(children: [
          Expanded(child: _modeBtn('immediate', 'Switch now')),
          const SizedBox(width: 8),
          Expanded(child: _modeBtn('next_cycle', 'Next cycle')),
        ]),
      );

  Widget _modeBtn(String value, String label) {
    final active = effectiveMode == value;
    return PressableScale(
      onTap: () => setState(() => effectiveMode = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: active ? kPrimary.withValues(alpha: 0.18) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: active ? kPrimary.withValues(alpha: 0.5) : kBorder),
        ),
        alignment: Alignment.center,
        child: Text(label,
            style: GoogleFonts.inter(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: active ? kPrimaryLight : kMuted)),
      ),
    );
  }

  // ── Plan card ────────────────────────────────────────────────────────

  Widget _planCard(PlanItem plan, double currentRecurring, AppState appState) {
    final premium = _isPremium(plan);
    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(spacing: 6, runSpacing: 6, children: [
                      _pill(premium ? 'Recommended' : 'Broadband', premium),
                      _pill(_terms(plan).map(_termShort).join(' · '), false),
                    ]),
                    const SizedBox(height: 12),
                    Text(plan.name,
                        style: GoogleFonts.inter(
                            fontWeight: FontWeight.w900,
                            fontSize: 20,
                            color: Colors.white,
                            letterSpacing: -0.3)),
                    const SizedBox(height: 4),
                    Text(
                      'Rs ${plan.monthlyPrice.toStringAsFixed(0)} / month',
                      style: GoogleFonts.inter(
                          color: kPrimaryLight,
                          fontWeight: FontWeight.w800,
                          fontSize: 16),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: kPrimary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
                ),
                child: Icon(
                  premium ? Icons.rocket_launch_rounded : Icons.wifi_rounded,
                  color: kPrimaryLight,
                  size: 24,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: kBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: kBorder),
            ),
            child: Row(
              children: [
                _metric(plan.speedMbps.toStringAsFixed(0), 'Mbps Down'),
                _metricDiv(),
                _metric(plan.uploadSpeedMbps.toStringAsFixed(0), 'Mbps Up'),
                _metricDiv(),
                _metric(_dataLabel(plan), 'Data'),
                _metricDiv(),
                _metric('${_terms(plan).length}', 'Terms'),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _row(
              'Current plan cost',
              currentRecurring > 0
                  ? 'Rs ${currentRecurring.toStringAsFixed(0)}'
                  : '—'),
          _row('Durations', _terms(plan).map(_termLabel).join(' · '),
              last: true),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _previewPlan(plan, appState),
                  child: const Text('View details'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: () => _selectPlan(plan, appState),
                  child: const Text('Select'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Duration card ────────────────────────────────────────────────────

  Widget _durationCard(PlanItem plan) => _card(
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
              'Choose a billing term for ${plan.name}.',
              style:
                  GoogleFonts.inter(color: kMuted, height: 1.4, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _pill('${plan.speedMbps.toStringAsFixed(0)} Mbps', true),
              _pill(effectiveMode == 'next_cycle' ? 'Next cycle' : 'Apply now',
                  false),
            ]),
            const SizedBox(height: 16),
            ..._terms(plan).map((term) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _durationOption(plan, term),
                )),
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
                  _row('Plan', plan.name),
                  _row('Duration', _termLabel(billingTerm)),
                  _row('Amount',
                      'Rs ${_price(plan, billingTerm).toStringAsFixed(0)}'),
                  _row('Billing', _termBillingCaption(billingTerm), last: true),
                ],
              ),
            ),
          ],
        ),
      );

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
      await navigator.push(MaterialPageRoute(
          builder: (_) => BillingPaymentScreen(paymentOrder: paymentOrder)));
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
