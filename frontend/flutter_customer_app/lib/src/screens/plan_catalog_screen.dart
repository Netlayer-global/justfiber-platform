import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/models.dart';
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
  PlanItem? selectedPlan;
  PlanChangePreview? preview;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (hydratedDraft) return;
    hydratedDraft = true;
    final appState = AppStateScope.of(context);
    final draft = appState.planChangeDraft;
    if (draft == null) return;
    final match = appState.planChangeOptions.cast<PlanItem?>().firstWhere(
          (item) => item?.planCode == draft.planCode,
          orElse: () => null,
        );
    if (match == null) return;
    final terms = _terms(match);
    selectedPlan = match;
    effectiveMode = draft.effectiveMode;
    billingTerm = terms.contains(draft.billingTerm) ? draft.billingTerm : terms.first;
    step = draft.step.clamp(1, 2);
    if (step == 2) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadCheckout(appState, quiet: true));
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final plans = appState.planChangeOptions;
    return WillPopScope(
      onWillPop: () async {
        if (step == 0 || selectedPlan == null) return true;
        await _saveDraftAndExit(appState);
        return false;
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(step == 0 ? 'Choose your plan' : step == 1 ? 'Choose duration' : 'Checkout'),
          backgroundColor: const Color(0xFFF6F1EB),
          foregroundColor: const Color(0xFF131313),
          leading: step == 0 ? null : IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => _saveDraftAndExit(appState)),
        ),
        backgroundColor: const Color(0xFFF6F1EB),
        body: RefreshIndicator(
          color: const Color(0xFF8224E3),
          backgroundColor: const Color(0xFFF6F1EB),
          onRefresh: appState.refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
            children: [
              _hero(step == 0 ? (billing.currentPlan.isEmpty ? 'Choose your next plan' : billing.currentPlan) : selectedPlan?.name ?? 'Plan change',
                  step == 0 ? 'Select a plan first, then choose duration like booking flow.' : step == 1 ? 'Choose the duration before checkout.' : 'Review and confirm the plan change.'),
              const SizedBox(height: 16),
              if (step == 0) ...[
                _modeSwitcher(),
                const SizedBox(height: 16),
                if (appState.planChangeDraft != null)
                  _surface(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Resume saved change', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
                      const SizedBox(height: 8),
                      Text('Saved draft for ${appState.planChangeDraft!.planName}. Hidden everywhere else and resumes only here.', style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4)),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: FilledButton(onPressed: () => setState(() {}), style: _filledStyle(), child: const Text('Resume'))),
                        const SizedBox(width: 12),
                        Expanded(child: OutlinedButton(onPressed: () async => appState.clearPlanChangeDraft(), child: const Text('Discard'))),
                      ]),
                    ]),
                  ),
                if (appState.planChangeDraft != null) const SizedBox(height: 16),
              if (plans.isEmpty)
                  _surface(child: const Text('No alternate plans available right now.', style: TextStyle(color: Color(0xFF6E6A67))))
                else
                  ...plans.map((plan) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: _planCard(plan, billing.recurringAmount, appState),
                      )),
              ] else if (step == 1 && selectedPlan != null) ...[
                _durationCard(selectedPlan!),
                const SizedBox(height: 16),
                _responsiveActionButtons(
                  primary: FilledButton(
                    onPressed: loadingCheckout ? null : () => _loadCheckout(appState),
                    style: _filledStyle(),
                    child: Text(loadingCheckout ? 'Preparing...' : 'Continue to checkout'),
                  ),
                  secondary: OutlinedButton(
                    onPressed: () => setState(() => step = 0),
                    child: const Text('Back to plans'),
                  ),
                ),
              ] else if (step == 2 && selectedPlan != null) ...[
                _surface(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Review checkout', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF131313))),
                    const SizedBox(height: 12),
                    _row('Plan', selectedPlan!.name),
                    _row('Speed', '${selectedPlan!.speedMbps.toStringAsFixed(0)} Mbps'),
                    _row('Duration', _termLabel(billingTerm)),
                    _row('Mode', effectiveMode == 'next_cycle' ? 'Apply next cycle' : 'Apply now'),
                    _row('Commercial price', 'Rs ${_price(selectedPlan!, billingTerm).toStringAsFixed(0)}'),
                  ]),
                ),
                const SizedBox(height: 16),
                _surface(
                  child: preview == null
                      ? const Text('Checkout summary is loading.', style: TextStyle(color: Color(0xFF6E6A67)))
                      : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          _row('Current price', 'Rs ${preview!.currentPrice.toStringAsFixed(0)}'),
                          _row('Next price', 'Rs ${preview!.nextPrice.toStringAsFixed(0)}'),
                          _row('Adjustment', 'Rs ${preview!.adjustmentAmount.toStringAsFixed(0)}'),
                          if (preview!.payableNow > 0) _row('Payable now', 'Rs ${preview!.payableNow.toStringAsFixed(0)}'),
                          if (preview!.creditAmount > 0) _row('Credit amount', 'Rs ${preview!.creditAmount.toStringAsFixed(0)}'),
                        ]),
                ),
                const SizedBox(height: 16),
                _responsiveActionButtons(
                  primary: FilledButton(
                    onPressed: appState.busy || preview == null ? null : () => _confirm(appState),
                    style: _filledStyle(),
                    child: const Text('Confirm'),
                  ),
                  secondary: OutlinedButton(
                    onPressed: () => setState(() => step = 1),
                    child: const Text('Back to Duration'),
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => _cancelCheckout(appState),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFB42318),
                      backgroundColor: const Color(0xFFFFFFFF),
                      side: const BorderSide(color: Color(0x33B42318)),
                    ),
                    child: const Text('Cancel plan change'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _hero(String title, String subtitle) => Container(
        padding: const EdgeInsets.all(22),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xFF8224E3), Color(0xFF9B51E0)], begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(32),
          boxShadow: const [BoxShadow(color: Color(0x220F172A), blurRadius: 28, offset: Offset(0, 14))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('PLAN STUDIO', style: TextStyle(color: Color(0xFFE9D5FF), fontWeight: FontWeight.w800, letterSpacing: 2.1, fontSize: 11)),
          const SizedBox(height: 10),
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 28, color: Color(0xFFFFFFFF))),
          const SizedBox(height: 8),
          Text(subtitle, style: const TextStyle(color: Color(0xFFF3E8FF), height: 1.45)),
        ]),
      );

  Widget _modeSwitcher() => _surface(
        child: Row(children: [
          Expanded(child: _modeButton('immediate', 'Switch now')),
          const SizedBox(width: 8),
          Expanded(child: _modeButton('next_cycle', 'Next cycle')),
        ]),
      );

  Widget _modeButton(String value, String label) {
    final active = effectiveMode == value;
    return InkWell(
      onTap: () => setState(() => effectiveMode = value),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: active ? const Color(0xFFF1E8FF) : const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: active ? const Color(0xFF8224E3) : const Color(0x338224E3)),
        ),
        child: Text(label, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
      ),
    );
  }

  Widget _planCard(PlanItem plan, double currentRecurring, AppState appState) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: const Color(0x338224E3)),
          boxShadow: const [BoxShadow(color: Color(0x14030B14), blurRadius: 18, offset: Offset(0, 10))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(spacing: 8, runSpacing: 8, children: [
                  _pill(_isPremium(plan) ? 'Recommended' : 'Broadband', _isPremium(plan)),
                  _pill(_terms(plan).map(_termShort).join(' / '), false),
                ]),
                const SizedBox(height: 14),
                Text(plan.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Color(0xFF131313))),
                const SizedBox(height: 6),
                Text('Rs ${plan.monthlyPrice.toStringAsFixed(0)} / month', style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800, fontSize: 18)),
              ]),
            ),
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: _isPremium(plan) ? const [Color(0xFFF1E8FF), Color(0xFF8224E3)] : const [Color(0xFFF8F4FF), Color(0xFF8224E3)]),
                borderRadius: BorderRadius.circular(22),
              ),
              child: Icon(_isPremium(plan) ? Icons.rocket_launch_rounded : Icons.wifi_rounded, color: const Color(0xFFFFFFFF), size: 30),
            ),
          ]),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F4FF),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0x338224E3)),
            ),
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _metricTile('${plan.speedMbps.toStringAsFixed(0)} Mbps', 'Speed'),
                _metricTile('${plan.uploadSpeedMbps.toStringAsFixed(0)} Mbps', 'Upload'),
                _metricTile(_dataLabel(plan), 'Data'),
                _metricTile(_terms(plan).length.toString(), 'Terms'),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _row('Current recurring', currentRecurring > 0 ? 'Rs ${currentRecurring.toStringAsFixed(0)}' : 'Not available'),
          _row('Available durations', _terms(plan).map(_termLabel).join(' / ')),
          const SizedBox(height: 12),
          _responsiveActionButtons(
            primary: FilledButton(
              onPressed: () => _selectPlan(plan, appState),
              style: _filledStyle(),
              child: const Text('Select plan'),
            ),
            secondary: OutlinedButton(
              onPressed: () => _previewPlan(plan, appState),
              child: const Text('View details'),
            ),
          ),
        ]),
      );

  Widget _durationCard(PlanItem plan) => _surface(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Select duration', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: Color(0xFF131313))),
          const SizedBox(height: 8),
          Text('${plan.name} ke liye booking jaisa duration choose karo, then checkout continue karo.', style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45)),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _pill('${plan.speedMbps.toStringAsFixed(0)} Mbps', true),
              _pill(effectiveMode == 'next_cycle' ? 'Apply next cycle' : 'Apply now', false),
            ],
          ),
          const SizedBox(height: 16),
          ..._terms(plan).map((term) => Padding(padding: const EdgeInsets.only(bottom: 12), child: _durationOption(plan, term))),
          const SizedBox(height: 6),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F4FF),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0x228224E3)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Selected summary', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313))),
              const SizedBox(height: 10),
              _row('Plan', plan.name),
              _row('Duration', _termLabel(billingTerm)),
              _row('Payable value', 'Rs ${_price(plan, billingTerm).toStringAsFixed(0)}'),
              _row('Billing mode', _termBillingCaption(billingTerm)),
            ]),
          ),
        ]),
      );

  Widget _durationOption(PlanItem plan, String term) {
    final selected = billingTerm == term;
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () => setState(() => billingTerm = term),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFF8F4FF) : const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: selected ? const Color(0xFF8224E3) : const Color(0x338224E3)),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 340;
            final details = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_termLabel(term), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
                const SizedBox(height: 4),
                Text(_durationHelp(term), style: const TextStyle(color: Color(0xFF6E6A67), height: 1.35)),
                const SizedBox(height: 8),
                Text(_termBillingCaption(term), style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700)),
              ],
            );
            final price = Column(
              crossAxisAlignment: compact ? CrossAxisAlignment.start : CrossAxisAlignment.end,
              children: [
                Text('Rs ${_price(plan, term).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF8224E3))),
                const SizedBox(height: 6),
                if (selected)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: const Color(0xFF8224E3), borderRadius: BorderRadius.circular(999)),
                    child: const Text('Selected', style: TextStyle(color: Color(0xFFFFFFFF), fontWeight: FontWeight.w800, fontSize: 11)),
                  ),
              ],
            );
            if (compact) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  details,
                  const SizedBox(height: 12),
                  price,
                ],
              );
            }
            return Row(
              children: [
                Expanded(child: details),
                const SizedBox(width: 12),
                price,
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _surface({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0x338224E3)),
        ),
        child: child,
      );

  Widget _pill(String label, bool highlight) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: highlight ? const Color(0xFFF1E8FF) : const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: highlight ? const Color(0x668224E3) : const Color(0x338224E3)),
        ),
        child: Text(label, style: TextStyle(color: highlight ? const Color(0xFF8224E3) : const Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
      );

  Widget _metric(String value, String label) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF8A92A3))),
        ],
      );

  Widget _metricTile(String value, String label) => SizedBox(
        width: 120,
        child: _metric(value, label),
      );

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67))),
          const Spacer(),
          Flexible(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700))),
        ]),
      );

  Widget _responsiveActionButtons({required Widget primary, required Widget secondary}) => LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth < 360) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                primary,
                const SizedBox(height: 12),
                secondary,
              ],
            );
          }
          return Row(
            children: [
              Expanded(child: secondary),
              const SizedBox(width: 12),
              Expanded(child: primary),
            ],
          );
        },
      );

  ButtonStyle _filledStyle() => FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF));

  Future<void> _selectPlan(PlanItem plan, AppState appState) async {
    final terms = _terms(plan);
    setState(() {
      selectedPlan = plan;
      billingTerm = terms.first;
      step = 1;
      preview = null;
    });
    await appState.savePlanChangeDraft(planCode: plan.planCode, planName: plan.name, billingTerm: billingTerm, effectiveMode: effectiveMode, step: 1);
  }

  Future<void> _loadCheckout(AppState appState, {bool quiet = false}) async {
    if (selectedPlan == null) return;
    setState(() => loadingCheckout = true);
    final nextPreview = await appState.previewPlanChange(planCode: selectedPlan!.planCode, effectiveMode: effectiveMode, billingTerm: billingTerm);
    if (!mounted) return;
    setState(() {
      preview = nextPreview;
      loadingCheckout = false;
      if (nextPreview != null) step = 2;
    });
    if (nextPreview != null) {
      await appState.savePlanChangeDraft(planCode: selectedPlan!.planCode, planName: selectedPlan!.name, billingTerm: billingTerm, effectiveMode: effectiveMode, step: 2);
    } else if (!quiet) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(appState.error ?? 'Unable to prepare checkout')));
    }
  }

  Future<void> _confirm(AppState appState) async {
    if (selectedPlan == null) return;
    final request = await appState.requestPlanChange(planCode: selectedPlan!.planCode, effectiveMode: effectiveMode, billingTerm: billingTerm);
    if (!mounted) return;
    final result = appState.lastPlanChangeResult;
    if (result == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(appState.error ?? 'Unable to apply plan change')));
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result.paymentRequired ? 'Pay Rs ${result.payableNow.toStringAsFixed(0)} to complete this change.' : 'Plan change submitted: ${request ?? result.requestNumber}')));
    if (result.paymentRequired && result.payableNow > 0) {
      final paymentOrder = await appState.loadBillingPaymentOrder(amount: result.payableNow);
      if (!mounted || paymentOrder == null) return;
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => BillingPaymentScreen(paymentOrder: paymentOrder)));
    }
    if (mounted) {
      await appState.refresh();
      Navigator.of(context).pop();
    }
  }

  Future<void> _previewPlan(PlanItem plan, AppState appState) async {
    final tempPreview = await appState.previewPlanChange(planCode: plan.planCode, effectiveMode: effectiveMode, billingTerm: 'monthly');
    if (!mounted || tempPreview == null) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        child: _surface(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(plan.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 26, color: Color(0xFF131313))),
            const SizedBox(height: 10),
            _row('Monthly price', 'Rs ${tempPreview.nextPrice.toStringAsFixed(0)}'),
            _row('Available durations', _terms(plan).map(_termLabel).join(' / ')),
            const SizedBox(height: 12),
            SizedBox(width: double.infinity, child: FilledButton(onPressed: () { Navigator.of(context).pop(); _selectPlan(plan, appState); }, style: _filledStyle(), child: const Text('Select this plan'))),
          ]),
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
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok ? 'Plan change checkout cancelled' : (appState.error ?? 'Unable to cancel plan change'))));
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
        return plan.quarterlyPrice > 0 ? plan.quarterlyPrice : plan.monthlyPrice;
      case 'halfYearly':
        return plan.halfYearlyPrice > 0 ? plan.halfYearlyPrice : plan.monthlyPrice;
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
    if (plan.dataLimitGb > 0) return '${plan.dataLimitGb.toStringAsFixed(0)} GB';
    return plan.dataPolicy.toUpperCase();
  }

  bool _isPremium(PlanItem plan) {
    final lower = plan.name.toLowerCase();
    return lower.contains('entertainment') || lower.contains('ott') || lower.contains('combo') || plan.monthlyPrice >= 999 || plan.speedMbps >= 200;
  }

  String _durationHelp(String term) {
    switch (term) {
      case 'quarterly':
        return 'Booking jaisa 3 month commitment with fewer renewals.';
      case 'halfYearly':
        return '6 month duration for a longer uninterrupted billing cycle.';
      case 'yearly':
        return '12 month duration for the longest stable commercial term.';
      default:
        return 'Monthly duration for a flexible short-term cycle.';
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
