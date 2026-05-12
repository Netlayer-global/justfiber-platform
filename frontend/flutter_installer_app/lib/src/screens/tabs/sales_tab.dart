import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../sales_booking_screen.dart';

class SalesTab extends StatefulWidget {
  const SalesTab({super.key});

  @override
  State<SalesTab> createState() => _SalesTabState();
}

class _SalesTabState extends State<SalesTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      InstallerStateScope.of(context).refreshSalesLeads();
    });
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final leads = appState.salesLeads;

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimaryLight,
        backgroundColor: kSurface,
        onRefresh: appState.refreshSalesLeads,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Sales',
                              style: GoogleFonts.inter(
                                color: kText,
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.8,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${leads.length} booking${leads.length == 1 ? '' : 's'}',
                              style: GoogleFonts.inter(
                                  color: kMuted, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      FilledButton.icon(
                        onPressed: () => _openBookingFlow(context),
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: Text(
                          'New Booking',
                          style: GoogleFonts.inter(
                              fontSize: 13, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (leads.isEmpty)
              SliverFillRemaining(
                child: _EmptyState(onBook: () => _openBookingFlow(context)),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
                sliver: SliverList.separated(
                  itemCount: leads.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, index) =>
                      _LeadCard(lead: leads[index]),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _openBookingFlow(BuildContext context) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const SalesBookingScreen()),
    );
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onBook});
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
              ),
              child: const Icon(Icons.sell_outlined,
                  color: kPrimaryLight, size: 32),
            ),
            const SizedBox(height: 18),
            Text(
              'No sales bookings yet',
              style: GoogleFonts.inter(
                color: kText,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Create a booking for a customer on their behalf.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.5),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onBook,
              icon: const Icon(Icons.add_rounded, size: 18),
              label: Text(
                'Create Booking',
                style: GoogleFonts.inter(
                    fontSize: 14, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

class _LeadCard extends StatefulWidget {
  const _LeadCard({required this.lead});
  final SalesLead lead;

  @override
  State<_LeadCard> createState() => _LeadCardState();
}

class _LeadCardState extends State<_LeadCard> {
  String? _paymentLink;
  bool _busy = false;

  SalesLead get lead => widget.lead;

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final isCash = lead.paymentMode == 'cash';
    final statusLabel = _statusLabel(lead.status);
    final statusColor = _statusColor(lead.status);
    final isPending = lead.status == 'payment_pending';

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
              Expanded(
                child: Text(
                  lead.customerName,
                  style: GoogleFonts.inter(
                    color: kText,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                ),
                child: Text(
                  statusLabel,
                  style: GoogleFonts.inter(
                    color: statusColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            lead.customerPhone,
            style: GoogleFonts.inter(color: kMuted, fontSize: 13),
          ),
          const SizedBox(height: 10),
          Container(height: 1, color: kDivider),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(child: _InfoItem(label: 'PLAN', value: lead.planName)),
              Expanded(
                child: _InfoItem(
                  label: 'AMOUNT',
                  value: '₹${lead.amount.toStringAsFixed(0)}',
                ),
              ),
              _InfoItem(
                label: 'PAYMENT',
                value: isCash ? 'Cash' : 'Online',
                valueColor: isCash
                    ? const Color(0xFF10B981)
                    : const Color(0xFF0EA5E9),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.tag_rounded, color: kSubtle, size: 12),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  lead.bookingNumber,
                  style: GoogleFonts.inter(
                    color: kSubtle,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: lead.bookingNumber));
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Booking number copied',
                          style: GoogleFonts.inter(fontSize: 13)),
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
                child: const Icon(Icons.copy_rounded, color: kSubtle, size: 14),
              ),
            ],
          ),
          if (isPending) ...[
            const SizedBox(height: 12),
            Container(height: 1, color: kDivider),
            const SizedBox(height: 12),
            if (_paymentLink != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0EA5E9).withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: const Color(0xFF0EA5E9).withValues(alpha: 0.25)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.link_rounded,
                        color: Color(0xFF0EA5E9), size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _paymentLink!,
                        style: GoogleFonts.robotoMono(
                            fontSize: 11, color: Colors.white70),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: _paymentLink!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Payment link copied',
                                style: GoogleFonts.inter(fontSize: 13)),
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      },
                      child: const Icon(Icons.copy_rounded,
                          color: Color(0xFF0EA5E9), size: 16),
                    ),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: () => launchUrl(Uri.parse(_paymentLink!),
                          mode: LaunchMode.externalApplication),
                      child: const Icon(Icons.open_in_new_rounded,
                          color: Color(0xFF0EA5E9), size: 16),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
            ],
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy
                        ? null
                        : () => _generatePaymentLink(appState),
                    icon: _busy
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.link_rounded, size: 16),
                    label: Text(
                      _paymentLink != null ? 'Regenerate Link' : 'Payment Link',
                      style: GoogleFonts.inter(
                          fontSize: 12, fontWeight: FontWeight.w700),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF0EA5E9),
                      side: BorderSide(
                          color: const Color(0xFF0EA5E9).withValues(alpha: 0.4)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Container(height: 1, color: kDivider),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton.icon(
              onPressed: _busy
                  ? null
                  : () => _deleteBooking(appState),
              icon: const Icon(Icons.delete_outline_rounded, size: 16),
              label: Text(
                'Delete',
                style: GoogleFonts.inter(
                    fontSize: 12, fontWeight: FontWeight.w700),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFEF4444),
                side: BorderSide(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(
                    vertical: 10, horizontal: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _generatePaymentLink(InstallerAppState appState) async {
    setState(() => _busy = true);
    final link = await appState.generateSalesPaymentLink(lead.bookingNumber);
    if (!mounted) return;
    if (link != null && link.isNotEmpty) {
      setState(() => _paymentLink = link);
      Clipboard.setData(ClipboardData(text: link));
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment link copied to clipboard',
              style: GoogleFonts.inter(fontSize: 13)),
          duration: const Duration(seconds: 3),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(appState.error ?? 'Failed to generate payment link',
              style: GoogleFonts.inter(fontSize: 13)),
          backgroundColor: const Color(0xFFEF4444),
          duration: const Duration(seconds: 3),
        ),
      );
    }
    setState(() => _busy = false);
  }

  Future<void> _deleteBooking(InstallerAppState appState) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: Text('Delete Booking',
            style: GoogleFonts.inter(
                color: kText, fontSize: 16, fontWeight: FontWeight.w800)),
        content: Text(
          'Delete booking ${lead.bookingNumber} for ${lead.customerName}? This cannot be undone.',
          style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel',
                style: GoogleFonts.inter(color: kMuted, fontSize: 13)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Delete',
                style: GoogleFonts.inter(
                    color: const Color(0xFFEF4444),
                    fontSize: 13,
                    fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    setState(() => _busy = true);
    final ok = await appState.deleteSalesLead(lead.bookingNumber);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(appState.error ?? 'Failed to delete booking',
              style: GoogleFonts.inter(fontSize: 13)),
          backgroundColor: const Color(0xFFEF4444),
          duration: const Duration(seconds: 3),
        ),
      );
      setState(() => _busy = false);
    }
  }

  String _statusLabel(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'Payment Done';
      case 'payment_pending':
        return 'Payment Pending';
      case 'assigned':
        return 'Assigned';
      case 'awaiting_assignment':
        return 'Queued';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.replaceAll('_', ' ');
    }
  }

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'paid':
        return const Color(0xFF10B981);
      case 'payment_pending':
        return const Color(0xFFF59E0B);
      case 'assigned':
      case 'awaiting_assignment':
        return const Color(0xFF0EA5E9);
      case 'completed':
        return const Color(0xFF10B981);
      case 'cancelled':
        return const Color(0xFFEF4444);
      default:
        return kMuted;
    }
  }
}

class _InfoItem extends StatelessWidget {
  const _InfoItem({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            color: kSubtle,
            fontSize: 9,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: GoogleFonts.inter(
            color: valueColor ?? kText,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
