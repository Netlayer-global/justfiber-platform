import 'dart:math' as math;
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
                              builder: (_) => const PublicPlanCatalogScreen()),
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
// ─── TOP BAR (Airtel style — Avatar + Hi, Name) ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _TopBar extends StatelessWidget {
  const _TopBar({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    final first = name.split(' ').first;
    final initials = name.isNotEmpty
        ? name
            .trim()
            .split(' ')
            .map((w) => w.isNotEmpty ? w[0] : '')
            .take(2)
            .join()
            .toUpperCase()
        : '?';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        children: [
          // Avatar circle
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFF16162A),
              shape: BoxShape.circle,
              border: Border.all(
                color: kPrimary.withValues(alpha: 0.4),
                width: 2,
              ),
            ),
            child: Center(
              child: Text(
                initials,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Hi,',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w400,
                  color: const Color(0xFF9CA3AF),
                ),
              ),
              Text(
                first.isEmpty ? 'there' : first,
                style: GoogleFonts.inter(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  letterSpacing: -0.3,
                  height: 1.2,
                ),
              ),
            ],
          ),
          const Spacer(),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PLAN HERO CARD (Airtel style — dark navy, status dot, expiry) ───────────
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
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8224E3), Color(0xFF5B10A0)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8224E3).withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Status row
          Row(
            children: [
              AnimatedBuilder(
                animation: pulseCtrl,
                builder: (_, __) => Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: isOnline
                        ? Color.lerp(
                            const Color(0xFF4ADE80),
                            const Color(0xFF22C55E),
                            pulseCtrl.value,
                          )
                        : const Color(0xFFEF4444),
                    shape: BoxShape.circle,
                    boxShadow: isOnline
                        ? [
                            BoxShadow(
                              color: const Color(0xFF4ADE80)
                                  .withValues(alpha: 0.4 * pulseCtrl.value),
                              blurRadius: 6,
                              spreadRadius: 1,
                            ),
                          ]
                        : null,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                isOnline ? 'Active' : 'Inactive',
                style: GoogleFonts.inter(
                  color: isOnline
                      ? const Color(0xFF4ADE80)
                      : const Color(0xFFEF4444),
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (activeDays > 0)
                Text(
                  'Expires in $activeDays days',
                  style: GoogleFonts.inter(
                    color: const Color(0xFF9CA3AF),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
            ],
          ),

          const SizedBox(height: 16),

          // Plan name — big and prominent
          Text(
            planName.isEmpty ? 'No active plan' : planName,
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              height: 1.2,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),

          if (nextBillDate.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Next billing: ${_fmtDate(nextBillDate)}',
              style: GoogleFonts.inter(
                color: const Color(0xFF6B7280),
                fontSize: 12,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],

          const SizedBox(height: 20),

          // View Plans button — white on purple
          SizedBox(
            width: double.infinity,
            child: PressableScale(
              onTap: onViewPlans,
              haptic: true,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Text(
                    'View Plans',
                    style: GoogleFonts.inter(
                      color: const Color(0xFF5B10A0),
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
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DATA USAGE CARD (Airtel style — ring + GB + speeds) ─────────────────────
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
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1E1145), Color(0xFF16162A)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF8224E3).withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              // Usage ring
              AnimatedBuilder(
                animation: ringAnimation,
                builder: (_, __) => SizedBox(
                  width: 80,
                  height: 80,
                  child: CustomPaint(
                    painter: _UsageRingPainter(
                      progress: isUnlimited
                          ? 0.0
                          : usagePct * ringAnimation.value,
                      strokeWidth: 6.0,
                    ),
                    child: Center(
                      child: isUnlimited
                          ? const Icon(Icons.all_inclusive_rounded,
                              color: Color(0xFF8224E3), size: 24)
                          : Text(
                              '${(usagePct * 100 * ringAnimation.value).toStringAsFixed(0)}%',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 20),
              // Data info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Data Used',
                      style: GoogleFonts.inter(
                        color: const Color(0xFF9CA3AF),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          isUnlimited
                              ? '∞'
                              : usedGb.toStringAsFixed(1),
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -1,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          isUnlimited
                              ? 'Unlimited'
                              : 'of ${totalGb.toStringAsFixed(0)} GB',
                          style: GoogleFonts.inter(
                            color: const Color(0xFF6B7280),
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Speed row
          if (downloadMbps > 0 || uploadMbps > 0) ...[
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFF0C0C18),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  // Download
                  const Icon(Icons.arrow_downward_rounded,
                      color: Color(0xFF10B981), size: 14),
                  const SizedBox(width: 6),
                  Text(
                    '$downloadMbps',
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    ' Mbps',
                    style: GoogleFonts.inter(
                      color: const Color(0xFF6B7280),
                      fontSize: 11,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    width: 1,
                    height: 20,
                    color: const Color(0xFF2D2D44),
                  ),
                  const Spacer(),
                  // Upload
                  const Icon(Icons.arrow_upward_rounded,
                      color: Color(0xFF22D3EE), size: 14),
                  const SizedBox(width: 6),
                  Text(
                    '$uploadMbps',
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    ' Mbps',
                    style: GoogleFonts.inter(
                      color: const Color(0xFF6B7280),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ─── USAGE RING CUSTOM PAINTER ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _UsageRingPainter extends CustomPainter {
  _UsageRingPainter({
    required this.progress,
    this.strokeWidth = 6.0,
  });

  final double progress;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Background ring — subtle
    final bgPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, bgPaint);

    // Progress ring — purple gradient
    if (progress > 0) {
      final rect = Rect.fromCircle(center: center, radius: radius);
      final gradient = SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: 3 * math.pi / 2,
        colors: const [
          Color(0xFFA855F7),
          Color(0xFF8224E3),
          Color(0xFFA855F7),
        ],
        stops: const [0.0, 0.5, 1.0],
        transform: const GradientRotation(-math.pi / 2),
      );

      final progressPaint = Paint()
        ..shader = gradient.createShader(rect)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      final sweepAngle = 2 * math.pi * progress;
      canvas.drawArc(
        rect,
        -math.pi / 2,
        sweepAngle,
        false,
        progressPaint,
      );
    }
  }

  @override
  bool shouldRepaint(_UsageRingPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── QUICK ACTIONS ROW (Airtel style — small subtle circles) ─────────────────
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
          icon: Icons.payment_rounded,
          label: 'Pay Bill',
          color: const Color(0xFF0EA5E9),
          onTap: onPayBill,
        ),
        _QuickActionItem(
          icon: Icons.wifi_rounded,
          label: 'Wi-Fi',
          color: const Color(0xFF10B981),
          onTap: onWifi,
        ),
        _QuickActionItem(
          icon: Icons.headset_mic_rounded,
          label: 'Support',
          color: const Color(0xFFF59E0B),
          onTap: onSupport,
        ),
        _QuickActionItem(
          icon: Icons.person_rounded,
          label: 'Profile',
          color: const Color(0xFFA855F7),
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
    required this.color,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      haptic: true,
      child: Column(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [color, color.withValues(alpha: 0.7)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, color: Colors.white, size: 22),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: GoogleFonts.inter(
              color: Colors.white70,
              fontSize: 11,
              fontWeight: FontWeight.w500,
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
                    color: const Color(0xFF9CA3AF),
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
                      color: const Color(0xFF6B7280),
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
        color: const Color(0xFF16162A),
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
              color: const Color(0xFF6B7280),
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
                        color: const Color(0xFF6B7280),
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
                      color: const Color(0xFF6B7280),
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
              onTap: booking.amount > 0 ? onPayNow : null,
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
          if (booking.amount <= 0) ...[
            const SizedBox(height: 8),
            Text(
              'Amount will be confirmed by your sales agent.',
              style: GoogleFonts.inter(
                color: const Color(0xFF6B7280),
                fontSize: 11,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
          ],
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
            colors: [Color(0xFF1E1145), Color(0xFF16162A)],
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
                color: const Color(0xFF6B7280),
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
          colors: [Color(0xFF1E1145), Color(0xFF16162A)],
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
                    color: const Color(0xFF6B7280),
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
              color: const Color(0xFF9CA3AF),
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
            color: const Color(0xFF16162A),
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
                    color: const Color(0xFF9CA3AF),
                    fontSize: 13,
                  ),
                ),
              const SizedBox(height: 6),
              Text(
                hasPending
                    ? 'Complete your payment to confirm your installation.'
                    : 'Choose a plan and book your installation to get connected.',
                style: GoogleFonts.inter(
                  color: const Color(0xFF6B7280),
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
                    : const Color(0xFF16162A),
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
                        : const Color(0xFF6B7280),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    conn.address.isNotEmpty
                        ? conn.address
                        : conn.customerId,
                    style: GoogleFonts.inter(
                      color: isSelected
                          ? Colors.white
                          : const Color(0xFF9CA3AF),
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
