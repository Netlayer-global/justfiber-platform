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
  bool _hydratedDraft = false;
  bool _loadingCheckout = false;
  PlanItem? selectedPlan;
  PlanChangePreview? preview;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_hydratedDraft) return;
    _hydratedDraft = true;
    final appState = AppStateScope.of(context);
    final draft = appState.planChangeDraft;
    if (draft == null) return;
    final plan = appState.planChangeOptions.cast<PlanItem?>().firstWhere(
          (item) => item?.planCode == draft.planCode,
          orElse: () => null,
        );
    if (plan == null) return;
    final terms = _terms(plan);
    selectedPlan = plan;
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
              _card(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(step == 0 ? 'PLAN STUDIO' : step == 1 ? 'DURATION STEP' : 'CHECKOUT STEP', style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800, letterSpacing: 2.1, fontSize: 11)),
                  const SizedBox(height: 10),
                  Text(step == 0 ? (billing.currentPlan.isEmpty ? 'Choose your next plan' : 'Current plan: ${billing.currentPlan}') : selectedPlan?.name ?? 'Plan change', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Color(0xFF131313))),
                  const SizedBox(height: 8),
                  Text(
                    step == 0
                        ? 'Recurring: Rs ${billing.recurringAmount.toStringAsFixed(0)} | Due: Rs ${billing.dueAmount.toStringAsFixed(0)}'
                        : step == 1
                            ? 'Pick the commercial duration before checkout.'
                            : 'Review summary, payable amount, and confirm the change.',
                    style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                  ),
                ]),
              ),
              const SizedBox(height: 16),
              if (step == 0) ...[
                _modeSwitcher(),
                const SizedBox(height: 16),
                if (appState.planChangeDraft != null)
                  _card(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Resume saved change', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
                      const SizedBox(height: 8),
                      Text('Saved draft for ${appState.planChangeDraft!.planName}. This draft is hidden everywhere else and resumes only here.', style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4)),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: FilledButton(onPressed: () => setState(() {}), style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)), child: const Text('Resume'))),
                        const SizedBox(width: 12),
                        Expanded(child: OutlinedButton(onPressed: () async => appState.clearPlanChangeDraft(), child: const Text('Discard'))),
                      ]),
                    ]),
                  ),
                if (appState.planChangeDraft != null) const SizedBox(height: 16),
                if (plans.isEmpty)
                  _card(child: const Text('No alternate plans available right now.', style: TextStyle(color: Color(0xFF6E6A67))))
                else
                  ...plans.map((plan) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: _planTile(plan, billing.recurringAmount, appState),
                      )),
              ] else if (step == 1 && selectedPlan != null) ...[
                _card(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Available durations', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: Color(0xFF131313))),
                    const SizedBox(height: 12),
                    ..._terms(selectedPlan!).map((term) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: InkWell(
                            onTap: () => setState(() => billingTerm = term),
                            child: Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: billingTerm == term ? const Color(0xFFF8F4FF) : const Color(0xFFFFFFFF),
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: billingTerm == term ? const Color(0xFF8224E3) : const Color(0x338224E3)),
                              ),
                              child: Row(children: [
                                Expanded(child: Text(_termLabel(term), style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF131313)))),
                                Text('Rs ${_termPrice(selectedPlan!, term).toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF8224E3))),
                              ]),
                            ),
                          ),
                        )),
                  ]),
                ),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: OutlinedButton(onPressed: () => setState(() => step = 0), child: const Text('Change plan'))),
                  const SizedBox(width: 12),
                  Expanded(child: FilledButton(onPressed: _loadingCheckout ? null : () => _loadCheckout(appState), style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)), child: Text(_loadingCheckout ? 'Preparing...' : 'Continue'))),
                ]),
              ] else if (step == 2 && selectedPlan != null) ...[
                _card(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _line('Selected plan', selectedPlan!.name),
                    _line('Duration', _termLabel(billingTerm)),
                    _line('Mode', effectiveMode == 'next_cycle' ? 'Apply next cycle' : 'Apply now'),
                    _line('Commercial price', 'Rs ${_termPrice(selectedPlan!, billingTerm).toStringAsFixed(0)}'),
                  ]),
                ),
                const SizedBox(height: 16),
                _card(
                  child: preview == null
                      ? const Text('Checkout summary is loading.', style: TextStyle(color: Color(0xFF6E6A67)))
                      : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          _line('Current price', 'Rs ${preview!.currentPrice.toStringAsFixed(0)}'),
                          _line('Next price', 'Rs ${preview!.nextPrice.toStringAsFixed(0)}'),
                          _line('Adjustment', 'Rs ${preview!.adjustmentAmount.toStringAsFixed(0)}'),
                          if (preview!.payableNow > 0) _line('Payable now', 'Rs ${preview!.payableNow.toStringAsFixed(0)}'),
                          if (preview!.creditAmount > 0) _line('Credit amount', 'Rs ${preview!.creditAmount.toStringAsFixed(0)}'),
                          const SizedBox(height: 8),
                          Text(preview!.payableNow > 0 ? 'You will need to pay this amount now to complete the change.' : 'No immediate payment is required for this change.', style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4)),
                        ]),
                ),
                const SizedBox(height: 16),
                Row(children: [
                  Expanded(child: OutlinedButton(onPressed: () => setState(() => step = 1), child: const Text('Back'))),
                  const SizedBox(width: 12),
                  Expanded(child: FilledButton(onPressed: appState.busy || preview == null ? null : () => _confirmPlanChange(appState), style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)), child: const Text('Confirm'))),
                ]),
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

  Widget _modeSwitcher() => _card(
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

  Widget _planTile(PlanItem plan, double currentRecurring, AppState appState) => _card(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(plan.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22, color: Color(0xFF131313))),
          const SizedBox(height: 6),
          Text('${plan.speedMbps.toStringAsFixed(0)} Mbps | Rs ${plan.monthlyPrice.toStringAsFixed(0)} / month', style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          _line('Current recurring', currentRecurring > 0 ? 'Rs ${currentRecurring.toStringAsFixed(0)}' : 'Not available'),
          _line('Available durations', _terms(plan).map(_termLabel).join(' / ')),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => _previewPlan(plan, appState), child: const Text('View details'))),
            const SizedBox(width: 12),
            Expanded(child: FilledButton(onPressed: () => _selectPlan(plan, appState), style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)), child: const Text('Select plan'))),
          ]),
        ]),
      );

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: const Color(0x338224E3)),
        ),
        child: child,
      );

  Widget _line(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67))),
          const Spacer(),
          Text(value, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700)),
        ]),
      );

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
    setState(() => _loadingCheckout = true);
    final nextPreview = await appState.previewPlanChange(planCode: selectedPlan!.planCode, effectiveMode: effectiveMode, billingTerm: billingTerm);
    if (!mounted) return;
    setState(() {
      preview = nextPreview;
      _loadingCheckout = false;
      if (nextPreview != null) step = 2;
    });
    if (nextPreview != null) {
      await appState.savePlanChangeDraft(planCode: selectedPlan!.planCode, planName: selectedPlan!.name, billingTerm: billingTerm, effectiveMode: effectiveMode, step: 2);
    } else if (!quiet) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(appState.error ?? 'Unable to prepare checkout')));
    }
  }

  Future<void> _confirmPlanChange(AppState appState) async {
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
        child: _card(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(plan.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 26, color: Color(0xFF131313))),
            const SizedBox(height: 10),
            _line('Monthly price', 'Rs ${tempPreview.nextPrice.toStringAsFixed(0)}'),
            _line('Apply mode', effectiveMode == 'next_cycle' ? 'Next cycle' : 'Switch now'),
            const SizedBox(height: 12),
            SizedBox(width: double.infinity, child: FilledButton(onPressed: () { Navigator.of(context).pop(); _selectPlan(plan, appState); }, style: FilledButton.styleFrom(backgroundColor: const Color(0xFF8224E3), foregroundColor: const Color(0xFFFFFFFF)), child: const Text('Select this plan'))),
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
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Plan change checkout cancelled' : (appState.error ?? 'Unable to cancel plan change'))),
    );
  }

  List<String> _terms(PlanItem plan) {
    final terms = <String>[
      if (plan.validityMonthly) 'monthly',
      if (plan.validityQuarterly) 'quarterly',
      if (plan.validityHalfYearly) 'halfYearly',
      if (plan.validityYearly) 'yearly',
    ];
    return terms.isEmpty ? const ['monthly'] : terms;
  }

  double _termPrice(PlanItem plan, String term) {
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
        return 'Quarterly';
      case 'halfYearly':
        return 'Half yearly';
      case 'yearly':
        return 'Yearly';
      default:
        return 'Monthly';
    }
  }
}
