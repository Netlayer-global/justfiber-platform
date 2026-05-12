import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'document_viewer_screen.dart';
import 'payment_detail_screen.dart';
import 'support_history_screen.dart';

class PaymentsHistoryScreen extends StatefulWidget {
  const PaymentsHistoryScreen({super.key});

  @override
  State<PaymentsHistoryScreen> createState() => _PaymentsHistoryScreenState();
}

class _PaymentsHistoryScreenState extends State<PaymentsHistoryScreen> {
  String _filter = 'all';
  /// Cached payments retained on API error (Req 7.4)
  List<BillingPaymentItem> _cachedPayments = const [];
  String? _errorMessage;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final all = billing.payments;

    // Update cache when we have fresh data
    if (all.isNotEmpty) {
      _cachedPayments = all;
      _errorMessage = null;
    }

    // Use cached entries if current data is empty but we had previous data
    final displayAll = all.isNotEmpty ? all : _cachedPayments;

    // Limit to max 50 entries, sorted by date descending (already sorted by API)
    final limited = displayAll.length > 50 ? displayAll.sublist(0, 50) : displayAll;

    final payments = limited.where((p) {
      if (_filter == 'all') return true;
      final hay = '${p.reference} ${p.provider} ${p.transactionId}'.toLowerCase();
      if (_filter == 'success') return p.paidAt.isNotEmpty;
      if (_filter == 'pending') return p.paidAt.isEmpty && !hay.contains('failed');
      if (_filter == 'failed') return hay.contains('failed');
      return true;
    }).toList();

    final successCount = limited.where((p) => p.paidAt.isNotEmpty).length;
    final pendingCount = limited.where((p) => p.paidAt.isEmpty && !p.reference.toLowerCase().contains('failed')).length;
    final failedCount = limited.where((p) => p.reference.toLowerCase().contains('failed')).length;

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: () => _refreshPayments(appState),
        child: CustomScrollView(
          slivers: [
            // ── Gradient header ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Container(
                decoration: const BoxDecoration(
                  color: Color(0xFF8224E3),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(4, 8, 16, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            IconButton(
                              onPressed: () => Navigator.of(context).maybePop(),
                              icon: const Icon(Icons.arrow_back_ios_new_rounded,
                                  color: Colors.white, size: 20),
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                'Payment History',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 0, 0),
                          child: Text(
                            'Track all your broadband payments',
                            style: GoogleFonts.inter(color: Colors.white60, fontSize: 13),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Row(
                            children: [
                              _heroStat('Total', '${limited.length}'),
                              _heroDivider(),
                              _heroStat('Success', '$successCount'),
                              _heroDivider(),
                              _heroStat('Pending', '$pendingCount'),
                              _heroDivider(),
                              _heroStat('Failed', '$failedCount'),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ── Filter chips ─────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                child: Row(
                  children: [
                    _filterChip('all', 'All'),
                    const SizedBox(width: 8),
                    _filterChip('success', 'Success'),
                    const SizedBox(width: 8),
                    _filterChip('pending', 'Pending'),
                    const SizedBox(width: 8),
                    _filterChip('failed', 'Failed'),
                  ],
                ),
              ),
            ),

            // ── Payment list ─────────────────────────────────────────────
            if (_errorMessage != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0x22EF4444),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0x44EF4444)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded,
                            color: Color(0xFFFF8A8A), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: GoogleFonts.inter(
                                color: const Color(0xFFFF8A8A), fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 32),
              sliver: payments.isEmpty
                  ? SliverToBoxAdapter(child: _emptyCard())
                  : SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _PaymentCard(
                            payment: payments[i],
                            onTap: () async {
                              await Navigator.of(context).push(MaterialPageRoute(
                                  builder: (_) => PaymentDetailScreen(payment: payments[i])));
                              if (context.mounted) await appState.refresh();
                            },
                            onOpenReceipt: payments[i].viewUrl.isEmpty
                                ? null
                                : () async {
                                    await _openDocument(context, appState,
                                        payments[i].transactionId, payments[i].viewUrl);
                                    if (context.mounted) await appState.refresh();
                                  },
                            onOpenPdf: payments[i].pdfUrl.isEmpty
                                ? null
                                : () async {
                                    await _openDocument(context, appState,
                                        '${payments[i].transactionId} PDF', payments[i].pdfUrl);
                                    if (context.mounted) await appState.refresh();
                                  },
                            onHelp: () async {
                              await Navigator.of(context).push(MaterialPageRoute(
                                  builder: (_) => const SupportHistoryScreen()));
                              if (context.mounted) await appState.refresh();
                            },
                          ),
                        ),
                        childCount: payments.length,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _refreshPayments(AppState appState) async {
    try {
      await appState.refresh();
      if (mounted) {
        // Check if billing data is empty after refresh (possible API error)
        if (appState.billing.payments.isEmpty && _cachedPayments.isNotEmpty) {
          setState(() {
            _errorMessage = 'Payment history could not be loaded. Showing cached entries.';
          });
        } else {
          setState(() => _errorMessage = null);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Payment history could not be loaded. Showing cached entries.';
        });
      }
    }
  }

  Widget _heroStat(String label, String value) => Expanded(
        child: Column(
          children: [
            Text(value,
                style: GoogleFonts.inter(
                    color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 3),
            Text(label,
                style: GoogleFonts.inter(
                    color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w600)),
          ],
        ),
      );

  Widget _heroDivider() =>
      Container(width: 1, height: 28, color: Colors.white.withValues(alpha: 0.18));

  Widget _filterChip(String value, String label) {
    final selected = _filter == value;
    return Expanded(
      child: PressableScale(
        onTap: () => setState(() => _filter = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? kPrimary.withValues(alpha: 0.18) : kSurface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: selected ? kPrimary.withValues(alpha: 0.5) : kBorder),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected ? kPrimaryLight : kMuted,
            ),
          ),
        ),
      ),
    );
  }

  Widget _emptyCard() => Container(
        margin: const EdgeInsets.only(top: 4),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: kBorder),
        ),
        child: Text(
          'No payments found for this filter.',
          style: GoogleFonts.inter(color: kMuted, height: 1.5),
        ),
      );

  Future<void> _openDocument(BuildContext context, AppState appState,
      String title, String relativeUrl) async {
    final session = appState.session;
    if (session == null) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please login again to open this receipt.')));
      return;
    }
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl = relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => DocumentViewerScreen(
            title: title, url: fullUrl, accessToken: session.accessToken)));
  }
}

class _PaymentCard extends StatelessWidget {
  const _PaymentCard({
    required this.payment,
    required this.onTap,
    required this.onHelp,
    this.onOpenReceipt,
    this.onOpenPdf,
  });

  final BillingPaymentItem payment;
  final VoidCallback onTap;
  final VoidCallback onHelp;
  final VoidCallback? onOpenReceipt;
  final VoidCallback? onOpenPdf;

  @override
  Widget build(BuildContext context) {
    final isPaid = payment.paidAt.isNotEmpty;
    final isFailed = payment.reference.toLowerCase().contains('failed');
    final statusLabel = isFailed ? 'Failed' : (isPaid ? 'Success' : 'Pending');
    final statusColor = isFailed
        ? const Color(0xFFFF8A8A)
        : isPaid
            ? const Color(0xFF4ADE80)
            : const Color(0xFFFBBF24);
    final statusBg = isFailed
        ? const Color(0x22EF4444)
        : isPaid
            ? const Color(0x2222C55E)
            : const Color(0x22F59E0B);
    final iconColor = isFailed
        ? const Color(0xFFFF8A8A)
        : isPaid
            ? const Color(0xFF4ADE80)
            : kPrimaryLight;
    final needsHelp = !isPaid || isFailed;

    return PressableScale(
      onTap: onTap,
      child: Container(
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
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(color: iconColor.withValues(alpha: 0.2)),
                  ),
                  child: Icon(Icons.receipt_long_rounded, color: iconColor, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        payment.transactionId,
                        style: GoogleFonts.inter(
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        isPaid ? payment.paidAt : (payment.provider.isEmpty ? '—' : payment.provider.toUpperCase()),
                        style: GoogleFonts.inter(fontSize: 11, color: kMuted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Rs ${payment.amount.toStringAsFixed(0)}',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                          fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                      ),
                      child: Text(statusLabel,
                          style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: statusColor)),
                    ),
                  ],
                ),
              ],
            ),
            if (payment.provider.isNotEmpty || payment.reference.isNotEmpty || payment.methodLabel.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  _methodBadge(payment.methodLabel),
                  if (payment.provider.isNotEmpty)
                    _infoBadge(payment.provider.toUpperCase()),
                  if (payment.reference.isNotEmpty && !isFailed)
                    _infoBadge(payment.reference),
                ],
              ),
            ],
            // Show notes for cash payments (truncated to 200 chars)
            if (payment.methodLabel == 'Cash' && payment.notes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                payment.truncatedNotes,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: kMuted,
                  height: 1.4,
                ),
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _actionBtn(
                    label: 'Details',
                    icon: Icons.info_outline_rounded,
                    onTap: onTap,
                    filled: false,
                  ),
                ),
                if (onOpenReceipt != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: _actionBtn(
                      label: 'Receipt',
                      icon: Icons.open_in_new_rounded,
                      onTap: onOpenReceipt!,
                      filled: false,
                    ),
                  ),
                ],
                if (onOpenPdf != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: _actionBtn(
                      label: 'PDF',
                      icon: Icons.picture_as_pdf_rounded,
                      onTap: onOpenPdf!,
                      filled: true,
                    ),
                  ),
                ],
                if (needsHelp) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: _actionBtn(
                      label: 'Help',
                      icon: Icons.support_agent_rounded,
                      onTap: onHelp,
                      filled: false,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoBadge(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
        ),
        child: Text(text,
            style: GoogleFonts.inter(
                fontSize: 10, fontWeight: FontWeight.w600, color: kPrimaryLight)),
      );

  Widget _methodBadge(String label) {
    final Color badgeColor;
    final IconData badgeIcon;
    switch (label) {
      case 'UPI':
        badgeColor = const Color(0xFF4ADE80);
        badgeIcon = Icons.account_balance_rounded;
        break;
      case 'Cash':
        badgeColor = const Color(0xFFFBBF24);
        badgeIcon = Icons.payments_rounded;
        break;
      default:
        badgeColor = kPrimaryLight;
        badgeIcon = Icons.language_rounded;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: badgeColor.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: badgeColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(badgeIcon, size: 10, color: badgeColor),
          const SizedBox(width: 4),
          Text(label,
              style: GoogleFonts.inter(
                  fontSize: 10, fontWeight: FontWeight.w700, color: badgeColor)),
        ],
      ),
    );
  }

  Widget _actionBtn({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
    required bool filled,
  }) =>
      PressableScale(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: filled ? kPrimary.withValues(alpha: 0.18) : kSurface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
                color: filled ? kPrimary.withValues(alpha: 0.4) : kBorder),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 13, color: filled ? kPrimaryLight : kMuted),
              const SizedBox(width: 4),
              Text(label,
                  style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: filled ? kPrimaryLight : kMuted)),
            ],
          ),
        ),
      );
}
