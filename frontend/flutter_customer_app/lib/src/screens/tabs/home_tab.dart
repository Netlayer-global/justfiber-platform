import 'package:flutter/material.dart';

import '../../core/app_state.dart';
import '../booking_flow_screen.dart';
import '../wifi_settings_screen.dart';
import '../../widgets/app_card.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.onNavigate});

  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final billing = appState.billing;
    final notifications = appState.notifications.take(2).toList();

    return RefreshIndicator(
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 130),
        children: [
          Text('CUSTOMER DASHBOARD', style: Theme.of(context).textTheme.labelMedium?.copyWith(color: const Color(0xFF8224E3), letterSpacing: 1.4)),
          const SizedBox(height: 6),
          Text('Hello, ${dashboard.customerName}', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(
            'Connection health, plan usage and your quick actions in one place.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF8224E3), Color(0xFFA855F7), Color(0xFFD2B4FF)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.14),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: Colors.white24),
                      ),
                      child: const Text(
                        'LIVE CONNECTION',
                        style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text('Your broadband plan', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
                const SizedBox(height: 8),
                Text(
                  billing.currentPlan,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: Colors.white, height: 1.1),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _InfoPill(
                        icon: Icons.bolt_rounded,
                        title: '${dashboard.usedGb.toStringAsFixed(0)} GB',
                        subtitle: 'Used this cycle',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _InfoPill(
                        icon: Icons.calendar_month_rounded,
                        title: billing.nextBillDate,
                        subtitle: 'Renewal date',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: () => onNavigate(1),
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFF4A3B81),
                        ),
                        child: const Text('Pay Bill'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton.tonal(
                        onPressed: () => onNavigate(2),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0x29000000),
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Manage Wi-Fi'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _MetricCard(title: 'Usage', value: '${dashboard.usedGb.toStringAsFixed(0)} GB', subtitle: 'of ${dashboard.totalGb.toStringAsFixed(0)} GB')),
              const SizedBox(width: 12),
              Expanded(child: _MetricCard(title: 'Outstanding', value: 'Rs ${billing.dueAmount.toStringAsFixed(0)}', subtitle: billing.paymentStatus)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _MetricCard(title: 'Active Days', value: '${dashboard.activeDays}', subtitle: 'days remaining')),
              const SizedBox(width: 12),
              Expanded(child: _MetricCard(title: 'Wi-Fi', value: dashboard.wifiName, subtitle: 'Primary SSID')),
            ],
          ),
          const SizedBox(height: 22),
          Text('Quick actions', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            childAspectRatio: 1.1,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            children: [
              _ActionCard(
                icon: Icons.payments_rounded,
                title: 'Pay Bill',
                subtitle: 'Invoices and payment methods',
                onTap: () => onNavigate(1),
              ),
              _ActionCard(
                icon: Icons.add_home_work_rounded,
                title: 'Book Connection',
                subtitle: 'Start a new broadband booking flow',
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const BookingFlowScreen()),
                  );
                  if (context.mounted) {
                    await appState.refresh();
                  }
                },
              ),
              _ActionCard(
                icon: Icons.router_rounded,
                title: 'Wi-Fi Control',
                subtitle: 'SSID, password and guest network',
                onTap: () => onNavigate(2),
              ),
              _ActionCard(
                icon: Icons.contact_support_rounded,
                title: 'Support',
                subtitle: 'Raise and track complaints',
                onTap: () => onNavigate(3),
              ),
              _ActionCard(
                icon: Icons.person_outline_rounded,
                title: 'Profile',
                subtitle: 'Account, requests and logout',
                onTap: () => onNavigate(4),
              ),
              _ActionCard(
                icon: Icons.devices_rounded,
                title: 'Devices',
                subtitle: 'View connected devices and internet access',
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const WifiSettingsScreen(initialAction: WifiLaunchAction.devices),
                    ),
                  );
                  if (context.mounted) {
                    await appState.refresh();
                  }
                },
              ),
              _ActionCard(
                icon: Icons.family_restroom_rounded,
                title: 'Parental',
                subtitle: 'Schedules and restrictions for devices',
                onTap: () async {
                  await Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const WifiSettingsScreen(initialAction: WifiLaunchAction.parentalControls),
                    ),
                  );
                  if (context.mounted) {
                    await appState.refresh();
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 22),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('OTT & add-ons', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 14),
                _AddonTile(
                  color: const Color(0xFFE50914),
                  title: 'Netflix Premium',
                  subtitle: '4K Ultra HD | 4 Screens',
                  cta: 'Manage',
                ),
                const SizedBox(height: 12),
                _AddonTile(
                  color: const Color(0xFF000435),
                  title: 'Disney+ Hotstar',
                  subtitle: 'Bundled with current plan',
                  cta: 'Pending',
                ),
                const SizedBox(height: 12),
                _AddonTile(
                  color: const Color(0xFF00A8E1),
                  title: 'Prime Video',
                  subtitle: 'Add to current broadband plan',
                  cta: 'Add',
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Text('Recent activity', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (notifications.isEmpty)
            const AppCard(child: Text('No recent notifications right now.'))
          else
            ...notifications.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AppCard(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 44,
                        width: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF3EDFB),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(Icons.notifications_active_outlined, color: Color(0xFF8126CF)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title, style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: 6),
                            Text(item.body, style: Theme.of(context).textTheme.bodyMedium),
                          ],
                        ),
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
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.title,
    required this.value,
    required this.subtitle,
  });

  final String title;
  final String value;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 8),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(28),
      onTap: onTap,
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 46,
              width: 46,
              decoration: BoxDecoration(
                color: const Color(0xFFF3EDFB),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(icon, color: const Color(0xFF8126CF)),
            ),
            const Spacer(),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.16),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white24),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.white),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(subtitle, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AddonTile extends StatelessWidget {
  const _AddonTile({
    required this.color,
    required this.title,
    required this.subtitle,
    required this.cta,
  });

  final Color color;
  final String title;
  final String subtitle;
  final String cta;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                const SizedBox(height: 6),
                Text(subtitle, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
          ),
          FilledButton.tonal(
            onPressed: () {},
            style: FilledButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.black87,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
            child: Text(cta),
          ),
        ],
      ),
    );
  }
}
