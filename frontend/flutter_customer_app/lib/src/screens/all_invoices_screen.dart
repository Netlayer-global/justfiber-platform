import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'document_viewer_screen.dart';

/// Full archive of customer invoices, grouped/filtered by year.
/// Top of the screen has a year-selector chip row. Below is a list of all
/// invoices for that year sorted newest first.
class AllInvoicesScreen extends StatefulWidget {
  const AllInvoicesScreen({super.key});

  @override
  State<AllInvoicesScreen> createState() => _AllInvoicesScreenState();
}

class _AllInvoicesScreenState extends State<AllInvoicesScreen> {
  int? _selectedYear;

  int? _yearOf(BillingInvoiceItem inv) {
    final raw = inv.generatedAt.isNotEmpty ? inv.generatedAt : inv.dueDate;
    if (raw.isEmpty) return null;
    try {
      final dt = DateTime.parse(raw);
      return dt.year;
    } catch (_) {
      // Fallback: try first 4 digits as year
      final m = RegExp(r'(\d{4})').firstMatch(raw);
      if (m != null) return int.tryParse(m.group(1)!);
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final all = appState.billing.invoices;

    // Build sorted year list (descending)
    final years = <int>{};
    for (final inv in all) {
      final y = _yearOf(inv);
      if (y != null) years.add(y);
    }
    final sortedYears = years.toList()..sort((a, b) => b.compareTo(a));
    final activeYear = _selectedYear ??
        (sortedYears.isNotEmpty ? sortedYears.first : DateTime.now().year);

    final filtered = all
        .where((inv) => _yearOf(inv) == activeYear)
        .toList()
      ..sort((a, b) {
        final ad = a.generatedAt.isNotEmpty ? a.generatedAt : a.dueDate;
        final bd = b.generatedAt.isNotEmpty ? b.generatedAt : b.dueDate;
        return bd.compareTo(ad);
      });

    final yearTotal = filtered.fold<double>(
        0, (sum, inv) => sum + inv.totalAmount);
    final paidCount = filtered
        .where((inv) =>
            inv.customerStateLabel.toLowerCase().contains('paid'))
        .length;

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: kBg,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'All Invoices',
          style: GoogleFonts.inter(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 17,
          ),
        ),
      ),
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 8, 18, 36),
          children: [
            // Year filter chips
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  'YEAR',
                  style: GoogleFonts.inter(
                    color: kMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.1,
                  ),
                ),
                const Spacer(),
                Text(
                  '${filtered.length} invoice${filtered.length == 1 ? '' : 's'}',
                  style: GoogleFonts.inter(
                    color: kMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  if (sortedYears.isEmpty)
                    _yearChip(
                      DateTime.now().year,
                      isActive: true,
                      onTap: () {},
                    )
                  else
                    ...sortedYears.map((y) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: _yearChip(
                            y,
                            isActive: y == activeYear,
                            onTap: () =>
                                setState(() => _selectedYear = y),
                          ),
                        )),
                ],
              ),
            ),

            const SizedBox(height: 18),

            // Year summary card
            if (filtered.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1A0645), Color(0xFF6D28D9)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0x55D8B4FE)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Total billed in $activeYear',
                            style: GoogleFonts.inter(
                              color: Colors.white60,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Rs ${yearTotal.toStringAsFixed(0)}',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 1,
                      height: 40,
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Paid',
                          style: GoogleFonts.inter(
                            color: Colors.white60,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$paidCount / ${filtered.length}',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

            if (filtered.isNotEmpty) const SizedBox(height: 18),

            // Invoice list
            if (filtered.isEmpty)
              Container(
                padding: const EdgeInsets.all(40),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: kPrimary.withValues(alpha: 0.1),
                      ),
                      child: const Icon(Icons.receipt_long_rounded,
                          size: 28, color: kPrimaryLight),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      'No invoices for $activeYear',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Try a different year or pull to refresh.',
                      style: GoogleFonts.inter(
                        color: kMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              )
            else
              ...filtered.map((inv) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _InvoiceTile(
                      invoice: inv,
                      onOpen: (inv.pdfUrl.isNotEmpty || inv.viewUrl.isNotEmpty)
                          ? () => _openDocument(
                                context,
                                appState,
                                'Invoice ${inv.invoiceNumber}',
                                inv.pdfUrl.isNotEmpty
                                    ? inv.pdfUrl
                                    : inv.viewUrl,
                              )
                          : null,
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _yearChip(int year,
      {required bool isActive, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
        decoration: BoxDecoration(
          color: isActive ? kPrimary : kSurface2,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isActive ? kPrimary : kBorder,
          ),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: kPrimary.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Text(
          year.toString(),
          style: GoogleFonts.inter(
            color: isActive ? Colors.white : Colors.white70,
            fontSize: 13,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.3,
          ),
        ),
      ),
    );
  }

  Future<void> _openDocument(
    BuildContext context,
    AppState appState,
    String title,
    String relativeUrl,
  ) async {
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

class _InvoiceTile extends StatelessWidget {
  const _InvoiceTile({required this.invoice, this.onOpen});
  final BillingInvoiceItem invoice;
  final VoidCallback? onOpen;

  String _fmtDate(String raw) {
    if (raw.isEmpty) return '—';
    try {
      final dt = DateTime.parse(raw);
      const m = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ];
      return '${m[dt.month - 1]} ${dt.day}, ${dt.year}';
    } catch (_) {
      final t = raw.indexOf('T');
      return t > 0 ? raw.substring(0, t) : raw;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPaid =
        invoice.customerStateLabel.toLowerCase().contains('paid');
    final statusColor =
        isPaid ? const Color(0xFF4ADE80) : const Color(0xFFFBBF24);
    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(16),
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
              child:
                  const Icon(Icons.receipt_long_rounded, color: kPrimaryLight, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    invoice.invoiceNumber.isEmpty
                        ? 'Invoice'
                        : invoice.invoiceNumber,
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Generated ${_fmtDate(invoice.generatedAt)}',
                    style: GoogleFonts.inter(
                      color: kMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Rs ${invoice.totalAmount.toStringAsFixed(0)}',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                        color: statusColor.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    invoice.customerStateLabel.isEmpty
                        ? 'PENDING'
                        : invoice.customerStateLabel.toUpperCase(),
                    style: GoogleFonts.inter(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      color: statusColor,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
