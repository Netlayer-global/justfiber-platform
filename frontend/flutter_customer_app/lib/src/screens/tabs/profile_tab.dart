import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  String? selectedPlanCode;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final billing = appState.billing;
    final dashboard = appState.dashboard;
    final planOptions = appState.planChangeOptions;
    selectedPlanCode ??= planOptions.firstOrNull?.planCode;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Text('Profile', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFFD81F26), Color(0xFFFF7A1A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Account detail', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
              const SizedBox(height: 12),
              _heroRow('Customer', dashboard.customerName),
              _heroRow('Current plan', billing.currentPlan),
              _heroRow('Status', billing.paymentStatus),
              _heroRow('Due date', billing.nextBillDate),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Billing', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              _row('Latest bill', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
              _row(
                'Previous bill',
                billing.invoices.length > 1 ? 'Rs ${billing.invoices[1].totalAmount.toStringAsFixed(0)}' : '-',
              ),
              _row('Last payment', 'Rs ${billing.lastPaymentAmount.toStringAsFixed(0)}'),
              _row('Payment status', billing.paymentStatus),
              _row('Bill cycle', billing.billCycle),
              _row('Generated date', billing.generatedDate.isEmpty ? '-' : billing.generatedDate),
              _row('Last paid on', billing.lastPaymentDate.isEmpty ? '-' : billing.lastPaymentDate),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Recent payments', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...(billing.payments.isEmpty
                  ? [const Text('No payment history yet.', style: TextStyle(color: Color(0xFF7B625A)))]
                  : billing.payments.take(5).map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Rs ${item.amount.toStringAsFixed(0)}',
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${item.provider.toUpperCase()}  ${item.paidAt}',
                                    style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            Flexible(
                              child: Text(
                                item.reference.isEmpty ? item.transactionId : item.reference,
                                textAlign: TextAlign.right,
                                style: const TextStyle(color: Color(0xFFD81F26), fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                      ),
                    )),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Recent invoices', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...(billing.invoices.isEmpty
                  ? [const Text('No invoices available yet.', style: TextStyle(color: Color(0xFF7B625A)))]
                  : billing.invoices.take(5).map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.invoiceNumber.isEmpty ? 'Invoice' : item.invoiceNumber,
                                    style: const TextStyle(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Generated ${item.generatedAt.isEmpty ? '-' : item.generatedAt}',
                                    style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  'Rs ${item.totalAmount.toStringAsFixed(0)}',
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  item.paymentStatus,
                                  style: const TextStyle(color: Color(0xFFD81F26), fontSize: 12),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    )),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Plan change', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              if (planOptions.isEmpty)
                const Text('No alternate plans available right now.')
              else ...[
                DropdownButtonFormField<String>(
                  value: selectedPlanCode,
                  items: planOptions
                      .map(
                        (plan) => DropdownMenuItem(
                          value: plan.planCode,
                          child: Text('${plan.name} - ${plan.speedMbps.toStringAsFixed(0)} Mbps'),
                        ),
                      )
                      .toList(),
                  onChanged: (value) => setState(() => selectedPlanCode = value),
                  decoration: const InputDecoration(labelText: 'Choose new plan'),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy || selectedPlanCode == null
                        ? null
                        : () async {
                            final requestNumber = await appState.requestPlanChange(
                              planCode: selectedPlanCode!,
                              effectiveMode: 'next_cycle',
                            );
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  requestNumber != null && requestNumber.isNotEmpty
                                      ? 'Plan change requested: $requestNumber'
                                      : (appState.error ?? 'Plan change failed'),
                                ),
                              ),
                            );
                          },
                    child: const Text('Request plan change'),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Requests', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              ...(appState.requests.isEmpty
                  ? [const Text('No recent requests.', style: TextStyle(color: Color(0xFF7B625A)))]
                  : appState.requests.take(5).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 4),
                                  Text(item.createdAt, style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12)),
                                ],
                              ),
                            ),
                            Text(item.status, style: const TextStyle(color: Color(0xFFD81F26))),
                          ],
                        ),
                      ))),
            ],
          ),
        ),
        const SizedBox(height: 18),
        FilledButton.tonal(
          onPressed: appState.logout,
          child: const Text('Logout'),
        ),
        if ((appState.error ?? '').isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(appState.error!, style: const TextStyle(color: Color(0xFFD81F26))),
        ],
      ],
    );
  }

  Widget _heroRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Colors.white70)),
          const Spacer(),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF7B625A))),
          const Spacer(),
          Flexible(child: Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

extension on List<PlanItem> {
  PlanItem? get firstOrNull => isEmpty ? null : first;
}
