import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shimmer/shimmer.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'billing_payment_screen.dart';
import 'document_viewer_screen.dart';
import 'all_invoices_screen.dart';
import 'payments_history_screen.dart';
import 'support_history_screen.dart';

class BillingHistoryScreen extends StatelessWidget {
  const BillingHistoryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;

    final latestInvoice =
        billing.invoices.isEmpty ? null : billing.invoices.first;
    final latestPayment =
        billing.payments.isEmpty ? null : billing.payments.first;
    final recurringAmt = billing.recurringAmount > 0
        ? billing.recurringAmount
        : (billing.dueAmount > 0
            ? billing.dueAmount
            : billing.lastPaymentAmount);
    final hasDue = billing.dueAmount > 0;
    final hasAlert = billing.lastSuspensionWarningAt.isNotEmpty ||
        billing.lastOverdueReminderAt.isNotEmpty;

    final isFirstLoad =
        appState.busy && billing.currentPlan.isEmpty && billing.invoices.isEmpty;

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refresh,
        child: isFirstLoad
            ? const _BillingShimmer()
            : CustomScrollView(
          slivers: [
            // ── Gradient header ──────────────────────────────────────
            SliverToBoxAdapter(
              child: _BillingHeader(
                billing: billing,
                hasDue: hasDue,
                hasAlert: hasAlert,
                onPayNow: !hasDue || appState.busy
                    ? null
                    : () => _payNow(context, appState),
                onHistory: () => Navigator.of(context).push(
                  MaterialPageRoute(
                      builder: (_) => const PaymentsHistoryScreen()),
                ),
              ),
            ),

            // ── Bill Summary ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('BILL SUMMARY'),
                    const SizedBox(height: 8),
                    _card(
                      child: Column(
                        children: [
                          _row('Plan',
                              billing.currentPlan.isEmpty
                                  ? '—'
                                  : billing.currentPlan),
                          _row(
                              'Monthly',
                              recurringAmt > 0
                                  ? 'Rs ${recurringAmt.toStringAsFixed(0)}'
                                  : '—'),
                          _row('Bill Cycle',
                              billing.billCycle.isEmpty
                                  ? '—'
                                  : billing.billCycle),
                          _row('Bill Mode',
                              billing.billMode.isEmpty
                                  ? '—'
                                  : billing.billMode),
                          _row(
                              'Generated',
                              billing.generatedDate.isEmpty
                                  ? '—'
                                  : _fmtDate(billing.generatedDate)),
                          // Due Date appears only after a bill has been generated
                          if (latestInvoice != null)
                            _row(
                                'Due Date',
                                latestInvoice.dueDate.isNotEmpty
                                    ? _fmtDate(latestInvoice.dueDate)
                                    : (billing.nextBillDate.isEmpty
                                        ? '—'
                                        : _fmtDate(billing.nextBillDate))),
                          _row(
                              'Last Payment',
                              billing.lastPaymentAmount > 0
                                  ? 'Rs ${billing.lastPaymentAmount.toStringAsFixed(0)}'
                                  : '—'),
                          _row(
                              'Last Paid On',
                              billing.lastPaymentDate.isEmpty
                                  ? '—'
                                  : _fmtDate(billing.lastPaymentDate),
                              last: true),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // ── Data Usage (FUP) ─────────────────────────────
                    if (billing.usageCapGb > 0) ...[
                      _sectionLabel('DATA USAGE'),
                      const SizedBox(height: 8),
                      _UsageCard(
                        usedGb: billing.usageGb,
                        capGb: billing.usageCapGb,
                        capReached: billing.usageCapReached,
                        cycleStartedAt: billing.usageCycleStartedAt,
                        fupSpeedMbps: billing.fupSpeedMbps,
                      ),
                      const SizedBox(height: 20),
                    ],

                    // ── Latest Invoice Receipt ───────────────────────
                    _sectionLabel('LATEST INVOICE'),
                    const SizedBox(height: 8),
                    if (latestInvoice == null)
                      _card(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Text(
                            'No invoice generated yet.',
                            style:
                                GoogleFonts.inter(color: kMuted, fontSize: 13),
                          ),
                        ),
                      )
                    else
                      _ReceiptCard(
                        invoice: latestInvoice,
                        onOpen: (latestInvoice.pdfUrl.isNotEmpty ||
                                latestInvoice.viewUrl.isNotEmpty)
                            ? () => _openDocument(
                                  context,
                                  appState,
                                  'Invoice ${latestInvoice.invoiceNumber}',
                                  latestInvoice.pdfUrl.isNotEmpty
                                      ? latestInvoice.pdfUrl
                                      : latestInvoice.viewUrl,
                                )
                            : null,
                      ),

                    const SizedBox(height: 20),

                    // ── Latest Payment ───────────────────────────────
                    _sectionLabel('LATEST PAYMENT'),
                    const SizedBox(height: 8),
                    if (latestPayment == null)
                      _card(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Text(
                            'No payment recorded yet.',
                            style:
                                GoogleFonts.inter(color: kMuted, fontSize: 13),
                          ),
                        ),
                      )
                    else
                      _PaymentReceiptCard(
                        payment: latestPayment,
                        onOpen: (latestPayment.pdfUrl.isNotEmpty ||
                                latestPayment.viewUrl.isNotEmpty)
                            ? () => _openDocument(
                                  context,
                                  appState,
                                  'Receipt',
                                  latestPayment.pdfUrl.isNotEmpty
                                      ? latestPayment.pdfUrl
                                      : latestPayment.viewUrl,
                                )
                            : null,
                      ),

                    const SizedBox(height: 20),

                    // ── Show All Invoices (year-filtered archive) ────
                    if (billing.invoices.length > 1) ...[
                      _ShowAllInvoicesCard(
                        count: billing.invoices.length,
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => const AllInvoicesScreen()),
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    // ── More Options ─────────────────────────────────
                    _sectionLabel('MORE'),
                    const SizedBox(height: 8),
                    _card(
                      child: Column(
                        children: [
                          _linkRow(
                            icon: Icons.receipt_long_rounded,
                            label: 'Payment History',
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) =>
                                      const PaymentsHistoryScreen()),
                            ),
                          ),
                          const Divider(color: kBorder, height: 1),
                          _linkRow(
                            icon: Icons.headset_mic_rounded,
                            label: 'Billing Support',
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) =>
                                      const SupportHistoryScreen()),
                            ),
                            last: true,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 100),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  Widget _sectionLabel(String text) => Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: kMuted,
          letterSpacing: 1.6,
        ),
      );

  Widget _card({required Widget child}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorder),
        ),
        child: child,
      );

  Widget _row(String label, String value, {bool last = false}) => Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 13),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 116,
                  child: Text(label,
                      style: GoogleFonts.inter(
                          fontSize: 13,
                          color: kMuted,
                          fontWeight: FontWeight.w500)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    value,
                    textAlign: TextAlign.right,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white),
                  ),
                ),
              ],
            ),
          ),
          if (!last) const Divider(color: kBorder, height: 1),
        ],
      );

  Widget _linkRow({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool last = false,
  }) =>
      PressableScale(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 15),
          child: Row(
            children: [
              Icon(icon, size: 18, color: kPrimaryLight),
              const SizedBox(width: 12),
              Text(label,
                  style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.white)),
              const Spacer(),
              const Icon(Icons.chevron_right_rounded,
                  color: Color(0xFF3D3D5C), size: 20),
            ],
          ),
        ),
      );

  // ─── Actions ──────────────────────────────────────────────────────────────

  Future<void> _payNow(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    if (appState.session == null) {
      messenger.showSnackBar(
          const SnackBar(content: Text('Please login again to continue.')));
      return;
    }
    final order = await appState.loadBillingPaymentOrder(
        amount: appState.billing.dueAmount);
    if (!context.mounted) return;
    if (order == null) {
      messenger.showSnackBar(SnackBar(
        content: Text(appState.error ?? 'Unable to create payment order'),
      ));
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute(
          builder: (_) => BillingPaymentScreen(paymentOrder: order)),
    );
    await appState.refresh();
  }

  Future<void> _openDocument(BuildContext context, AppState appState,
      String title, String relativeUrl) async {
    final session = appState.session;
    if (session == null) return;
    final base = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl =
        relativeUrl.startsWith('http') ? relativeUrl : '$base$relativeUrl';
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => DocumentViewerScreen(
        title: title,
        url: fullUrl,
        accessToken: session.accessToken,
      ),
    ));
  }
}

// ── Billing shimmer skeleton ──────────────────────────────────────────────────

class _BillingShimmer extends StatelessWidget {
  const _BillingShimmer();

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFF1A1828),
      highlightColor: const Color(0xFF2D2B3D),
      child: ListView(
        padding: EdgeInsets.fromLTRB(
            18, MediaQuery.of(context).padding.top + 18, 18, 40),
        physics: const NeverScrollableScrollPhysics(),
        children: [
          // Header card
          Container(
            height: 200,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
            ),
          ),
          const SizedBox(height: 28),
          // Section label
          Container(
            width: 100,
            height: 10,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 12),
          // Summary card
          Container(
            height: 240,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          const SizedBox(height: 24),
          Container(
            width: 100,
            height: 10,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 12),
          // Receipt card
          Container(
            height: 180,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Billing gradient header ───────────────────────────────────────────────────

class _BillingHeader extends StatelessWidget {
  const _BillingHeader({
    required this.billing,
    required this.hasDue,
    required this.hasAlert,
    required this.onPayNow,
    required this.onHistory,
  });

  final BillingData billing;
  final bool hasDue;
  final bool hasAlert;
  final VoidCallback? onPayNow;
  final VoidCallback onHistory;

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.of(context).padding.top;
    return Padding(
      padding: EdgeInsets.fromLTRB(18, topPad + 16, 18, 20),
      child: Column(
        children: [
          // ── Main due card ──────────────────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: const Color(0xFF8224E3),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: const Color(0x55A855F7)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status pill row
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
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
                          Text(
                            hasDue ? 'Payment Due' : 'All Clear',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'BILLING',
                      style: GoogleFonts.inter(
                        color: Colors.white60,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // Amount + subtitle
                Text(
                  hasDue
                      ? 'Rs ${billing.dueAmount.toStringAsFixed(0)}'
                      : billing.currentPlan.isEmpty ? 'All Clear' : billing.currentPlan,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: hasDue ? 48 : 32,
                    fontWeight: FontWeight.w900,
                    letterSpacing: hasDue ? -2 : -0.5,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  billing.nextBillDate.isEmpty
                      ? 'No outstanding dues'
                      : (hasDue
                          ? 'Due by ${_fmtDate(billing.nextBillDate)}'
                          : 'Next bill ${_fmtDate(billing.nextBillDate)}'),
                  style: GoogleFonts.inter(
                    color: Colors.white60,
                    fontSize: 13,
                  ),
                ),
                if (!hasDue && billing.recurringAmount > 0) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Rs ${billing.recurringAmount.toStringAsFixed(0)}/mo · ${billing.billMode}',
                    style: GoogleFonts.inter(
                      color: Colors.white54,
                      fontSize: 12,
                    ),
                  ),
                ],

                const SizedBox(height: 20),

                // Buttons
                Row(
                  children: [
                    if (hasDue) ...[
                      Expanded(
                        child: _GradientBtn(
                          label: 'Pay Now',
                          onTap: onPayNow,
                          filled: true,
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child: _GradientBtn(
                        label: 'History',
                        onTap: onHistory,
                        filled: false,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ── Alert banner ───────────────────────────────────────────
          if (hasAlert) ...[
            const SizedBox(height: 12),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              decoration: BoxDecoration(
                color: const Color(0xFF2A0A0A),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: const Color(0x55FF6B6B)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      color: Color(0xFFFF6B6B), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      billing.lastSuspensionWarningAt.isNotEmpty
                          ? 'Suspension warning — clear dues immediately to avoid disconnection.'
                          : 'Overdue reminder — please pay to keep service active.',
                      style: GoogleFonts.inter(
                        color: const Color(0xFFFF8A8A),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _GradientBtn extends StatefulWidget {
  const _GradientBtn({
    required this.label,
    required this.onTap,
    required this.filled,
  });

  final String label;
  final VoidCallback? onTap;
  final bool filled;

  @override
  State<_GradientBtn> createState() => _GradientBtnState();
}

class _GradientBtnState extends State<_GradientBtn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 90));
    _scale = Tween<double>(begin: 1.0, end: 0.96)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.onTap != null ? (_) => _ctrl.forward() : null,
      onTapUp: (_) => _ctrl.reverse(),
      onTapCancel: () => _ctrl.reverse(),
      onTap: widget.onTap,
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            color: widget.filled ? Colors.white : Colors.white.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
            border: widget.filled
                ? null
                : Border.all(color: Colors.white.withValues(alpha: 0.3)),
          ),
          child: Center(
            child: Text(
              widget.label,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: widget.filled
                    ? (widget.onTap == null
                        ? Colors.white54
                        : const Color(0xFF3B0D7A))
                    : Colors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Receipt-style invoice card ────────────────────────────────────────────────

class _ReceiptCard extends StatelessWidget {
  const _ReceiptCard({required this.invoice, this.onOpen});

  final BillingInvoiceItem invoice;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final isPaid =
        invoice.customerStateLabel.toLowerCase().contains('paid');
    final statusColor =
        isPaid ? const Color(0xFF4ADE80) : const Color(0xFFFBBF24);
    final statusBg = isPaid
        ? const Color(0xFF0A2A14)
        : const Color(0xFF1F1500);

    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          // ── Receipt header ───────────────────────────────────────
          Container(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  kPrimary.withValues(alpha: 0.12),
                  kPrimary.withValues(alpha: 0.04),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(23)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: kPrimary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(13),
                    border:
                        Border.all(color: kPrimary.withValues(alpha: 0.25)),
                  ),
                  child: const Icon(Icons.receipt_rounded,
                      color: kPrimaryLight, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Invoice',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: kMuted,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        invoice.invoiceNumber.isEmpty
                            ? '—'
                            : invoice.invoiceNumber,
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
                // Status stamp
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: statusBg,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                        color: statusColor.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    invoice.customerStateLabel.isEmpty
                        ? 'PENDING'
                        : invoice.customerStateLabel.toUpperCase(),
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: statusColor,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Perforated divider ───────────────────────────────────
          const _PerforatedDivider(color: kBorder),

          // ── Receipt body ─────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Column(
              children: [
                _receiptRow('Amount',
                    'Rs ${invoice.totalAmount.toStringAsFixed(0)}',
                    large: true),
                const SizedBox(height: 10),
                _receiptRow('Due Date',
                    invoice.dueDate.isEmpty ? '—' : _fmtDate(invoice.dueDate)),
                const SizedBox(height: 6),
                _receiptRow('Invoice No.',
                    invoice.invoiceNumber.isEmpty ? '—' : invoice.invoiceNumber,
                    mono: true),
              ],
            ),
          ),

          // ── Open button ──────────────────────────────────────────
          if (onOpen != null) ...[
            const SizedBox(height: 14),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
              child: _OpenInvoiceBtn(onTap: onOpen!),
            ),
          ] else
            const SizedBox(height: 18),
        ],
      ),
    );
  }

  Widget _receiptRow(String label, String value,
      {bool large = false, bool mono = false}) {
    return Row(
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
              fontSize: 12, color: kMuted, fontWeight: FontWeight.w500),
        ),
        const Spacer(),
        Text(
          value,
          style: mono
              ? GoogleFonts.robotoMono(
                  fontSize: 12,
                  color: Colors.white70,
                  fontWeight: FontWeight.w500)
              : GoogleFonts.inter(
                  fontSize: large ? 18 : 13,
                  fontWeight: large ? FontWeight.w900 : FontWeight.w600,
                  color: Colors.white,
                  letterSpacing: large ? -0.5 : 0),
        ),
      ],
    );
  }
}

// ── Payment receipt card ──────────────────────────────────────────────────────

class _PaymentReceiptCard extends StatelessWidget {
  const _PaymentReceiptCard({required this.payment, this.onOpen});
  final BillingPaymentItem payment;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  const Color(0xFF4ADE80).withValues(alpha: 0.08),
                  const Color(0xFF4ADE80).withValues(alpha: 0.02),
                ],
              ),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(23)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFF4ADE80).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(
                        color: const Color(0xFF4ADE80).withValues(alpha: 0.2)),
                  ),
                  child: const Icon(Icons.check_circle_rounded,
                      color: Color(0xFF4ADE80), size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Payment',
                          style: GoogleFonts.inter(
                              fontSize: 11,
                              color: kMuted,
                              fontWeight: FontWeight.w500)),
                      Text(
                        'Rs ${payment.amount.toStringAsFixed(0)}',
                        style: GoogleFonts.inter(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0A2A14),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                        color: const Color(0xFF4ADE80).withValues(alpha: 0.35)),
                  ),
                  child: Text(
                    'PAID',
                    style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF4ADE80),
                        letterSpacing: 0.8),
                  ),
                ),
              ],
            ),
          ),

          const _PerforatedDivider(color: kBorder),

          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
            child: Column(
              children: [
                _row2('Method',
                    payment.provider.isEmpty
                        ? '—'
                        : payment.provider.toUpperCase()),
                const SizedBox(height: 8),
                _row2(
                    'Date',
                    payment.paidAt.isEmpty
                        ? 'Pending'
                        : _fmtDate(payment.paidAt)),
                const SizedBox(height: 6),
                _row2('Transaction ID',
                    payment.transactionId.isEmpty ? '—' : payment.transactionId,
                    mono: true),
                if (onOpen != null) ...[
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: onOpen,
                      icon: const Icon(Icons.receipt_long_rounded, size: 16),
                      label: const Text('View Receipt'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF4ADE80),
                        side: BorderSide(
                            color: const Color(0xFF4ADE80).withValues(alpha: 0.4)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row2(String label, String value, {bool mono = false}) {
    return Row(
      children: [
        Text(label,
            style: GoogleFonts.inter(
                fontSize: 12, color: kMuted, fontWeight: FontWeight.w500)),
        const Spacer(),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: mono
                ? GoogleFonts.robotoMono(
                    fontSize: 11,
                    color: Colors.white70,
                    fontWeight: FontWeight.w500)
                : GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Colors.white),
          ),
        ),
      ],
    );
  }
}

// ── Show all invoices link card ──────────────────────────────────────────────

class _ShowAllInvoicesCard extends StatelessWidget {
  const _ShowAllInvoicesCard({required this.count, required this.onTap});
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kPrimary.withValues(alpha: 0.25)),
              ),
              child: const Icon(Icons.history_rounded,
                  color: kPrimaryLight, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Show All Invoices',
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Browse $count past invoices, filter by year',
                    style: GoogleFonts.inter(
                      color: kMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded,
                color: Colors.white38, size: 20),
          ],
        ),
      ),
    );
  }
}


// ── Open invoice button ───────────────────────────────────────────────────────

class _OpenInvoiceBtn extends StatefulWidget {
  const _OpenInvoiceBtn({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_OpenInvoiceBtn> createState() => _OpenInvoiceBtnState();
}

class _OpenInvoiceBtnState extends State<_OpenInvoiceBtn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 90));
    _scale = Tween<double>(begin: 1.0, end: 0.96)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) => _ctrl.reverse(),
      onTapCancel: () => _ctrl.reverse(),
      onTap: widget.onTap,
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: kPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(14),
            border:
                Border.all(color: kPrimary.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.open_in_new_rounded,
                  color: kPrimaryLight, size: 15),
              const SizedBox(width: 7),
              Text(
                'Open Invoice',
                style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: kPrimaryLight),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Perforated divider ────────────────────────────────────────────────────────

class _PerforatedDivider extends StatelessWidget {
  const _PerforatedDivider({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(double.infinity, 24),
      painter: _DashedLinePainter(color: color),
    );
  }
}

class _DashedLinePainter extends CustomPainter {
  const _DashedLinePainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1;

    // Semicircle cutouts at edges
    final circlePaint = Paint()
      ..color = kBg
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(0, size.height / 2), 10, circlePaint);
    canvas.drawCircle(Offset(size.width, size.height / 2), 10, circlePaint);

    // Dashed line
    const dashWidth = 6.0;
    const dashGap = 5.0;
    double x = 14;
    final y = size.height / 2;
    while (x < size.width - 14) {
      canvas.drawLine(Offset(x, y), Offset(x + dashWidth, y), paint);
      x += dashWidth + dashGap;
    }
  }

  @override
  bool shouldRepaint(covariant _DashedLinePainter oldDelegate) =>
      oldDelegate.color != color;
}

// ── Date formatter ─────────────────────────────────────────────────────────────

String _fmtDate(String raw) {
  try {
    final dt = DateTime.parse(raw);
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${m[dt.month - 1]} ${dt.day}, ${dt.year}';
  } catch (_) {
    final t = raw.indexOf('T');
    return t > 0 ? raw.substring(0, t) : raw;
  }
}

// ── Data Usage card (FUP) ────────────────────────────────────────────────────

class _UsageCard extends StatelessWidget {
  const _UsageCard({
    required this.usedGb,
    required this.capGb,
    required this.capReached,
    required this.cycleStartedAt,
    required this.fupSpeedMbps,
  });

  final double usedGb;
  final double capGb;
  final bool capReached;
  final String cycleStartedAt;
  final double fupSpeedMbps;

  @override
  Widget build(BuildContext context) {
    final ratio = capGb <= 0 ? 0.0 : (usedGb / capGb).clamp(0.0, 1.0);
    final pct = (ratio * 100).round();
    final remaining = (capGb - usedGb).clamp(0.0, capGb);

    Color barColor;
    if (capReached || ratio >= 1.0) {
      barColor = const Color(0xFFEF4444);
    } else if (ratio >= 0.85) {
      barColor = const Color(0xFFFBBF24);
    } else {
      barColor = const Color(0xFF34D399);
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: barColor.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  capReached
                      ? Icons.warning_amber_rounded
                      : Icons.data_usage_rounded,
                  color: barColor,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${usedGb.toStringAsFixed(1)} GB used of ${capGb.toStringAsFixed(0)} GB',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      capReached
                          ? 'FUP limit reached — speeds throttled'
                          : '${remaining.toStringAsFixed(1)} GB remaining ($pct% used)',
                      style: GoogleFonts.inter(
                          color: capReached ? barColor : kMuted,
                          fontSize: 12,
                          fontWeight: capReached
                              ? FontWeight.w700
                              : FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: Stack(
              children: [
                Container(
                  height: 8,
                  color: Colors.white.withValues(alpha: 0.06),
                ),
                FractionallySizedBox(
                  widthFactor: ratio == 0 ? 0.02 : ratio,
                  child: Container(
                    height: 8,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          barColor.withValues(alpha: 0.8),
                          barColor,
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              if (cycleStartedAt.isNotEmpty)
                _usagePill(
                  Icons.event_rounded,
                  'Cycle from ${_fmtDate(cycleStartedAt)}',
                ),
              if (fupSpeedMbps > 0 && capReached)
                _usagePill(
                  Icons.speed_rounded,
                  'Post-FUP: ${fupSpeedMbps.toStringAsFixed(0)} Mbps',
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _usagePill(IconData icon, String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: kBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: kMuted, size: 12),
            const SizedBox(width: 5),
            Text(text,
                style: GoogleFonts.inter(
                    color: kMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600)),
          ],
        ),
      );
}
