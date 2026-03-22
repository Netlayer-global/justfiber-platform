import 'package:flutter/material.dart';

import '../core/app_state.dart';
import 'billing_history_screen.dart';
import 'billing_payment_screen.dart';
import 'booking_flow_screen.dart';
import 'plan_catalog_screen.dart';
import 'service_tracking_screen.dart';
import 'support_history_screen.dart';
import 'wifi_settings_screen.dart';

class ServiceHubScreen extends StatelessWidget {
  const ServiceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final billing = appState.billing;
    final wifi = appState.wifi;
    final session = appState.session;
    final networkQuality = appState.networkQuality;
    final speedTest = appState.speedTest;
    final displayWifiName = wifi.ssid24.isEmpty ? '${session?.mobile ?? ''}_wifi' : wifi.ssid24;
    final planName = billing.currentPlan.isNotEmpty ? billing.currentPlan : (dashboard.planName.isNotEmpty ? dashboard.planName : 'No active plan');
    final isActive = !wifi.paused && planName != 'No active plan';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          children: [
            Text('Wi-Fi', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 2),
            Text(
              displayWifiName,
              style: const TextStyle(fontSize: 18, color: Color(0xFF676B76)),
            ),
          ],
        ),
        centerTitle: true,
        backgroundColor: const Color(0xFFF1F0FF),
        foregroundColor: const Color(0xFF17181C),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              backgroundColor: Colors.white,
              child: IconButton(
                icon: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF1B1E26)),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
                ),
              ),
            ),
          ),
        ],
      ),
      backgroundColor: const Color(0xFFF1F0FF),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 34),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFF7F7FF), Color(0xFFFFE7E8)],
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
              ),
              borderRadius: BorderRadius.circular(28),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Your broadband control center',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Color(0xFF13151A)),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Use one service hub for Wi-Fi controls, support, add-ons, plan changes, and connection activity.',
                        style: TextStyle(color: Color(0xFF4B5563), height: 1.4),
                      ),
                    ],
                  ),
                ),
                Container(
                  width: 92,
                  height: 92,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD81F26),
                    borderRadius: BorderRadius.circular(24),
                  ),
                  child: const Icon(Icons.wifi_rounded, color: Colors.white, size: 44),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (billing.dueAmount > 0)
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: const [BoxShadow(color: Color(0x12000000), blurRadius: 18, offset: Offset(0, 8))],
              ),
              child: Row(
                children: [
                  Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F1FF),
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: const Icon(Icons.wifi_rounded, size: 34, color: Color(0xFFD81F26)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('WI-FI | $displayWifiName', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF6D7280))),
                        const SizedBox(height: 6),
                        Text(
                          'Bill of Rs ${billing.dueAmount.toStringAsFixed(0)} due by ${billing.nextBillDate.isEmpty ? 'soon' : billing.nextBillDate}',
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22),
                        ),
                        const SizedBox(height: 4),
                        const Text('Avoid late fee and service interruption', style: TextStyle(color: Color(0xFF6B7280))),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: appState.busy ? null : () => _payBill(context, appState),
                    child: const Text('Pay Now'),
                  ),
                ],
              ),
            ),
          if (billing.dueAmount > 0) const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const BookingFlowScreen()),
                  ),
                  child: const Text('Book New Connection'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                  ),
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFF111317)),
                  child: const Text('Upgrade Plan'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(30),
              boxShadow: const [BoxShadow(color: Color(0x12000000), blurRadius: 18, offset: Offset(0, 8))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('PLAN', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF7B7F87))),
                const SizedBox(height: 10),
                Text(planName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 30)),
                const SizedBox(height: 18),
                Row(
                  children: [
                    _metric('Status', isActive ? 'Active' : 'Paused'),
                    _metric('Mode', billing.billMode.isEmpty ? 'Not set' : billing.billMode),
                    _metric('Data', 'Unlimited'),
                    _metric('Devices', '${wifi.connectedDevicesCount}'),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                        ),
                        child: const Text('View Plans'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                        ),
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFF111317)),
                        child: const Text('Change Plan'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _lightCard(
            title: 'QUICK ACTIONS',
            child: Column(
              children: [
                _quickAction(context, Icons.support_agent_rounded, 'Internet Connectivity', 'Get instant support for your Wi-Fi service', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SupportHistoryScreen()))),
                _quickAction(context, Icons.router_outlined, 'Wi-Fi Settings', 'Diagnose issues, manage devices, guest Wi-Fi, and passwords', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WifiSettingsScreen()))),
                _quickAction(context, Icons.home_work_outlined, 'Shift Connection', 'Request relocation of your active connection', () => _showShiftConnectionSheet(context, appState)),
                _quickAction(context, Icons.add_home_work_outlined, 'Book New Connection', 'Create a fresh broadband booking with plan and address confirmation', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BookingFlowScreen()))),
                _quickAction(context, Icons.auto_awesome_motion_outlined, 'Change Plan', 'Upgrade or downgrade your current broadband plan', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen()))),
                _quickAction(context, Icons.description_outlined, 'Billing & Receipts', 'Open invoices, notes, receipts, and pay your due amount', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BillingHistoryScreen()))),
                _quickAction(context, Icons.track_changes_outlined, 'Track orders, complaints', 'Get updates on bookings, service requests, and complaints', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen())), last: true),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _lightCard(
            title: 'SERVICE HEALTH',
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(child: _summaryHealthTile('Quality', networkQuality.quality)),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryHealthTile('Latency', '${networkQuality.latencyMs.toStringAsFixed(0)} ms')),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _summaryHealthTile('Packet Loss', '${networkQuality.packetLossPercent.toStringAsFixed(1)}%')),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryHealthTile('Speed Test', speedTest.status)),
                  ],
                ),
                const SizedBox(height: 14),
                _accountRow(Icons.track_changes_outlined, 'OPEN REQUESTS', '${appState.requests.length}'),
                _accountRow(Icons.support_agent_outlined, 'OPEN TICKETS', '${appState.tickets.length}', last: true),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                        ),
                        child: const Text('Open Tracking'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const WifiSettingsScreen()),
                        ),
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFF111317)),
                        child: const Text('Run Wi-Fi Actions'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (appState.addons.isNotEmpty) ...[
            const SizedBox(height: 18),
            _lightCard(
              title: 'Get add-ons',
              child: Column(
                children: appState.addons
                    .take(2)
                    .map(
                      (addon) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(22)),
                          child: Row(
                            children: [
                              Container(
                                width: 72,
                                height: 72,
                                decoration: BoxDecoration(color: const Color(0xFFF0EEFF), borderRadius: BorderRadius.circular(18)),
                                child: const Icon(Icons.add_box_outlined, size: 34, color: Color(0xFF22252D)),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(addon.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                                    const SizedBox(height: 4),
                                    Text(addon.description, style: const TextStyle(color: Color(0xFF6B7280), height: 1.4)),
                                  ],
                                ),
                              ),
                              OutlinedButton(
                                onPressed: () => _showAddonInterest(context, appState, addon.name),
                                child: const Text('Request'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFD9F2FF), Color(0xFFF0EEFF)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(28),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Get control with my Wi-Fi', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 24, color: Color(0xFF0F172A))),
                SizedBox(height: 10),
                Text(
                  '- solve connectivity problems\n- manage connected devices\n- update guest Wi-Fi and password',
                  style: TextStyle(color: Color(0xFF334155), height: 1.6),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _lightCard(
            title: 'ACCOUNT INFO.',
            child: Column(
              children: [
                _accountRow(Icons.wifi_rounded, 'DSL NUMBER', displayWifiName),
                _accountRow(Icons.phone_iphone_rounded, 'REGISTERED MOBILE', session?.mobile ?? '-'),
                _accountRow(Icons.account_circle_outlined, 'ACCOUNT NAME', dashboard.customerName.isEmpty ? '-' : dashboard.customerName),
                _accountRow(Icons.description_outlined, 'CURRENT PLAN', planName, last: true),
              ],
            ),
          ),
          const SizedBox(height: 18),
          _lightCard(
            title: 'GET INSTANT SUPPORT',
            child: Column(
              children: [
                _supportLink(context, 'I am having internet issues', () => _raiseSupport(context, appState, subject: 'Internet issue', description: 'I am having internet issues.')),
                _supportLink(context, 'My Wi-Fi is disconnecting frequently', () => _raiseSupport(context, appState, subject: 'Wi-Fi disconnecting', description: 'My Wi-Fi is disconnecting frequently.')),
                _supportLink(context, 'I want to shift my Wi-Fi', () => _showShiftConnectionSheet(context, appState)),
                _supportLink(context, 'I need clarity on my bill', () => _raiseSupport(context, appState, subject: 'Billing clarification', description: 'I need clarity on my latest bill.')),
                const Divider(height: 28),
                Row(
                  children: [
                    const Expanded(child: Text('Need help for something else?', style: TextStyle(fontWeight: FontWeight.w700))),
                    TextButton(
                      onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SupportHistoryScreen())),
                      child: const Text('Chat Now'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _lightCard({required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        boxShadow: const [BoxShadow(color: Color(0x12000000), blurRadius: 18, offset: Offset(0, 8))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: Color(0xFF7B7F87))),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF7B7F87))),
        ],
      ),
    );
  }

  Widget _summaryHealthTile(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF7B7F87), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value.isEmpty ? '-' : value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
        ],
      ),
    );
  }

  Widget _quickAction(BuildContext context, IconData icon, String title, String subtitle, VoidCallback onTap, {bool last = false}) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(border: Border(bottom: last ? BorderSide.none : const BorderSide(color: Color(0xFFE8EAF1)))),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(color: const Color(0xFFF0EEFF), borderRadius: BorderRadius.circular(18)),
              child: Icon(icon, color: const Color(0xFF1F2937)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280), height: 1.4)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF8A90A2)),
          ],
        ),
      ),
    );
  }

  Widget _accountRow(IconData icon, String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(border: Border(bottom: last ? BorderSide.none : const BorderSide(color: Color(0xFFE8EAF1)))),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(color: const Color(0xFFF0EEFF), borderRadius: BorderRadius.circular(18)),
            child: Icon(icon, color: const Color(0xFF1F2937)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Color(0xFF7B7F87), fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _supportLink(BuildContext context, String text, VoidCallback onTap) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(text, style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w600)),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }

  Future<void> _payBill(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    final paymentOrder = await appState.loadBillingPaymentOrder(amount: appState.billing.dueAmount);
    if (!context.mounted) return;
    if (paymentOrder == null) {
      messenger.showSnackBar(SnackBar(content: Text(appState.error ?? 'Unable to create payment order')));
      return;
    }
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => BillingPaymentScreen(paymentOrder: paymentOrder)),
    );
  }

  Future<void> _showAddonInterest(BuildContext context, AppState appState, String addonName) async {
    final request = await appState.submitServiceRequest(type: 'link_service', note: 'Interested in $addonName');
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(request == null ? (appState.error ?? 'Unable to submit add-on request') : '$addonName request created')),
    );
  }

  Future<void> _showShiftConnectionSheet(BuildContext context, AppState appState) async {
    String shiftMode = 'new_address';
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(32))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setLocalState) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(child: Container(width: 52, height: 6, decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(99)))),
                  const SizedBox(height: 18),
                  const Text('Shift Wi-Fi', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 30)),
                  const SizedBox(height: 14),
                  _radioCard(
                    title: 'New address',
                    subtitle: 'Move your connection to your new location',
                    value: 'new_address',
                    groupValue: shiftMode,
                    onChanged: (value) => setLocalState(() => shiftMode = value),
                  ),
                  const SizedBox(height: 12),
                  _radioCard(
                    title: 'Different spot at same address',
                    subtitle: 'Move your Wi-Fi setup within your house',
                    value: 'same_address',
                    groupValue: shiftMode,
                    onChanged: (value) => setLocalState(() => shiftMode = value),
                  ),
                  const SizedBox(height: 18),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: const Color(0xFF2563EB), borderRadius: BorderRadius.circular(18)),
                    child: const Text('Shift your Wi-Fi connection for free!', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: appState.busy
                          ? null
                          : () async {
                              final request = await appState.submitServiceRequest(
                                type: 'shift',
                                note: shiftMode == 'new_address'
                                    ? 'Customer wants to shift Wi-Fi to a new address.'
                                    : 'Customer wants to shift Wi-Fi within the same address.',
                              );
                              if (!context.mounted) return;
                              Navigator.of(context).pop();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(request == null ? (appState.error ?? 'Unable to create shift request') : 'Shift request submitted')),
                              );
                            },
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFFD81F26)),
                      child: const Text('Proceed'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _radioCard({
    required String title,
    required String subtitle,
    required String value,
    required String groupValue,
    required ValueChanged<String> onChanged,
  }) {
    final selected = value == groupValue;
    return InkWell(
      onTap: () => onChanged(value),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: selected ? const Color(0xFF2563EB) : const Color(0xFFE5E7EB), width: 1.5),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6B7280))),
                ],
              ),
            ),
            Radio<String>(value: value, groupValue: groupValue, onChanged: (next) => onChanged(next ?? value)),
          ],
        ),
      ),
    );
  }

  Future<void> _raiseSupport(BuildContext context, AppState appState, {required String subject, required String description}) async {
    final ticket = await appState.raiseComplaint(category: 'internet_issue', subject: subject, description: description);
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ticket == null ? (appState.error ?? 'Unable to create support request') : 'Support ticket created: $ticket')),
    );
  }
}
