import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../billing_payment_screen.dart';
import '../booking_enquiry_screen.dart';
import '../booking_payment_screen.dart';
import '../lead_booking_flow_screen.dart';
import '../notifications_screen.dart';
import '../plan_catalog_screen.dart';

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
            top: MediaQuery.of(context).padding.top + 8, bottom: 120),
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

          // ── Hero — new user gets booking card, existing gets plan hero ──
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: appState.connections.isEmpty
                ? _NewUserConnectCard(
                    onBookNow: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => LeadBookingFlowScreen(
                              initialMobile: appState.session?.mobile)),
                    ),
                    onEnquiry: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => BookingEnquiryScreen(
                                initialMobile: appState.session?.mobile,
                                initialName: appState.dashboard.customerName,
                              )),
                    ),
                  )
                : _PremiumHeroCard(
                    planName: billing.currentPlan,
                    wifiName: dashboard.wifiName,
                    usedGb: dashboard.usedGb,
                    totalGb: dashboard.totalGb,
                    usagePct: usagePct,
                    isOnline: isOnline,
                    activeDays: dashboard.activeDays,
                    onBookNow: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => const PlanCatalogScreen()),
                    ),
                    onBookEnquiry: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => BookingEnquiryScreen(
                                initialMobile: appState.session?.mobile,
                                initialName: appState.dashboard.customerName,
                              )),
                    ),
                  ),
          ),

          const SizedBox(height: 16),

          // ── Pending Payment Booking ────────────────────────────────
          if (appState.pendingPaymentBooking != null) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: _PaymentTicketCard(
                booking: appState.pendingPaymentBooking!,
                onPayNow: () => _openPayBooking(
                    context, appState, appState.pendingPaymentBooking!),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ── Billing Strip — only when due ─────────────────────────
          if (billing.hasActionableDue) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              child: _BillingStrip(
                dueAmount: billing.actionableDueAmount,
                nextBillDate: billing.nextBillDate,
                onPay: () => _openPayBill(context, appState),
              ),
            ),
            const SizedBox(height: 20),
          ],

          // ── Usage Stats ───────────────────────────────────────────
          const _SectionHeader(label: 'YOUR USAGE'),
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

  Future<void> _openPayBooking(
      BuildContext context, AppState appState, BookingQuote booking) async {
    final messenger = ScaffoldMessenger.of(context);
    final order = await appState.loadBookingPaymentOrder(
      bookingNumber: booking.bookingNumber,
      amount: booking.amount > 0 ? booking.amount : null,
    );
    if (!context.mounted) return;
    if (order == null) {
      messenger.showSnackBar(SnackBar(
          content: Text(appState.bookingError ?? 'Unable to create payment order')));
      return;
    }
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => BookingPaymentScreen(
              bookingNumber: booking.bookingNumber,
              paymentOrder: order,
              planName: booking.planName,
              durationLabel: booking.durationLabel,
            )));
    await appState.refresh();
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
    final initials = name.isNotEmpty
        ? name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase()
        : '?';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 18, 0),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF7C3AED), Color(0xFF4C1D95)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0x44D8B4FE)),
            ),
            child: Center(
              child: Text(
                initials,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _greeting,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: kMuted,
                ),
              ),
              Text(
                first.isEmpty ? 'there' : first,
                style: GoogleFonts.inter(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.5,
                  height: 1.1,
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
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: kBorder),
                  ),
                  child: const Icon(Icons.notifications_outlined,
                      color: Colors.white70, size: 20),
                ),
                if (unread > 0)
                  Positioned(
                    top: 10,
                    right: 10,
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

// ─── Premium Hero Card ────────────────────────────────────────────────────────

class _PremiumHeroCard extends StatelessWidget {
  const _PremiumHeroCard({
    required this.planName,
    required this.wifiName,
    required this.usedGb,
    required this.totalGb,
    required this.usagePct,
    required this.isOnline,
    required this.activeDays,
    required this.onBookNow,
    required this.onBookEnquiry,
  });

  final String planName, wifiName;
  final double usedGb, totalGb, usagePct;
  final bool isOnline;
  final int activeDays;
  final VoidCallback onBookNow;
  final VoidCallback onBookEnquiry;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1A0645), Color(0xFF7C2DE1)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: const Color(0x55D8B4FE)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF7C2DE1).withValues(alpha: 0.28),
            blurRadius: 36,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Decorative orbs
          Positioned(
            top: -30,
            right: -30,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.05),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            left: -40,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF7C2DE1).withValues(alpha: 0.2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status + renewal chips
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
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
                    if (activeDays > 0)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
                        ),
                        child: Text(
                          'Renews in $activeDays days',
                          style: GoogleFonts.inter(
                            color: Colors.white70,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 22),

                // Plan label
                Text(
                  'YOUR PLAN',
                  style: GoogleFonts.inter(
                    color: const Color(0xFFD8B4FE),
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 6),

                // Plan name — large
                Text(
                  planName.isEmpty ? 'No active plan' : planName,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.8,
                    height: 1.1,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),

                if (wifiName.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Icon(Icons.wifi_rounded, color: Colors.white54, size: 13),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          wifiName,
                          style: GoogleFonts.inter(color: Colors.white54, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 20),

                // Divider
                Container(
                  height: 1,
                  color: Colors.white.withValues(alpha: 0.12),
                ),

                const SizedBox(height: 16),

                // Usage row
                Row(
                  children: [
                    Text(
                      totalGb > 0
                          ? '${usedGb.toStringAsFixed(1)} GB used'
                          : 'Unlimited data',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      totalGb > 0
                          ? '${(usagePct * 100).toStringAsFixed(0)}% of ${totalGb.toStringAsFixed(0)} GB'
                          : '',
                      style: GoogleFonts.inter(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Container(
                    height: 6,
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

                const SizedBox(height: 18),

                // Action buttons row: Book (left) + Upgrade Plan (right)
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: onBookEnquiry,
                        icon: const Icon(Icons.call_rounded, size: 16),
                        label: Text(
                          'Book',
                          style: GoogleFonts.inter(
                              fontSize: 13, fontWeight: FontWeight.w800),
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: const Color(0xFF6D28D9),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onBookNow,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.45)),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(999)),
                        ),
                        child: Text(
                          planName.isEmpty ? 'Book Now' : 'Upgrade Plan',
                          style: GoogleFonts.inter(
                              fontSize: 13, fontWeight: FontWeight.w700),
                        ),
                      ),
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
}

// ─── Payment Ticket Card ──────────────────────────────────────────────────────

class _PaymentTicketCard extends StatelessWidget {
  const _PaymentTicketCard({required this.booking, required this.onPayNow});
  final BookingQuote booking;
  final VoidCallback onPayNow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0369A1), Color(0xFF0EA5E9)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0x440EA5E9)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0EA5E9).withValues(alpha: 0.25),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.schedule_rounded, color: Colors.white, size: 12),
                const SizedBox(width: 4),
                Text(
                  'Payment Pending',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            booking.planName.isNotEmpty ? booking.planName : 'Your Plan',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Booking #${booking.bookingNumber}',
            style: GoogleFonts.inter(color: Colors.white60, fontSize: 12),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Amount Due',
                      style: GoogleFonts.inter(color: Colors.white60, fontSize: 11),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      booking.amount > 0
                          ? '₹${booking.amount.toInt()}'
                          : 'Check with agent',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'Duration',
                    style: GoogleFonts.inter(color: Colors.white60, fontSize: 11),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    booking.durationLabel.isNotEmpty
                        ? booking.durationLabel
                        : '${booking.durationMonths} month',
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: booking.amount > 0 ? onPayNow : null,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0369A1),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999)),
              ),
              icon: const Icon(Icons.payment_rounded, size: 18),
              label: Text(
                booking.amount > 0
                    ? 'Pay Now  ₹${booking.amount.toInt()}'
                    : 'Pay Now',
                style:
                    GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800),
              ),
            ),
          ),
          if (booking.amount <= 0) ...[
            const SizedBox(height: 8),
            Text(
              'Payment amount will be confirmed by your sales agent.',
              style: GoogleFonts.inter(
                  color: Colors.white54, fontSize: 11, height: 1.4),
              textAlign: TextAlign.center,
            ),
          ],
        ],
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x55FBBF24)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFBBF24).withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Amount Due',
                style: GoogleFonts.inter(
                    fontSize: 11, color: kMuted, fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 3),
              Text(
                'Rs ${dueAmount.toStringAsFixed(0)}',
                style: GoogleFonts.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFFFBBF24),
                  letterSpacing: -0.5,
                ),
              ),
              if (nextBillDate.isNotEmpty)
                Text(
                  'Due ${_fmtDate(nextBillDate)}',
                  style: GoogleFonts.inter(fontSize: 11, color: kMuted),
                ),
            ],
          ),
          const Spacer(),
          FilledButton(
            onPressed: onPay,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFFBBF24),
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999)),
            ),
            child: Text(
              'Pay Now',
              style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Section Header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 16, 0),
      child: Text(
        label,
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

// ─── New User Connect Card ────────────────────────────────────────────────────

class _NewUserConnectCard extends StatelessWidget {
  const _NewUserConnectCard({required this.onBookNow, required this.onEnquiry});
  final VoidCallback onBookNow;
  final VoidCallback onEnquiry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Intro info row
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: kBorder),
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: kPrimary.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.wifi_rounded, color: kPrimary, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Get connected to JustFiber',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'High-speed fiber broadband at your doorstep.',
                      style: GoogleFonts.inter(
                          color: kMuted, fontSize: 12, height: 1.4),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Option tiles
        Container(
          decoration: BoxDecoration(
            color: kSurface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: kBorder),
          ),
          child: Column(
            children: [
              _optionTile(
                icon: Icons.add_circle_outline_rounded,
                title: 'Book new connection',
                subtitle: 'Start a new fiber broadband connection',
                onTap: onBookNow,
                topRadius: true,
              ),
              const Divider(height: 1, color: kBorder),
              _optionTile(
                icon: Icons.call_rounded,
                title: 'Quick enquiry',
                subtitle: 'Have questions? Get a callback from us',
                onTap: onEnquiry,
                bottomRadius: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        FilledButton.icon(
          onPressed: onBookNow,
          icon: const Icon(Icons.arrow_forward_rounded, size: 18),
          label: Text(
            'Book Your Connection',
            style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 15),
          ),
          style: FilledButton.styleFrom(
            backgroundColor: kPrimary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14)),
          ),
        ),
      ],
    );
  }

  Widget _optionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool topRadius = false,
    bool bottomRadius = false,
  }) {
    final radius = BorderRadius.only(
      topLeft: topRadius ? const Radius.circular(18) : Radius.zero,
      topRight: topRadius ? const Radius.circular(18) : Radius.zero,
      bottomLeft: bottomRadius ? const Radius.circular(18) : Radius.zero,
      bottomRight: bottomRadius ? const Radius.circular(18) : Radius.zero,
    );
    return InkWell(
      onTap: onTap,
      borderRadius: radius,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: kPrimary, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(subtitle,
                      style: GoogleFonts.inter(color: kMuted, fontSize: 12)),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, color: kMuted, size: 14),
          ],
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
        borderRadius: BorderRadius.circular(24),
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
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  accent.withValues(alpha: 0.22),
                  accent.withValues(alpha: 0.08),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: accent.withValues(alpha: 0.18)),
            ),
            child: Icon(icon, color: accent, size: 16),
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
