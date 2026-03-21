import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../billing_history_screen.dart';
import '../billing_payment_screen.dart';
import '../support_history_screen.dart';
import '../../widgets/app_card.dart';
import '../../widgets/usage_bar.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.onNavigate});

  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final wifi = appState.wifi;
    final billing = appState.billing;
    final latestBooking = appState.latestBooking;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Hi, ${dashboard.customerName}', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 4),
                  Text('Manage broadband, booking and support in one place.', style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
            const CircleAvatar(
              radius: 20,
              backgroundColor: Color(0x221FFFFFFF),
              child: Icon(Icons.notifications_none_rounded, color: Color(0xFFE8EAF4)),
            ),
          ],
        ),
        const SizedBox(height: 18),
        AppCard(
          gradient: const LinearGradient(
            colors: [Color(0xFF4C5DFF), Color(0xFF8D61FF), Color(0xFF2A347E)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('My JustFiber', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white)),
              const SizedBox(height: 10),
              Text(
                'Rs ${dashboard.walletBalance.toStringAsFixed(0)}',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${dashboard.planName} active now',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                    ),
                  ),
                  FilledButton(
                    onPressed: appState.busy ? null : () => _payBill(context, appState),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF161B33),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: const Text('Pay Bill'),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Text('Quick actions', style: Theme.of(context).textTheme.titleMedium),
            const Spacer(),
            TextButton(onPressed: () => onNavigate(4), child: const Text('View all')),
          ],
        ),
        GridView.count(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          crossAxisCount: 4,
          mainAxisSpacing: 14,
          crossAxisSpacing: 14,
          children: [
            _feature(context, Icons.receipt_long_rounded, 'Bills', () => _payBill(context, appState)),
            _feature(context, Icons.wifi_tethering_rounded, 'Wi-Fi', () => onNavigate(3)),
            _feature(context, Icons.calendar_month_rounded, 'Booking', () => onNavigate(2)),
            _feature(
              context,
              Icons.support_agent_rounded,
              'Support',
              () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        if (billing.dueAmount > 0)
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFD81F26), Color(0xFF8A1C4A)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  billing.pendingPlanChange != null ? 'Plan change payment pending' : 'Payment reminder',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 10),
                Text(
                  billing.pendingPlanChange != null
                      ? 'Pay Rs ${billing.dueAmount.toStringAsFixed(0)} to complete your plan switch.'
                      : 'Rs ${billing.dueAmount.toStringAsFixed(0)} is due. Pay now to keep service active.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: appState.busy ? null : () => _payBill(context, appState),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF161B33),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: Text(billing.pendingPlanChange != null ? 'Pay to switch plan' : 'Pay now'),
                ),
              ],
            ),
          ),
        if (billing.dueAmount > 0) const SizedBox(height: 18),
        AppCard(
          child: Row(
            children: [
              const Icon(Icons.receipt_long_rounded, color: Color(0xFF4C5DFF)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Billing documents', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(
                      '${billing.invoices.length} invoices, ${billing.payments.length} receipts, ${billing.notes.length} notes',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const BillingHistoryScreen()),
                ),
                child: const Text('Open'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Row(
          children: [
            Expanded(
              child: AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.network_check_rounded, color: Color(0xFF8D61FF)),
                    const SizedBox(height: 10),
                    Text('${dashboard.usedGb.toStringAsFixed(0)} GB', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Text('Used out of ${dashboard.totalGb.toStringAsFixed(0)} GB', style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 10),
                    UsageBar(progress: dashboard.usedGb / dashboard.totalGb),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.account_tree_rounded, color: Color(0xFF4C5DFF)),
                    const SizedBox(height: 10),
                    Text('${dashboard.activeDays}', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 8),
                    Text('Days left in current cycle', style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Connection details', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              _infoRow('Wi-Fi 2.4G', wifi.ssid24),
              _infoRow('Wi-Fi 5G', wifi.ssid5),
              _infoRow('Plan', billing.currentPlan),
              _infoRow('Next bill', billing.nextBillDate),
              _infoRow('Due amount', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
              if (billing.pendingPlanChange != null)
                _infoRow('Pending switch', billing.pendingPlanChange!.planName),
            ],
          ),
        ),
        if (latestBooking != null) ...[
          const SizedBox(height: 18),
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF121938), Color(0xFF1A2250)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Latest booking', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                _infoRow('Booking no.', latestBooking.bookingNumber),
                _infoRow('Plan', latestBooking.planName),
                _infoRow('Amount', 'Rs ${latestBooking.amount.toStringAsFixed(0)}'),
                _infoRow('Step', latestBooking.currentStep),
              ],
            ),
          ),
        ],
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
      MaterialPageRoute(
        builder: (_) => BillingPaymentScreen(paymentOrder: paymentOrder),
      ),
    );
  }

  Widget _feature(BuildContext context, IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: Column(
        children: [
          Container(
            height: 54,
            width: 54,
            decoration: BoxDecoration(
              color: const Color(0x221FFFFFFF),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(icon, color: const Color(0xFFE8EAF4)),
          ),
          const SizedBox(height: 8),
          Text(label, style: Theme.of(context).textTheme.labelMedium, textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF9CA7D4))),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white)),
        ],
      ),
    );
  }
}
