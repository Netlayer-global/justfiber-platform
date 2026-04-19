import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../../widgets/pressable_scale.dart';
import '../billing_history_screen.dart';
import '../billing_payment_screen.dart';

class StatsTab extends StatelessWidget {
  const StatsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final hasDue = billing.dueAmount > 0;

    return ListView(
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 28,
        left: 18,
        right: 18,
        bottom: 100,
      ),
      children: [
        // Hero billing card
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF8224E3),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: const Color(0x55A855F7)),
          ),
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status pill + label
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: hasDue
                                ? const Color(0xFFFBBF24)
                                : const Color(0xFF4ADE80),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(hasDue ? 'Payment Due' : 'All Clear',
                            style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Text('BILLING',
                      style: GoogleFonts.inter(
                          color: Colors.white60,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2)),
                ],
              ),
              const SizedBox(height: 18),
              // Icon + title row
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Icon(Icons.receipt_long_rounded,
                        color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Billing',
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.3)),
                      Text(
                          hasDue
                              ? 'Rs ${billing.dueAmount.toStringAsFixed(0)} due'
                              : 'No outstanding dues',
                          style: GoogleFonts.inter(
                              color: Colors.white60, fontSize: 12)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),
              // Stats row
              Row(
                children: [
                  _stat(
                      'Plan',
                      billing.currentPlan.isEmpty
                          ? '—'
                          : billing.currentPlan.split(' ').first),
                  _statDiv(),
                  _stat(
                      'Monthly',
                      billing.recurringAmount > 0
                          ? 'Rs ${billing.recurringAmount.toStringAsFixed(0)}'
                          : '—'),
                  _statDiv(),
                  _stat(
                      'Due',
                      billing.dueAmount > 0
                          ? 'Rs ${billing.dueAmount.toStringAsFixed(0)}'
                          : 'Nil'),
                  _statDiv(),
                  _stat('Cycle',
                      billing.billCycle.isEmpty ? '—' : billing.billCycle),
                ],
              ),
              const SizedBox(height: 18),
              // CTA buttons
              Row(
                children: [
                  if (hasDue) ...[
                    Expanded(
                      flex: 2,
                      child: PressableScale(
                        onTap: () => _payBill(context, appState),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          alignment: Alignment.center,
                          child: Text('Pay Now',
                              style: GoogleFonts.inter(
                                  color: Colors.black,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: PressableScale(
                      onTap: () async {
                        await Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) => const BillingHistoryScreen()));
                        if (context.mounted) await appState.refresh();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2)),
                        ),
                        alignment: Alignment.center,
                        child: Text('History',
                            style: GoogleFonts.inter(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 14)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 22),
        _sectionLabel('PLAN DETAILS'),
        const SizedBox(height: 10),

        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: kBorder),
          ),
          child: Column(
            children: [
              _row('Plan',
                  billing.currentPlan.isEmpty ? '—' : billing.currentPlan),
              _row('Bill Cycle',
                  billing.billCycle.isEmpty ? '—' : billing.billCycle),
              _row('Bill Mode',
                  billing.billMode.isEmpty ? '—' : billing.billMode),
              _row(
                'Monthly',
                billing.recurringAmount > 0
                    ? 'Rs ${billing.recurringAmount.toStringAsFixed(0)}'
                    : '—',
              ),
              _row(
                'Last Payment',
                billing.lastPaymentAmount > 0
                    ? 'Rs ${billing.lastPaymentAmount.toStringAsFixed(0)}'
                    : '—',
                last: true,
              ),
            ],
          ),
        ),

        if (billing.invoices.isNotEmpty) ...[
          const SizedBox(height: 22),
          _sectionLabel('RECENT INVOICES'),
          const SizedBox(height: 10),
          ...billing.invoices.take(4).map((inv) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: kBorder),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: kPrimary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: const Icon(Icons.receipt_long_rounded,
                            color: kPrimaryLight, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              inv.invoiceNumber.isEmpty
                                  ? 'Invoice'
                                  : inv.invoiceNumber,
                              style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                  fontSize: 13),
                            ),
                            Text(
                              inv.generatedAt.isEmpty
                                  ? inv.dueDate
                                  : inv.generatedAt,
                              style: GoogleFonts.inter(
                                  fontSize: 11, color: kMuted),
                            ),
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            'Rs ${inv.totalAmount.toStringAsFixed(0)}',
                            style: GoogleFonts.inter(
                                fontWeight: FontWeight.w800,
                                color: kPrimaryLight,
                                fontSize: 14),
                          ),
                          Text(
                            inv.paymentStatus,
                            style:
                                GoogleFonts.inter(fontSize: 11, color: kMuted),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              )),
        ],
      ],
    );
  }

  Widget _stat(String label, String value) => Expanded(
        child: Column(children: [
          Text(value,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label,
              style: GoogleFonts.inter(
                  color: Colors.white54,
                  fontSize: 10,
                  fontWeight: FontWeight.w500)),
        ]),
      );

  Widget _statDiv() => Container(
      width: 1, height: 24, color: Colors.white.withValues(alpha: 0.18));

  Widget _sectionLabel(String t) => Text(
        t,
        style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: kMuted,
            letterSpacing: 1.6),
      );

  Widget _row(String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: last ? BorderSide.none : const BorderSide(color: kBorder),
        ),
      ),
      child: Row(
        children: [
          Expanded(
              child: Text(label,
                  style: GoogleFonts.inter(fontSize: 13, color: kMuted))),
          Text(value,
              style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.white)),
        ],
      ),
    );
  }

  Future<void> _payBill(BuildContext context, AppState appState) async {
    final order = await appState.loadBillingPaymentOrder();
    if (!context.mounted) return;
    if (order == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(appState.error ?? 'Unable to create payment order')));
      return;
    }
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => BillingPaymentScreen(paymentOrder: order)));
  }
}
