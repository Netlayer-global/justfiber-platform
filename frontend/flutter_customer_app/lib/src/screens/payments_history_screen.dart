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
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
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
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text('No payments found for this filter.'),
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
                      colors: [Color(0xFFFFFFFF), Color(0xFFF7FFFE)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(28),
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
                            child: const Icon(Icons.receipt_long_rounded, color: Color(0xFF39FF14)),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Bill Payment - Broadband',
                                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF70737C)),
                                ),
                                const SizedBox(height: 4),
                                Text(payment.transactionId, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 20)),
                                const SizedBox(height: 4),
                                Text(
                                  payment.paidAt.isEmpty ? payment.provider.toUpperCase() : payment.paidAt,
                                  style: const TextStyle(color: Color(0xFF6D7280)),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            'Rs ${payment.amount.toStringAsFixed(0)}',
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 24),
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
                            onPressed: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => PaymentDetailScreen(payment: payment)),
                            ),
                            child: const Text('View Details'),
                          ),
                          OutlinedButton(
                            onPressed: payment.viewUrl.isEmpty ? null : () => _openDocument(context, appState, payment.transactionId, payment.viewUrl),
                            child: const Text('Open Receipt'),
                          ),
                          FilledButton(
                            onPressed: payment.pdfUrl.isEmpty ? null : () => _openDocument(context, appState, '${payment.transactionId} PDF', payment.pdfUrl),
                            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0B0F19)),
                            child: const Text('View PDF'),
                          ),
                          if (payment.paidAt.isEmpty || payment.reference.toLowerCase().contains('failed'))
                            OutlinedButton(
                              onPressed: () => Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
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
    );
  }

  Widget _filterChip(String value, String label) {
    final selected = statusFilter == value;
    return GestureDetector(
      onTap: () => setState(() => statusFilter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF0B0F19) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: selected ? const Color(0xFF39FF14) : const Color(0xFFE2E4F0)),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: selected ? const Color(0xFF39FF14) : const Color(0xFF40444F),
          ),
        ),
      ),
    );
  }

  Widget _statusBadge(dynamic payment) {
    final pending = payment.paidAt.isEmpty;
    final failed = payment.reference.toLowerCase().contains('failed');
    final label = failed ? 'Failed' : (pending ? 'Pending' : 'Success');
    final color = failed ? const Color(0xFFFEE2E2) : (pending ? const Color(0xFFFEF3C7) : const Color(0xFFDCFCE7));
    final text = failed ? const Color(0xFFB91C1C) : (pending ? const Color(0xFF92400E) : const Color(0xFF166534));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
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
      child: Text(text, style: const TextStyle(color: Color(0xFF39FF14), fontWeight: FontWeight.w600)),
    );
  }

  Future<void> _openDocument(BuildContext context, AppState appState, String title, String relativeUrl) async {
    final session = appState.session;
    if (session == null) return;
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

