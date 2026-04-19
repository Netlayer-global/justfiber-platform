import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../billing_payment_screen.dart';
import '../booking_flow_screen.dart';
import '../notifications_screen.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.onNavigate});
  final ValueChanged<int> onNavigate;

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final billing = appState.billing;
    final usagePct = dashboard.totalGb > 0
        ? (dashboard.usedGb / dashboard.totalGb).clamp(0.0, 1.0)
        : 0.0;
    final isOnline = dashboard.serviceStatus.toLowerCase().contains('active') ||
        dashboard.serviceStatus.isEmpty;
    final unread =
        appState.notifications.where((n) => n.readAt.isEmpty).length;

    return RefreshIndicator(
      onRefresh: appState.refresh,
      color: kPrimary,
      backgroundColor: kSurface,
      child: ListView(
        padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 12, bottom: 120),
        children: [
          // ── Top Bar ────────────────────────────────────────────────
          _TopBar(
            name: dashboard.customerName,
            unread: unread,
            onNotif: () => Navigator.of(context).push(
                MaterialPageRoute(
                    builder: (_) => const NotificationsScreen())),
          ),

          const SizedBox(height: 20),

          // ── Service Hero Card ──────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: _HeroCard(
              planName: billing.currentPlan,
              wifiName: dashboard.wifiName,
              usedGb: dashboard.usedGb,
              totalGb: dashboard.totalGb,
              usagePct: usagePct,
              isOnline: isOnline,
              serviceStatus: dashboard.serviceStatus,
              onBookNow: () => Navigator.of(context).push(
                MaterialPageRoute(
                    builder: (_) => BookingFlowScreen(
                        initialMobile: appState.session?.mobile)),
              ),
            ),
          ),

          const SizedBox(height: 14),

          // ── Billing Strip — only when due ─────────────────────────
          if (billing.dueAmount > 0) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: _BillingStrip(
                dueAmount: billing.dueAmount,
                nextBillDate: billing.nextBillDate,
                onPay: () => _openPayBill(context, appState),
              ),
            ),
            const SizedBox(height: 14),
          ],

          const SizedBox(height: 14),

          // ── Stats Row ─────────────────────────────────────────────
          const _SectionLabel('YOUR USAGE'),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              children: [
                Expanded(
                  child: _StatTile(
                    icon: Icons.data_usage_rounded,
                    accent: kPrimary,
                    label: 'Data Used',
                    value: '${dashboard.usedGb.toStringAsFixed(1)} GB',
                    sub: dashboard.totalGb > 0
                        ? 'of ${dashboard.totalGb.toStringAsFixed(0)} GB'
                        : 'Unlimited',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatTile(
                    icon: Icons.event_repeat_rounded,
                    accent: const Color(0xFF0EA5E9),
                    label: 'Renewal In',
                    value: dashboard.activeDays > 0
                        ? '${dashboard.activeDays} days'
                        : '—',
                    sub: billing.nextBillDate.isEmpty
                        ? 'No date set'
                        : _fmtDate(billing.nextBillDate),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              children: [
                Expanded(
                  child: _StatTile(
                    icon: Icons.wifi_rounded,
                    accent: const Color(0xFF10B981),
                    label: 'Wi-Fi Name',
                    value: dashboard.wifiName.isEmpty
                        ? '—'
                        : dashboard.wifiName,
                    sub: 'Primary network',
                    smallValue: true,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatTile(
                    icon: Icons.devices_rounded,
                    accent: const Color(0xFFF59E0B),
                    label: 'Devices',
                    value: appState.connectedDevices.isEmpty
                        ? '—'
                        : '${appState.connectedDevices.length}',
                    sub: 'Connected now',
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openPayBill(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    final order = await appState.loadBillingPaymentOrder();
    if (!context.mounted) return;
    if (order == null) {
      messenger.showSnackBar(SnackBar(
          content: Text(appState.error ?? 'Unable to create payment order')));
      return;
    }
    await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => BillingPaymentScreen(paymentOrder: order)));
  }

}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

class _TopBar extends StatelessWidget {
  const _TopBar(
      {required this.name, required this.unread, required this.onNotif});
  final String name;
  final int unread;
  final VoidCallback onNotif;

  String get _greeting {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final first = name.split(' ').first;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 18, 0),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$_greeting, ${first.isEmpty ? 'there' : first} 👋',
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -0.6,
                ),
              ),
            ],
          ),
          const Spacer(),
          // Notification bell
          GestureDetector(
            onTap: onNotif,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(color: kBorder),
                  ),
                  child: const Icon(Icons.notifications_outlined,
                      color: Colors.white70, size: 20),
                ),
                if (unread > 0)
                  Positioned(
                    top: 9,
                    right: 9,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFFEF4444),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Hero Card ─────────────────────────────────────────────────────────────────

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.planName,
    required this.wifiName,
    required this.usedGb,
    required this.totalGb,
    required this.usagePct,
    required this.isOnline,
    required this.serviceStatus,
    required this.onBookNow,
  });

  final String planName, wifiName, serviceStatus;
  final double usedGb, totalGb, usagePct;
  final bool isOnline;
  final VoidCallback onBookNow;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF8224E3),
        border: Border.all(color: const Color(0x66D8B4FE)),
        borderRadius: BorderRadius.circular(26),
      ),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status + plan row
                Row(
                  children: [
                    // Online status pill
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: isOnline
                                  ? const Color(0xFF4ADE80)
                                  : const Color(0xFFEF4444),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            isOnline ? 'Active' : 'Inactive',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'YOUR PLAN',
                      style: GoogleFonts.inter(
                        color: const Color(0xFFD8B4FE),
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        planName.isEmpty ? 'No active plan' : planName,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.6,
                          height: 1.15,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 12),
                    FilledButton(
                      onPressed: onBookNow,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF3B0D7A),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: Text(
                        'Book Now',
                        style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w900),
                      ),
                    ),
                  ],
                ),

                if (wifiName.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const Icon(Icons.wifi_rounded,
                          color: Colors.white70, size: 13),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          wifiName,
                          style: GoogleFonts.inter(
                              color: Colors.white70, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 20),

                // Usage section
                Row(
                  children: [
                    Text(
                      totalGb > 0
                          ? '${usedGb.toStringAsFixed(1)} GB used'
                          : 'Unlimited data',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w600),
                    ),
                    const Spacer(),
                    Text(
                      totalGb > 0
                          ? '${(usagePct * 100).toStringAsFixed(0)}% of ${totalGb.toStringAsFixed(0)} GB'
                          : '',
                      style:
                          GoogleFonts.inter(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                // Usage bar
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    height: 7,
                    color: Colors.white.withValues(alpha: 0.15),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: totalGb > 0 ? usagePct : 0,
                      child: Container(
                        decoration: BoxDecoration(
                          color: usagePct > 0.85
                              ? const Color(0xFFFF6B6B)
                              : Colors.white,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
    );
  }
}

// ─── Billing Strip ─────────────────────────────────────────────────────────────

class _BillingStrip extends StatelessWidget {
  const _BillingStrip({
    required this.dueAmount,
    required this.nextBillDate,
    required this.onPay,
  });

  final double dueAmount;
  final String nextBillDate;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final hasDue = dueAmount > 0;

    return Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: hasDue
                ? const Color(0x44FBBF24)
                : kBorder,
          ),
        ),
        child: Row(
          children: [
            // Amount
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  hasDue ? 'Amount Due' : 'All Paid',
                  style: GoogleFonts.inter(
                      fontSize: 11, color: kMuted, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 3),
                Text(
                  'Rs ${dueAmount.toStringAsFixed(0)}',
                  style: GoogleFonts.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: hasDue ? const Color(0xFFFBBF24) : const Color(0xFF4ADE80),
                    letterSpacing: -0.5,
                  ),
                ),
                if (nextBillDate.isNotEmpty)
                  Text(
                    'Due ${_fmtDate(nextBillDate)}',
                    style:
                        GoogleFonts.inter(fontSize: 11, color: kMuted),
                  ),
              ],
            ),
            const Spacer(),
            // Pay button
            FilledButton(
              onPressed: onPay,
              style: FilledButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                'Pay Now',
                style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
          ],
        ),
    );
  }
}

// ─── Section Label ─────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: kMuted,
          letterSpacing: 1.6,
        ),
      ),
    );
  }
}

// ─── Stat Tile ─────────────────────────────────────────────────────────────────

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.accent,
    required this.label,
    required this.value,
    required this.sub,
    this.smallValue = false,
  });

  final IconData icon;
  final Color accent;
  final String label, value, sub;
  final bool smallValue;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      accent.withValues(alpha: 0.22),
                      accent.withValues(alpha: 0.08),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(color: accent.withValues(alpha: 0.18)),
                ),
                child: Icon(icon, color: accent, size: 16),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: smallValue ? 16 : 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.5,
              height: 1.1,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.inter(
                fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white60),
          ),
          const SizedBox(height: 2),
          Text(
            sub,
            style: GoogleFonts.inter(fontSize: 10, color: kMuted),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ─── Date formatter ────────────────────────────────────────────────────────────

String _fmtDate(String raw) {
  try {
    final dt = DateTime.parse(raw);
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${m[dt.month - 1]} ${dt.day}, ${dt.year}';
  } catch (_) {
    final t = raw.indexOf('T');
    return t > 0 ? raw.substring(0, t) : raw;
  }
}
