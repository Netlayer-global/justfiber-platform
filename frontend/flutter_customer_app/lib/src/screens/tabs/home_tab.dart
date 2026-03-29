import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';
import '../billing_history_screen.dart';
import '../billing_payment_screen.dart';
import '../booking_flow_screen.dart';
import '../plan_catalog_screen.dart';
import '../service_tracking_screen.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.onNavigate});

  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final billing = appState.billing;
    final wifi = appState.wifi;
    final latestBooking = appState.latestBooking;
    final connections = appState.connections;
    final banners = _displayBanners(appState.banners);
    CustomerConnection? selectedConnection;
    for (final item in connections) {
      if (item.customerId == appState.selectedCustomerId) {
        selectedConnection = item;
        break;
      }
    }
    final displayName = dashboard.customerName.isEmpty ? 'JustFiber Customer' : dashboard.customerName;
    final planName = billing.currentPlan.isNotEmpty ? billing.currentPlan : (dashboard.planName.isNotEmpty ? dashboard.planName : 'No active plan yet');
    final wifiName = wifi.ssid24.isNotEmpty ? wifi.ssid24 : (dashboard.wifiName.isNotEmpty ? dashboard.wifiName : 'Wi-Fi not configured');
    final hasService = billing.currentPlan.isNotEmpty || wifi.ssid24.isNotEmpty || dashboard.planName.isNotEmpty;
    final usageGb = billing.usageGb > 0 ? billing.usageGb : dashboard.usedGb;
    final usageCapGb = billing.usageCapGb > 0 ? billing.usageCapGb : dashboard.totalGb;
    final double usagePercent = usageCapGb > 0 ? (usageGb / usageCapGb).clamp(0.0, 1.0).toDouble() : 0.0;
    final hasUsagePressure = billing.usageCapReached || (usageCapGb > 0 && usagePercent >= 0.65);
    final showUpgradePrompt = hasService && hasUsagePressure;
    final billingCycleLabel = billing.billCycle.isNotEmpty ? billing.billCycle : 'Monthly';
    final nextBillDateLabel = billing.nextBillDate.isNotEmpty ? billing.nextBillDate : 'Will update after activation';
    final serviceStatusLabel = dashboard.serviceStatus.isNotEmpty
        ? dashboard.serviceStatus
        : (selectedConnection?.status.isNotEmpty == true ? selectedConnection!.status : (hasService ? 'active' : 'no service'));
    final dashboardAlert = dashboard.billingAlert;
    final dashboardAlertTone = dashboard.billingAlertTone;

    return RefreshIndicator(
      color: const Color(0xFF8224E3),
      backgroundColor: const Color(0xFFFFFFFF),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFFFFFFFF),
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: const Color(0x228224E3)),
            boxShadow: const [
              BoxShadow(color: Color(0x10030B14), blurRadius: 26, offset: Offset(0, 12)),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CUSTOMER DASHBOARD',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: const Color(0xFF8224E3),
                                letterSpacing: 2.6,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Hi, $displayName',
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                color: const Color(0xFF131313),
                                fontSize: 30,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          hasService
                              ? 'Monitor your broadband, due amount, and active requests from one clean control surface.'
                              : 'Check feasibility, pick a plan, and start your broadband booking in a few steps.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: const Color(0xFF6E6A67),
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _metricPill('Due', 'Rs ${billing.dueAmount.toStringAsFixed(0)}'),
                  _metricPill('Status', hasService ? (wifi.paused ? 'Paused' : serviceStatusLabel) : 'No service'),
                  _metricPill('Devices', '${wifi.connectedDevicesCount}'),
                ],
              ),
              if (dashboardAlert.isNotEmpty) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: dashboardAlertTone == 'critical'
                          ? const Color(0x55FF6B6B)
                          : dashboardAlertTone == 'warning'
                              ? const Color(0x55F59E0B)
                              : const Color(0x228224E3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                    decoration: BoxDecoration(
                      color: dashboardAlertTone == 'critical'
                          ? const Color(0xFFFFF1F1)
                              : dashboardAlertTone == 'warning'
                                  ? const Color(0xFFFFF7ED)
                                  : const Color(0xFFF8F4FF),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Icon(
                          dashboardAlertTone == 'critical' ? Icons.warning_amber_rounded : Icons.notifications_active_outlined,
                          color: dashboardAlertTone == 'critical'
                              ? const Color(0xFFC2410C)
                              : dashboardAlertTone == 'warning'
                                  ? const Color(0xFFD97706)
                                  : const Color(0xFF8224E3),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              dashboardAlert,
                              style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              billing.dueAmount > 0
                                  ? 'Pay Rs ${billing.dueAmount.toStringAsFixed(0)} to keep the line in good standing.'
                                  : 'Your latest billing status has been refreshed.',
                              style: const TextStyle(color: Color(0xFF6E6A67), height: 1.35),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  SizedBox(
                    width: 150,
                    child: FilledButton(
                      onPressed: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const BookingFlowScreen()),
                        );
                        if (context.mounted) {
                          await appState.refresh();
                        }
                      },
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                      ),
                      child: const Text('Book now'),
                    ),
                  ),
                  SizedBox(
                    width: 150,
                    child: OutlinedButton(
                      onPressed: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                        );
                        if (context.mounted) {
                          await appState.refresh();
                        }
                      },
                      child: Text(hasService ? 'View plans' : 'Explore plans'),
                    ),
                  ),
                  SizedBox(
                    width: 150,
                    child: OutlinedButton(
                      onPressed: hasService
                          ? (appState.busy ? null : () => _payBill(context, appState))
                          : () async {
                              await Navigator.of(context).push(
                                MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                              );
                              if (context.mounted) {
                                await appState.refresh();
                              }
                            },
                      child: Text(hasService ? 'Pay bill' : 'Track request'),
                    ),
                  ),
                ],
              ),
              if (hasService) ...[
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(child: _summaryBox('Next bill', nextBillDateLabel)),
                    const SizedBox(width: 10),
                    Expanded(child: _summaryBox('Cycle', billingCycleLabel)),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        _lightPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Recommended for you',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF131313)),
              ),
              const SizedBox(height: 8),
              Text(
                appState.banners.isEmpty
                    ? 'Curated JustFiber offers are ready here while live promotions sync in.'
                    : 'Latest offers and service actions from JustFiber.',
                style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4),
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 228,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: banners.length > 4 ? 4 : banners.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 12),
                  itemBuilder: (_, index) => _promoCard(context, appState, banners[index]),
                ),
              ),
            ],
          ),
        ),
        if (connections.length > 1) ...[
          const SizedBox(height: 18),
          _lightPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'My connections',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Color(0xFF131313)),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Switch between all broadband connections linked to this mobile number.',
                  style: TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 146,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: connections.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (_, index) {
                      final item = connections[index];
                      final selected = item.customerId == appState.selectedCustomerId;
                      return GestureDetector(
                        onTap: () => appState.selectConnection(item.customerId),
                        child: Container(
                          width: 240,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: selected ? const Color(0xFFF8F4FF) : const Color(0xFFFFFFFF),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: selected ? const Color(0xFF8224E3) : const Color(0x228224E3)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item.planName.isEmpty ? 'Connection' : item.planName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
                                    ),
                                  ),
                                  if (selected)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF8224E3),
                                        borderRadius: BorderRadius.circular(999),
                                      ),
                                      child: const Text('Active', style: TextStyle(color: Color(0xFFFFFFFF), fontWeight: FontWeight.w800, fontSize: 11)),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                item.serviceId.isEmpty ? item.customerId : item.serviceId,
                                style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700),
                              ),
                              const Spacer(),
                              Text(
                                item.address.isEmpty ? 'Address unavailable' : item.address,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Color(0xFF6E6A67), height: 1.35),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      'Due Rs ${item.dueAmount.toStringAsFixed(0)}',
                                      style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
                                    ),
                                  ),
                                  Text(
                                    item.status.toUpperCase(),
                                    style: TextStyle(
                                      color: item.status == 'active' ? const Color(0xFF8224E3) : const Color(0xFF6E6A67),
                                      fontWeight: FontWeight.w800,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 18),
        _lightPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Live connection snapshot',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF131313)),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: hasService ? const Color(0x148224E3) : const Color(0x120B0F19),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: hasService ? const Color(0x668224E3) : const Color(0x1A0B0F19),
                      ),
                    ),
                    child: Text(
                      hasService ? 'ACTIVE' : 'NEW',
                      style: TextStyle(
                        fontWeight: FontWeight.w800,
                        color: hasService ? const Color(0xFF8224E3) : const Color(0xFFCBD5E1),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                hasService
                    ? '${selectedConnection?.serviceId.isNotEmpty == true ? '${selectedConnection!.serviceId} • ' : ''}$planName | $wifiName'
                    : 'No active connection yet. Start with a new booking.',
                style: const TextStyle(color: Color(0xFF9CA3AF), height: 1.45),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(child: _summaryBox('Current plan', planName)),
                  const SizedBox(width: 10),
                  Expanded(child: _summaryBox('Wi-Fi name', wifiName)),
                ],
              ),
              if (hasService) ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: const Color(0x228224E3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Tenure and billing cycle',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313)),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                            decoration: BoxDecoration(
                              color: const Color(0x148224E3),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: const Color(0x448224E3)),
                            ),
                            child: Text(
                              billingCycleLabel,
                              style: const TextStyle(
                                color: Color(0xFF8224E3),
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Your connection tenure, recurring cycle, and current payment baseline for this service.',
                        style: TextStyle(color: Color(0xFF9CA3AF), height: 1.4),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(child: _summaryBox('Recurring due', 'Rs ${billing.lastPaymentAmount > 0 ? billing.lastPaymentAmount.toStringAsFixed(0) : billing.dueAmount.toStringAsFixed(0)}')),
                          const SizedBox(width: 10),
                          Expanded(child: _summaryBox('Next bill / expiry', nextBillDateLabel)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
              if (usageCapGb > 0 || billing.dataPolicy != 'unlimited') ...[
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFFFF),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: billing.usageCapReached ? const Color(0x55FF6B6B) : const Color(0x228224E3)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'Usage meter',
                              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313)),
                            ),
                          ),
                          Text(
                            billing.dataPolicy == 'unlimited' ? 'LIVE' : billing.dataPolicy.toUpperCase(),
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: billing.usageCapReached ? const Color(0xFFFF8A8A) : const Color(0xFF8224E3),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        usageCapGb > 0
                            ? '${usageGb.toStringAsFixed(2)} GB of ${usageCapGb.toStringAsFixed(0)} GB used'
                            : 'Unlimited usage policy active',
                        style: const TextStyle(color: Color(0xFF9CA3AF), height: 1.4),
                      ),
                      if (usageCapGb > 0) ...[
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: usagePercent,
                            minHeight: 10,
                            backgroundColor: const Color(0xFF26282D),
                            valueColor: AlwaysStoppedAnimation<Color>(
                              billing.usageCapReached ? const Color(0xFFFF6B6B) : const Color(0xFF8224E3),
                            ),
                          ),
                        ),
                      ],
                      if (billing.fupSpeedMbps > 0 || billing.usageCapReached) ...[
                        const SizedBox(height: 10),
                        Text(
                          billing.usageCapReached
                              ? (billing.dataPolicy == 'fup'
                                  ? 'FUP active at ${billing.fupSpeedMbps.toStringAsFixed(0)} Mbps'
                                  : 'Hard-cap policy active')
                              : 'Base plan speed active',
                          style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700),
                        ),
                      ],
                      if (showUpgradePrompt) ...[
                        const SizedBox(height: 14),
                        Row(
                          children: [
                            Expanded(
                              child: FilledButton(
                                onPressed: () async {
                                  await Navigator.of(context).push(
                                    MaterialPageRoute(builder: (_) => const PlanCatalogScreen()),
                                  );
                                  if (context.mounted) {
                                    await appState.refresh();
                                  }
                                },
                                style: FilledButton.styleFrom(
                                  backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                                ),
                                child: Text(billing.usageCapReached ? 'Upgrade plan now' : 'Explore faster plans'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 18),
        _sectionTitle(context, 'Primary sections'),
        const SizedBox(height: 10),
        _navCard(
          icon: Icons.router_outlined,
          title: 'Services',
          subtitle: 'Wi-Fi settings, diagnostics, devices, shift connection, and plan controls',
          onTap: () => onNavigate(1),
        ),
        const SizedBox(height: 12),
        _navCard(
          icon: Icons.receipt_long_rounded,
          title: 'Billing',
          subtitle: 'Bills, invoices, receipts, payment history, and dues',
          onTap: () => onNavigate(2),
        ),
        const SizedBox(height: 12),
        _navCard(
          icon: Icons.support_agent_rounded,
          title: 'Support',
          subtitle: 'Complaints, service requests, notifications, and help',
          onTap: () => onNavigate(3),
        ),
        if (billing.dueAmount > 0) ...[
          const SizedBox(height: 18),
          _lightPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('Billing due', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0x148224E3),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0x668224E3)),
                    ),
                    child: const Text('DUE', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF8224E3))),
                  ),
                ],
              ),
                const SizedBox(height: 10),
                Text(
                  billing.pendingPlanChange != null
                      ? 'Pay Rs ${billing.dueAmount.toStringAsFixed(0)} to complete your pending plan switch.'
                      : 'Pay Rs ${billing.dueAmount.toStringAsFixed(0)} before ${billing.nextBillDate} to avoid interruption.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: _summaryBox(
                        'Latest invoice',
                        billing.latestInvoiceNumber.isEmpty ? 'Pending generation' : billing.latestInvoiceNumber,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _summaryBox(
                        'Last payment',
                        billing.lastPaymentDate.isEmpty ? 'Not recorded' : billing.lastPaymentDate,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: appState.busy ? null : () => _payBill(context, appState),
                        child: Text(billing.pendingPlanChange != null ? 'Pay to switch' : 'Pay now'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(onPressed: () => onNavigate(2), child: const Text('Open billing')),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 18),
        _lightPanel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Service summary', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
              const SizedBox(height: 14),
              _infoRow('Current plan', planName),
              _infoRow('Wi-Fi name', wifiName),
              _infoRow('Next bill date', billing.nextBillDate.isEmpty ? '-' : billing.nextBillDate),
              _infoRow('Recurring amount', billing.recurringAmount > 0 ? 'Rs ${billing.recurringAmount.toStringAsFixed(2)}' : '-'),
              _infoRow('Connected devices', '${wifi.connectedDevicesCount}'),
              _infoRow('Service state', hasService ? (wifi.paused ? 'Paused' : 'Active') : 'Not active', highlight: true),
              if (billing.pendingPlanChange != null) _infoRow('Pending plan change', billing.pendingPlanChange!.planName),
            ],
          ),
        ),
        if (latestBooking != null) ...[
          const SizedBox(height: 18),
          _lightPanel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Latest booking', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                const SizedBox(height: 12),
                _infoRow('Booking number', latestBooking.bookingNumber),
                _infoRow('Plan', latestBooking.planName),
                _infoRow('Amount', 'Rs ${latestBooking.amount.toStringAsFixed(0)}'),
                _infoRow('Current step', latestBooking.currentStep, highlight: true),
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
                    );
                    if (context.mounted) {
                      await appState.refresh();
                    }
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF8224E3),
                        foregroundColor: const Color(0xFFFFFFFF),
                  ),
                  child: const Text('Track booking'),
                ),
              ],
            ),
          ),
        ],
        ],
      ),
    );
  }

  Future<void> _openPromo(BuildContext context, AppState appState, AppBannerItem banner) async {
    switch (banner.targetType) {
      case 'plans':
      case 'plan_catalog':
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
        break;
      case 'billing':
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BillingHistoryScreen()));
        break;
      case 'support':
        onNavigate(3);
        return;
      case 'tracking':
        await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()));
        break;
      default:
        return;
    }
    if (context.mounted) {
      await appState.refresh();
    }
  }

  Widget _promoCard(BuildContext context, AppState appState, AppBannerItem banner) {
    return Container(
      width: 280,
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _promoMedia(banner),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFF8F4FF),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0x338224E3)),
              ),
              child: Text(
                banner.imageUrl.isNotEmpty ? 'Featured banner' : 'JustFiber offer',
                style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800, fontSize: 12),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
            child: Text(
              banner.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF131313)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
            child: Text(
              banner.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xFF6E6A67), height: 1.35),
            ),
          ),
          const Spacer(),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
            child: Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => _openPromo(context, appState, banner),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF8224E3),
                  foregroundColor: const Color(0xFFFFFFFF),
                ),
                child: Text(banner.ctaLabel),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<AppBannerItem> _displayBanners(List<AppBannerItem> source) {
    if (source.isNotEmpty) return source;
    return const [
      AppBannerItem(
        title: 'Upgrade to a faster plan',
        description: 'Explore higher-speed plans for streaming, work, and gaming without interruption.',
        imageUrl: '',
        targetType: 'plan_catalog',
        targetValue: '',
        ctaLabel: 'Explore plans',
      ),
      AppBannerItem(
        title: 'Pay your latest bill',
        description: 'Review invoices, complete dues, and keep your connection in good standing.',
        imageUrl: '',
        targetType: 'billing',
        targetValue: '',
        ctaLabel: 'Open billing',
      ),
      AppBannerItem(
        title: 'Track installation progress',
        description: 'See booking steps, installer updates, and the latest service movement in one place.',
        imageUrl: '',
        targetType: 'tracking',
        targetValue: '',
        ctaLabel: 'Track service',
      ),
      AppBannerItem(
        title: 'Need help with service?',
        description: 'Reach support fast for Wi-Fi, speed, billing, and service-related help.',
        imageUrl: '',
        targetType: 'support',
        targetValue: '',
        ctaLabel: 'Get help',
      ),
    ];
  }

  Widget _promoMedia(AppBannerItem banner) {
    final imageUrl = banner.imageUrl.trim();
    if (imageUrl.isEmpty) {
      return Container(
        height: 92,
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          gradient: LinearGradient(
            colors: [Color(0xFF8224E3), Color(0xFFB66BFF)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: const Center(
          child: Text(
            'JustFiber',
            style: TextStyle(
              color: Color(0xFFFFFFFF),
              fontWeight: FontWeight.w800,
              fontSize: 24,
              letterSpacing: 0.4,
            ),
          ),
        ),
      );
    }
    if (imageUrl.startsWith('data:image')) {
      final base64Index = imageUrl.indexOf('base64,');
      if (base64Index != -1) {
        try {
          final bytes = base64Decode(imageUrl.substring(base64Index + 7));
          return ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            child: Image.memory(
              bytes,
              height: 92,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          );
        } catch (_) {}
      }
    }
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      child: Image.network(
        imageUrl,
        height: 92,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          height: 92,
          color: const Color(0xFFF8F4FF),
          alignment: Alignment.center,
          child: const Text(
            'JustFiber',
            style: TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w800, fontSize: 22),
          ),
        ),
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String title) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'CONTROL MODULES',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: const Color(0xFF9CA3AF),
                letterSpacing: 3,
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 6),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: const Color(0xFF131313),
                fontWeight: FontWeight.w800,
              ),
        ),
      ],
    );
  }

  Widget _summaryBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFF8F4FF), Color(0xFFFFFFFF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _navCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(28),
      onTap: onTap,
      child: AppCard(
        color: const Color(0xFFFFFFFF),
        borderColor: const Color(0x228224E3),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFF8F4FF),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: const Color(0xFF8224E3)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: Color(0xFF131313))),
                  const SizedBox(height: 6),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF6E6A67), height: 1.35)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: Color(0xFF8224E3)),
          ],
        ),
      ),
    );
  }

  Widget _metricPill(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFF131313)),
          children: [
            TextSpan(text: '$value ', style: const TextStyle(fontWeight: FontWeight.w800)),
            TextSpan(text: label, style: const TextStyle(color: Color(0xFF6E6A67))),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFFFF),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0x228224E3)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text(
                value,
                textAlign: TextAlign.right,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: highlight ? const Color(0xFF8224E3) : const Color(0xFF131313),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _lightPanel({required Widget child}) {
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      padding: const EdgeInsets.all(20),
      child: child,
    );
  }

  Future<void> _payBill(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    final paymentOrder = await appState.loadBillingPaymentOrder(amount: appState.billing.dueAmount);
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
    await appState.refresh();
  }
}





