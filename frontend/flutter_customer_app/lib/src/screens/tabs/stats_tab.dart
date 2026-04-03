import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../widgets/app_card.dart';
import '../billing_payment_screen.dart';

class StatsTab extends StatelessWidget {
  const StatsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 130),
      children: [
        Text('Billing & Payments', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFFFFFFFF), Color(0xFFF3E8FF)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Total Outstanding', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: const Color(0x998126CF))),
              const SizedBox(height: 10),
              Text(
                'Rs ${billing.dueAmount.toStringAsFixed(0)}',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: const Color(0xFF6B46C1)),
              ),
              const SizedBox(height: 8),
              Text('Due by ${billing.nextBillDate}', style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: () => _payBill(context, appState),
                      child: const Text('Pay Now'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3E8FF),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Text(
                      billing.paymentStatus.toUpperCase(),
                      style: const TextStyle(color: Color(0xFF8126CF), fontWeight: FontWeight.w700, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('Invoice History', style: Theme.of(context).textTheme.titleLarge),
                  const Spacer(),
                  TextButton(onPressed: () {}, child: const Text('View All')),
                ],
              ),
              const SizedBox(height: 10),
              if (billing.invoices.isEmpty)
                const Text('No invoices returned from backend yet.')
              else
                ...billing.invoices.take(5).map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F4FE),
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(item.invoiceNumber.isEmpty ? 'Invoice' : item.invoiceNumber, style: Theme.of(context).textTheme.titleMedium),
                                const SizedBox(height: 4),
                                Text(item.generatedAt.isEmpty ? item.dueDate : item.generatedAt, style: Theme.of(context).textTheme.bodyMedium),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('Rs ${item.totalAmount.toStringAsFixed(0)}', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: const Color(0xFF8126CF))),
                              const SizedBox(height: 4),
                              Text(item.paymentStatus, style: Theme.of(context).textTheme.bodyMedium),
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
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Payment Methods', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F4FE),
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 54,
                      height: 34,
                      decoration: BoxDecoration(
                        color: Colors.black87,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Center(
                        child: Text('VISA', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 10)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('•••• 4242', style: Theme.of(context).textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text('Expires 12/25', style: Theme.of(context).textTheme.bodyMedium),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF3E8FF),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text('Default', style: TextStyle(color: Color(0xFF8126CF), fontWeight: FontWeight.w700, fontSize: 11)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.add_rounded),
                label: const Text('Add Payment Method'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _payBill(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    final paymentOrder = await appState.loadBillingPaymentOrder();
    if (!context.mounted) return;
    if (paymentOrder == null) {
      messenger.showSnackBar(
        SnackBar(content: Text(appState.error ?? 'Unable to create payment order')),
      );
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => BillingPaymentScreen(paymentOrder: paymentOrder)),
    );
  }
}



