import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';
import '../booking_flow_screen.dart';
import '../notifications_screen.dart';
import '../plan_catalog_screen.dart';
import '../service_tracking_screen.dart';

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
              Text('Quick access', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _summaryChip('Due', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
                  _summaryChip('Plan', billing.currentPlan.isEmpty ? '-' : billing.currentPlan),
                  _summaryChip('Requests', '${appState.requests.length}'),
                  _summaryChip('Tickets', '${appState.tickets.length}'),
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
                              billingTerm: 'monthly',
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
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8F4FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x228224E3)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(item.title, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF131313))),
                                    const SizedBox(height: 4),
                                    Text(item.createdAt, style: const TextStyle(color: Color(0xFF6F7280), fontSize: 12)),
                                  ],
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFFFFF),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(color: const Color(0x228224E3)),
                                ),
                                child: Text(item.status, style: const TextStyle(color: Color(0xFF8126CF), fontWeight: FontWeight.w700)),
                              ),
                            ],
                          ),
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
              Text('More tools', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 14),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _shortcutButton(
                    context,
                    icon: Icons.add_home_work_rounded,
                    label: 'Book',
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BookingFlowScreen())),
                  ),
                  _shortcutButton(
                    context,
                    icon: Icons.receipt_long_rounded,
                    label: 'Plans',
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen())),
                  ),
                  _shortcutButton(
                    context,
                    icon: Icons.track_changes_rounded,
                    label: 'Tracking',
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen())),
                  ),
                  _shortcutButton(
                    context,
                    icon: Icons.notifications_active_rounded,
                    label: 'Notifications',
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                  ),
                ],
              ),
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

  Widget _shortcutButton(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return FilledButton.tonalIcon(
      onPressed: onTap,
      icon: Icon(icon),
      label: Text(label),
    );
  }

  Widget _summaryChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF131313), fontSize: 12),
          children: [
            TextSpan(text: '$label ', style: const TextStyle(fontWeight: FontWeight.w600)),
            TextSpan(text: value, style: const TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }
}

extension on List<PlanItem> {
  PlanItem? get firstOrNull => isEmpty ? null : first;
}
