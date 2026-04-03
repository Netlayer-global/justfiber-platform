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
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 130),
      children: [
        Text('Profile', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFF8126CF), Color(0xFFC284FF)],
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
              Text('Billing snapshot', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              _row('Latest bill', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
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
                  ? [const Text('No recent requests.')]
                  : appState.requests.take(5).map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 4),
                                  Text(item.createdAt, style: const TextStyle(color: Color(0xFF6F7280), fontSize: 12)),
                                ],
                              ),
                            ),
                            Text(item.status, style: const TextStyle(color: Color(0xFF8126CF))),
                          ],
                        ),
                      ),
                    )),
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
          Text(appState.error!, style: const TextStyle(color: Color(0xFFB41340))),
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
          Text(label, style: const TextStyle(color: Color(0xFF6F7280))),
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
