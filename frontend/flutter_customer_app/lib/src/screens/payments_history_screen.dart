import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'document_viewer_screen.dart';
import 'payment_detail_screen.dart';
import 'support_history_screen.dart';

class PaymentsHistoryScreen extends StatefulWidget {
  const PaymentsHistoryScreen({super.key});

  @override
  State<PaymentsHistoryScreen> createState() => _PaymentsHistoryScreenState();
}

class _PaymentsHistoryScreenState extends State<PaymentsHistoryScreen> {
  String statusFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final payments = billing.payments.where((payment) {
      if (statusFilter == 'all') return true;
      final haystack = '${payment.reference} ${payment.provider} ${payment.transactionId}'.toLowerCase();
      if (statusFilter == 'success') return haystack.contains('success') || payment.paidAt.isNotEmpty;
      if (statusFilter == 'failed') return haystack.contains('failed');
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text('Payments', style: Theme.of(context).textTheme.headlineSmall),
      ),
      body: RefreshIndicator(
        color: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFF121212),
        onRefresh: appState.refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
          children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF090D15), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PAYMENT CONSOLE',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFFA1A1AA),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Payment timeline',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: const Color(0xFFEFEEE8), fontSize: 28),
                ),
                const SizedBox(height: 8),
                Text(
                  payments.isEmpty
                      ? 'No payment activity found right now.'
                      : 'Track successful, pending, and failed broadband payments from one place.',
                  style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _heroMetric('Total', '${billing.payments.length}')),
                    const SizedBox(width: 10),
                    Expanded(child: _heroMetric('Success', '${billing.payments.where((p) => p.paidAt.isNotEmpty).length}')),
                    const SizedBox(width: 10),
                    Expanded(child: _heroMetric('Issues', '${billing.payments.where((p) => p.paidAt.isEmpty || p.reference.toLowerCase().contains('failed')).length}')),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _filterChip('all', 'All')),
              const SizedBox(width: 10),
              Expanded(child: _filterChip('success', 'Success')),
              const SizedBox(width: 10),
              Expanded(child: _filterChip('failed', 'Failed')),
            ],
          ),
          const SizedBox(height: 18),
          if (payments.isEmpty)
            const AppCard(
              color: Color(0xFF0C1018),
              borderColor: Color(0x228224E3),
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text('No payments found for this filter.', style: TextStyle(color: Color(0xFFA1A1AA))),
              ),
            )
          else
            ...payments.map(
              (payment) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0B0F19), Color(0xFF111827)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(color: const Color(0x338224E3)),
                    boxShadow: const [
                      BoxShadow(color: Color(0x14030B14), blurRadius: 18, offset: Offset(0, 8)),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFF0B0F19),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF8224E3)),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Bill Payment - Broadband',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFFA1A1AA)),
                                ),
                                const SizedBox(height: 4),
                                Text(payment.transactionId, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 20, color: Color(0xFFEFEEE8))),
                                const SizedBox(height: 4),
                                Text(
                                  payment.paidAt.isEmpty ? payment.provider.toUpperCase() : payment.paidAt,
                                  style: const TextStyle(color: Color(0xFFA1A1AA)),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            'Rs ${payment.amount.toStringAsFixed(0)}',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Color(0xFF8224E3)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          _statusBadge(payment),
                          if (payment.provider.isNotEmpty) _infoBadge(payment.provider.toUpperCase()),
                          if (payment.reference.isNotEmpty) _infoBadge(payment.reference),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          TextButton(
                            onPressed: () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => PaymentDetailScreen(payment: payment)),
                              );
                              if (context.mounted) {
                                await appState.refresh();
                              }
                            },
                            style: TextButton.styleFrom(
                              foregroundColor: const Color(0xFF8224E3),
                            ),
                            child: const Text('View Details'),
                          ),
                          OutlinedButton(
                            onPressed: payment.viewUrl.isEmpty
                                ? null
                                : () async {
                                    await _openDocument(context, appState, payment.transactionId, payment.viewUrl);
                                    if (context.mounted) {
                                      await appState.refresh();
                                    }
                                  },
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF8224E3),
                              backgroundColor: const Color(0xFF111827),
                              side: const BorderSide(color: Color(0x668224E3)),
                            ),
                            child: const Text('Open Receipt'),
                          ),
                          FilledButton(
                            onPressed: payment.pdfUrl.isEmpty
                                ? null
                                : () async {
                                    await _openDocument(context, appState, '${payment.transactionId} PDF', payment.pdfUrl);
                                    if (context.mounted) {
                                      await appState.refresh();
                                    }
                                  },
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF8224E3),
                              foregroundColor: const Color(0xFFEFEEE8),
                            ),
                            child: const Text('View PDF'),
                          ),
                          if (payment.paidAt.isEmpty || payment.reference.toLowerCase().contains('failed'))
                            OutlinedButton(
                              onPressed: () async {
                                await Navigator.of(context).push(
                                  MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
                                );
                                if (context.mounted) {
                                  await appState.refresh();
                                }
                              },
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFFEFEEE8),
                                backgroundColor: const Color(0xFF10151A),
                                side: const BorderSide(color: Color(0x338224E3)),
                              ),
                              child: const Text('Need Help'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _filterChip(String value, String label) {
    final selected = statusFilter == value;
    return GestureDetector(
      onTap: () => setState(() => statusFilter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF0B0F19) : const Color(0xFF111827),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: selected ? const Color(0xFF8224E3) : const Color(0x338224E3)),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: selected ? const Color(0xFF8224E3) : const Color(0xFFCBD5E1),
          ),
        ),
      ),
    );
  }

  Widget _heroMetric(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF101722),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x338224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(color: const Color(0xFFEFEEE8), fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }

  Widget _statusBadge(dynamic payment) {
    final pending = payment.paidAt.isEmpty;
    final failed = payment.reference.toLowerCase().contains('failed');
    final label = failed ? 'Failed' : (pending ? 'Pending' : 'Success');
    final color = failed ? const Color(0xFF2A1114) : (pending ? const Color(0xFF2A2310) : const Color(0xFF122315));
    final text = failed ? const Color(0xFFFF8A80) : (pending ? const Color(0xFFFACC15) : const Color(0xFF8224E3));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: text.withOpacity(0.28)),
      ),
      child: Text(label, style: TextStyle(color: text, fontWeight: FontWeight.w700)),
    );
  }

  Widget _infoBadge(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF0B0F19),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(text, style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w600)),
    );
  }

  Future<void> _openDocument(BuildContext context, AppState appState, String title, String relativeUrl) async {
    final session = appState.session;
    if (session == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please login again to open this receipt.')),
        );
      }
      return;
    }
    final baseUrl = appState.api.baseUrl.replaceAll(RegExp(r'/$'), '');
    final fullUrl = relativeUrl.startsWith('http') ? relativeUrl : '$baseUrl$relativeUrl';
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => DocumentViewerScreen(
          title: title,
          url: fullUrl,
          accessToken: session.accessToken,
        ),
      ),
    );
  }
}

