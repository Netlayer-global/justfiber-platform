import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/pressable_scale.dart';
import '../billing_payment_screen.dart';
import '../booking_enquiry_screen.dart';
import '../booking_payment_screen.dart';
import '../lead_booking_flow_screen.dart';
import '../notifications_screen.dart';
import '../plan_catalog_screen.dart';
import '../public_plan_catalog_screen.dart';

class HomeTab extends StatefulWidget {
  const HomeTab({super.key, required this.onNavigate});
  final ValueChanged<int> onNavigate;

  @override
  State<HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<HomeTab> with TickerProviderStateMixin {
  late final AnimationController _staggerCtrl;
  late final AnimationController _ringCtrl;
  late final AnimationController _pulseCtrl;

  // Staggered section animations
  late final Animation<double> _topBarFade;
  late final Animation<Offset> _topBarSlide;
  late final Animation<double> _connectionFade;
  late final Animation<Offset> _connectionSlide;
  late final Animation<double> _heroFade;
  late final Animation<Offset> _heroSlide;
  late final Animation<double> _quickActionsFade;
  late final Animation<Offset> _quickActionsSlide;
  late final Animation<double> _billingFade;
  late final Animation<Offset> _billingSlide;
  late final Animation<double> _statsFade;
  late final Animation<Offset> _statsSlide;

  // Ring animation
  late final Animation<double> _ringProgress;

  @override
  void initState() {
    super.initState();

    // Main stagger controller — 900ms total
    _staggerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    // Ring fill controller — 1.2s
    _ringCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    // Pulse controller for status dot
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _ringProgress = CurvedAnimation(
      parent: _ringCtrl,
      curve: Curves.easeOutCubic,
    );

    // Build staggered animations
    _topBarFade = _buildFade(0.0, 0.35);
    _topBarSlide = _buildSlide(0.0, 0.35);
    _connectionFade = _buildFade(0.1, 0.45);
    _connectionSlide = _buildSlide(0.1, 0.45);
    _heroFade = _buildFade(0.2, 0.55);
    _heroSlide = _buildSlide(0.2, 0.55);
    _quickActionsFade = _buildFade(0.35, 0.7);
    _quickActionsSlide = _buildSlide(0.35, 0.7);
    _billingFade = _buildFade(0.5, 0.85);
    _billingSlide = _buildSlide(0.5, 0.85);
    _statsFade = _buildFade(0.6, 1.0);
    _statsSlide = _buildSlide(0.6, 1.0);

    _staggerCtrl.forward();
    _ringCtrl.forward();
  }

  Animation<double> _buildFade(double begin, double end) {
    return CurvedAnimation(
      parent: _staggerCtrl,
      curve: Interval(begin, end, curve: Curves.easeOut),
    );
  }

  Animation<Offset> _buildSlide(double begin, double end) {
    return Tween<Offset>(
      begin: const Offset(0, 0.08),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _staggerCtrl,
      curve: Interval(begin, end, curve: Curves.easeOutCubic),
    ));
  }

  @override
  void dispose() {
    _staggerCtrl.dispose();
    _ringCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

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

    return RefreshIndicator(
      onRefresh: appState.refresh,
      color: kPrimary,
      backgroundColor: kSurface,
      child: ListView(
        padding: EdgeInsets.only(
          top: MediaQuery.of(context).padding.top + 8,
          bottom: 120,
        ),
        children: [
          // ── Top Bar ──────────────────────────────────────────────
          SlideTransition(
            position: _topBarSlide,
            child: FadeTransition(
              opacity: _topBarFade,
              child: _TopBar(name: dashboard.customerName),
            ),
          ),

          const SizedBox(height: 20),

          // ── Connection Switcher (when multiple connections) ─────
          if (appState.connections.length > 1)
            SlideTransition(
              position: _connectionSlide,
              child: FadeTransition(
                opacity: _connectionFade,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
                  child: _ConnectionSwitcher(
                    connections: appState.connections,
                    selectedId: appState.selectedCustomerId,
                    onSwitch: (id) => appState.selectConnection(id),
                  ),
                ),
              ),
            ),

          // ── Plan Hero Card ─────────────────────────────────────
          SlideTransition(
            position: _heroSlide,
            child: FadeTransition(
              opacity: _heroFade,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: appState.connections.isEmpty &&
                        appState.jazeBilling?.summary == null
                    ? _NewUserSection(
                        mobile: appState.session?.mobile ?? '',
                        pendingBooking: appState.pendingPaymentBooking,
                        onViewPlans: () async {
                          await Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => const PublicPlanCatalogScreen()));
                          await appState.refresh();
                        },
                        onBookNow: () async {
                          await Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => LeadBookingFlowScreen(
                                  initialMobile: appState.session?.mobile)));
                          await appState.refresh();
                        },
                        onPayBooking: appState.pendingPaymentBooking != null
                            ? () => _openPayBooking(
                                context, appState, appState.pendingPaymentBooking!)
                            : null,
                        pulseCtrl: _pulseCtrl,
                      )
                    : _PlanHeroCard(
                        planName: appState.jazeBilling?.summary
                                        ?.currentPlanName.isNotEmpty ==
                                    true
                                ? appState.jazeBilling!.summary!.currentPlanName
                                : billing.currentPlan,
                        isOnline: isOnline ||
                            (appState.jazeBilling?.summary?.status == 'active'),
                        activeDays: dashboard.activeDays,
                        nextBillDate: billing.nextBillDate,
                        pulseCtrl: _pulseCtrl,
                        onViewPlans: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => const PlanCatalogScreen()),
                        ),
                      ),
              ),
            ),
          ),

          const SizedBox(height: 16),

          // ── Data Usage Card ────────────────────────────────────
          if (appState.connections.isNotEmpty ||
              appState.jazeBilling?.summary != null)
            SlideTransition(
              position: _heroSlide,
              child: FadeTransition(
                opacity: _heroFade,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: _DataUsageCard(
                    usedGb: dashboard.usedGb,
                    totalGb: dashboard.totalGb,
                    usagePct: usagePct,
                    ringAnimation: _ringProgress,
                    downloadMbps:
                        appState.jazeBilling?.summary?.downloadMbps ?? 0,
                    uploadMbps:
                        appState.jazeBilling?.summary?.uploadMbps ?? 0,
                  ),
                ),
              ),
            ),

          const SizedBox(height: 20),

          // ── Quick Actions ──────────────────────────────────────
          SlideTransition(
            position: _quickActionsSlide,
            child: FadeTransition(
              opacity: _quickActionsFade,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: _QuickActionsRow(
                  onPayBill: () => _openPayBill(context, appState),
                  onWifi: () => widget.onNavigate(2),
                  onSupport: () => widget.onNavigate(3),
                  onProfile: () => widget.onNavigate(4),
                ),
              ),
            ),
          ),

          const SizedBox(height: 20),

          // ── Pending Payment Booking ────────────────────────────
          if (appState.pendingPaymentBooking != null) ...[
            SlideTransition(
              position: _billingSlide,
              child: FadeTransition(
                opacity: _billingFade,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: _PaymentTicketCard(
                    booking: appState.pendingPaymentBooking!,
                    onPayNow: () => _openPayBooking(
                        context, appState, appState.pendingPaymentBooking!),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
          ],

          // ── Billing Due Strip ─────────────────────────────────
          if (billing.hasActionableDue) ...[
            SlideTransition(
              position: _billingSlide,
              child: FadeTransition(
                opacity: _billingFade,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: _BillingStrip(
                    dueAmount: billing.actionableDueAmount,
                    nextBillDate: billing.nextBillDate,
                    onPay: () => _openPayBill(context, appState),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],

          // ── Get Started Section ────────────────────────────────
          SlideTransition(
            position: _billingSlide,
            child: FadeTransition(
              opacity: _billingFade,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(left: 2, bottom: 12),
                      child: Text(
                        'GET STARTED',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: kMuted,
                          letterSpacing: 1.6,
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: _GetStartedCard(
                            icon: Icons.grid_view_rounded,
                            title: 'View Plans',
                            subtitle: 'Browse plans',
                            onTap: () async {
                              await Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) =>
                                          const PublicPlanCatalogScreen()));
                              await appState.refresh();
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _GetStartedCard(
                            icon: Icons.calendar_month_rounded,
                            title: 'Book Install',
                            subtitle: 'Schedule setup',
                            onTap: () async {
                              await Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) => LeadBookingFlowScreen(
                                          initialMobile:
                                              appState.session?.mobile)));
                              await appState.refresh();
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),

          const SizedBox(height: 20),

          // ── Stats Row ─────────────────────────────────────────
          SlideTransition(
            position: _statsSlide,
            child: FadeTransition(
              opacity: _statsFade,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Row(
                  children: [
                    Expanded(
                      child: _StatTile(
                        icon: Icons.event_repeat_rounded,
                        label: 'Renewal In',
                        value: dashboard.activeDays > 0
                            ? '${dashboard.activeDays}'
                            : '—',
                        unit: dashboard.activeDays > 0 ? 'days' : '',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _StatTile(
                        icon: Icons.devices_rounded,
                        label: 'Devices',
                        value: appState.connectedDevices.isEmpty
                            ? '—'
                            : '${appState.connectedDevices.length}',
                        unit: 'connected',
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

  Future<void> _openPayBill(BuildContext context, AppState appState) async {
    final messenger = ScaffoldMessenger.of(context);
    final order = await appState.loadBillingPaymentOrder();
    if (!context.mounted) return;
    if (order == null) {
      messenger.showSnackBar(SnackBar(
          content:
              Text(appState.error ?? 'Unable to create payment order')));
      return;
    }
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => BillingPaymentScreen(paymentOrder: order)));
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
          content: Text(
              appState.bookingError ?? 'Unable to create payment order')));
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


// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// ─── TOP BAR (Modern Glass) ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _TopBar extends StatelessWidget {
  const _TopBar({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    final first = name.split(' ').first;
    final initials = name.isNotEmpty
        ? name.trim().split(' ').map((w) => w.isNotEmpty ? w[0] : '').take(2).join().toUpperCase()
        : '?';

    return Container(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 16),
      child: Row(
        children: [
          // Sleek dark avatar container
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFF1E1E1E), // Charcoal
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Center(
              child: Text(
                initials,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome back',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF6B7280), // Gray 500
                ),
              ),
              Text(
                first.isEmpty ? 'Guest' : first,
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.5,
                  height: 1.2,
                ),
              ),
            ],
          ),
          const Spacer(),
          // Action button (like the screenshot's top-right elements)
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFF1E1E1E),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: const Icon(Icons.notifications_none_rounded, color: Colors.white, size: 22),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PLAN HERO CARD (Modern Mesh & Glass) ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _PlanHeroCard extends StatelessWidget {
  const _PlanHeroCard({
    required this.planName,
    required this.isOnline,
    required this.activeDays,
    required this.nextBillDate,
    required this.pulseCtrl,
    required this.onViewPlans,
  });

  final String planName;
  final bool isOnline;
  final int activeDays;
  final String nextBillDate;
  final AnimationController pulseCtrl;
  final VoidCallback onViewPlans;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E), // Dark Charcoal
        borderRadius: BorderRadius.circular(40), // Very high border radius
        border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 30,
            offset: const Offset(0, 20),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sleek minimalist status indicator
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF2A2A2A),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isOnline ? const Color(0xFF8224E3) : const Color(0xFFEF4444), // Primary Purple or Red
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isOnline ? 'Connected' : 'Offline',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              if (activeDays > 0)
                Text(
                  '$activeDays days left',
                  style: GoogleFonts.inter(
                    color: const Color(0xFF6B7280),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
            ],
          ),

          const SizedBox(height: 32),

          Text(
            'Current Plan',
            style: GoogleFonts.inter(
              color: const Color(0xFF6B7280),
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          // Large typography
          Text(
            planName.isEmpty ? 'No active plan' : planName,
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 34,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
              height: 1.1,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),

          if (nextBillDate.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Renews ${_fmtDate(nextBillDate)}',
              style: GoogleFonts.inter(
                color: const Color(0xFF6B7280),
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],

          const SizedBox(height: 32),

          // High-contrast primary color button
          SizedBox(
            width: double.infinity,
            child: PressableScale(
              onTap: onViewPlans,
              haptic: true,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: BoxDecoration(
                  color: const Color(0xFF8224E3), // User's requested primary color
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Center(
                  child: Text(
                    'Upgrade Plan',
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DATA USAGE CARD (Modern Glass Layout) ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _DataUsageCard extends StatelessWidget {
  const _DataUsageCard({
    required this.usedGb,
    required this.totalGb,
    required this.usagePct,
    required this.ringAnimation,
    this.downloadMbps = 0,
    this.uploadMbps = 0,
  });

  final double usedGb, totalGb, usagePct;
  final Animation<double> ringAnimation;
  final int downloadMbps;
  final int uploadMbps;

  @override
  Widget build(BuildContext context) {
    final isUnlimited = totalGb <= 0;

    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E), // Dark Charcoal
        borderRadius: BorderRadius.circular(40),
        border: Border.all(color: Colors.white.withValues(alpha: 0.03)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              // Clean technical Usage ring
              AnimatedBuilder(
                animation: ringAnimation,
                builder: (_, __) => SizedBox(
                  width: 90,
                  height: 90,
                  child: CustomPaint(
                    painter: _UsageRingPainter(
                      progress: isUnlimited ? 0.0 : usagePct * ringAnimation.value,
                      strokeWidth: 10.0, // Thicker stroke
                    ),
                    child: Center(
                      child: isUnlimited
                          ? const Icon(Icons.all_inclusive_rounded, color: Color(0xFF8224E3), size: 28)
                          : Text(
                              '${(usagePct * 100 * ringAnimation.value).toStringAsFixed(0)}%',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 24),
              // Data info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Data Consumption',
                      style: GoogleFonts.inter(
                        color: const Color(0xFF6B7280),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          isUnlimited ? '∞' : usedGb.toStringAsFixed(1),
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 36,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1.5,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          isUnlimited ? 'Unlimited' : 'GB',
                          style: GoogleFonts.inter(
                            color: const Color(0xFF6B7280),
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    if (!isUnlimited) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Total ${totalGb.toStringAsFixed(0)} GB',
                        style: GoogleFonts.inter(
                          color: const Color(0xFF6B7280),
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),

          // Speed row
          if (downloadMbps > 0 || uploadMbps > 0) ...[
            const SizedBox(height: 28),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: const Color(0xFF141414), // Even darker for contrast
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  // Download
                  _SpeedWidget(icon: Icons.download_rounded, color: const Color(0xFF8224E3), value: downloadMbps, label: 'Down'),
                  Container(width: 1, height: 30, color: const Color(0xFF2A2A2A)),
                  // Upload
                  _SpeedWidget(icon: Icons.upload_rounded, color: const Color(0xFF8224E3), value: uploadMbps, label: 'Up'),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SpeedWidget extends StatelessWidget {
  const _SpeedWidget({required this.icon, required this.color, required this.value, required this.label});
  final IconData icon;
  final Color color;
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: const BoxDecoration(
            color: Color(0xFF1E1E1E),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: color, size: 16),
        ),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$value Mbps',
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              label,
              style: GoogleFonts.inter(
                color: const Color(0xFF6B7280),
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── USAGE RING CUSTOM PAINTER (Clean Flat) ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _UsageRingPainter extends CustomPainter {
  _UsageRingPainter({required this.progress, this.strokeWidth = 10.0});
  final double progress;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Background ring — solid dark grey
    final bgPaint = Paint()
      ..color = const Color(0xFF2A2A2A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, bgPaint);

    // Progress ring — Primary Purple
    if (progress > 0) {
      final rect = Rect.fromCircle(center: center, radius: radius);

      final progressPaint = Paint()
        ..color = const Color(0xFF8224E3)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      final sweepAngle = 2 * math.pi * progress;
      canvas.drawArc(rect, -math.pi / 2, sweepAngle, false, progressPaint); // Solid ring
    }
  }

  @override
  bool shouldRepaint(_UsageRingPainter oldDelegate) => oldDelegate.progress != progress;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── QUICK ACTIONS ROW (Modern Glass Tiles) ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _QuickActionsRow extends StatelessWidget {
  const _QuickActionsRow({
    required this.onPayBill,
    required this.onWifi,
    required this.onSupport,
    required this.onProfile,
  });

  final VoidCallback onPayBill;
  final VoidCallback onWifi;
  final VoidCallback onSupport;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _QuickActionItem(
          icon: Icons.account_balance_wallet_rounded,
          label: 'Pay',
          onTap: onPayBill,
        ),
        _QuickActionItem(
          icon: Icons.wifi_rounded,
          label: 'Wi-Fi',
          onTap: onWifi,
        ),
        _QuickActionItem(
          icon: Icons.support_agent_rounded,
          label: 'Support',
          onTap: onSupport,
        ),
        _QuickActionItem(
          icon: Icons.person_rounded,
          label: 'Profile',
          onTap: onProfile,
        ),
      ],
    );
  }
}

class _QuickActionItem extends StatelessWidget {
  const _QuickActionItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      haptic: true,
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: const Color(0xFF1E1E1E), // Solid dark charcoal
              borderRadius: BorderRadius.circular(24), // High border radius, almost circular
              border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
            ),
            child: Center(
              child: Icon(icon, color: Colors.white, size: 26),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            label,
            style: GoogleFonts.inter(
              color: const Color(0xFF9CA3AF),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BILLING STRIP (Airtel style — accent colored) ───────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

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
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFF8224E3).withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFF8224E3).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          // Amount info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Amount Due',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: const Color(0xFFB8C0CC),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '₹${dueAmount.toStringAsFixed(0)}',
                  style: GoogleFonts.inter(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                if (nextBillDate.isNotEmpty)
                  Text(
                    'Due ${_fmtDate(nextBillDate)}',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: const Color(0xFFB8C0CC),
                    ),
                  ),
              ],
            ),
          ),
          // Pay Now button
          PressableScale(
            onTap: onPay,
            haptic: true,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF8224E3),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                'Pay Now',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PAYMENT TICKET CARD ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _PaymentTicketCard extends StatelessWidget {
  const _PaymentTicketCard({required this.booking, required this.onPayNow});
  final BookingQuote booking;
  final VoidCallback onPayNow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1845),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFF8224E3).withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF8224E3).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.schedule_rounded,
                    color: Color(0xFFA855F7), size: 12),
                const SizedBox(width: 4),
                Text(
                  'Payment Pending',
                  style: GoogleFonts.inter(
                    color: const Color(0xFFA855F7),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(
            booking.planName.isNotEmpty ? booking.planName : 'Your Plan',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Booking #${booking.bookingNumber}',
            style: GoogleFonts.inter(
              color: const Color(0xFFB8C0CC),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Amount',
                      style: GoogleFonts.inter(
                        color: const Color(0xFFB8C0CC),
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      booking.amount > 0
                          ? '₹${booking.amount.toInt()}'
                          : 'TBD',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
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
                    style: GoogleFonts.inter(
                      color: const Color(0xFFB8C0CC),
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    booking.durationLabel.isNotEmpty
                        ? booking.durationLabel
                        : '${booking.durationMonths} month',
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          // Pay button
          SizedBox(
            width: double.infinity,
            child: PressableScale(
              onTap: onPayNow,
              haptic: true,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFF8224E3),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    booking.amount > 0
                        ? 'Pay Now  ₹${booking.amount.toInt()}'
                        : 'Pay Now',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ─── GET STARTED CARDS (Airtel style — clean dark navy) ──────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _GetStartedCard extends StatelessWidget {
  const _GetStartedCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      haptic: true,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF2A1B5E), Color(0xFF1E1845)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF8224E3).withValues(alpha: 0.25)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [const Color(0xFF8224E3), const Color(0xFF8224E3).withValues(alpha: 0.6)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: Colors.white, size: 20),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: GoogleFonts.inter(
                color: const Color(0xFFB8C0CC),
                fontSize: 11,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── STAT TILE (Airtel style — small info tiles) ─────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.unit,
  });

  final IconData icon;
  final String label, value, unit;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2A1B5E), Color(0xFF1E1845)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF8224E3).withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFFA855F7), size: 18),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: GoogleFonts.inter(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -0.5,
                  height: 1.0,
                ),
              ),
              if (unit.isNotEmpty) ...[
                const SizedBox(width: 4),
                Text(
                  unit,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: const Color(0xFFB8C0CC),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: const Color(0xFFB8C0CC),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NEW USER SECTION (when no connections) ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _NewUserSection extends StatelessWidget {
  const _NewUserSection({
    required this.mobile,
    required this.pendingBooking,
    required this.onViewPlans,
    required this.onBookNow,
    this.onPayBooking,
    required this.pulseCtrl,
  });

  final String mobile;
  final BookingQuote? pendingBooking;
  final VoidCallback onViewPlans;
  final VoidCallback onBookNow;
  final VoidCallback? onPayBooking;
  final AnimationController pulseCtrl;

  @override
  Widget build(BuildContext context) {
    final hasPending = pendingBooking != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Welcome card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF1E1845),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                hasPending ? 'Almost Connected!' : 'Welcome to JustFiber',
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                  height: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              if (mobile.isNotEmpty)
                Text(
                  'Logged in as +91 $mobile',
                  style: GoogleFonts.inter(
                    color: const Color(0xFFB8C0CC),
                    fontSize: 13,
                  ),
                ),
              const SizedBox(height: 6),
              Text(
                hasPending
                    ? 'Complete your payment to confirm your installation.'
                    : 'Choose a plan and book your installation to get connected.',
                style: GoogleFonts.inter(
                  color: const Color(0xFFB8C0CC),
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 20),
              // CTA button
              if (!hasPending)
                SizedBox(
                  width: double.infinity,
                  child: PressableScale(
                    onTap: onViewPlans,
                    haptic: true,
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8224E3),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: Text(
                          'View Plans',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),

        // Payment ticket if pending
        if (hasPending) ...[
          const SizedBox(height: 16),
          _PaymentTicketCard(
            booking: pendingBooking!,
            onPayNow: onPayBooking ?? () {},
          ),
        ],
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── CONNECTION SWITCHER ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _ConnectionSwitcher extends StatelessWidget {
  const _ConnectionSwitcher({
    required this.connections,
    required this.selectedId,
    required this.onSwitch,
  });

  final List<CustomerConnection> connections;
  final String? selectedId;
  final ValueChanged<String> onSwitch;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: connections.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final conn = connections[i];
          final isSelected = conn.customerId == selectedId;
          return PressableScale(
            onTap: () {
              if (!isSelected) onSwitch(conn.customerId);
            },
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              decoration: BoxDecoration(
                color: isSelected
                    ? const Color(0xFF8224E3).withValues(alpha: 0.15)
                    : const Color(0xFF1E1845),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: isSelected
                      ? const Color(0xFF8224E3).withValues(alpha: 0.5)
                      : const Color(0xFF2D2D44),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.router_rounded,
                    size: 14,
                    color: isSelected
                        ? const Color(0xFFA855F7)
                        : const Color(0xFFB8C0CC),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    conn.address.isNotEmpty
                        ? conn.address
                        : conn.customerId,
                    style: GoogleFonts.inter(
                      color: isSelected
                          ? Colors.white
                          : const Color(0xFFB8C0CC),
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (isSelected) ...[
                    const SizedBox(width: 6),
                    const Icon(Icons.check_circle_rounded,
                        color: Color(0xFFA855F7), size: 14),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── UTILITIES ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

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
