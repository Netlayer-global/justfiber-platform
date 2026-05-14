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
import '../plan_catalog_screen.dart';

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

    // Main stagger controller — 800ms total
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

    // Build staggered animations (100ms delay between each)
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
    final unread =
        appState.notifications.where((n) => n.readAt.isEmpty).length;

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
              child: _TopBar(
                name: dashboard.customerName,
              ),
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

          // ── Hero Card ──────────────────────────────────────────
          SlideTransition(
            position: _heroSlide,
            child: FadeTransition(
              opacity: _heroFade,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: appState.connections.isEmpty &&
                        appState.jazeBilling?.summary == null
                    ? _NewUserBookingSection(
                        mobile: appState.session?.mobile ?? '',
                        pendingBooking: appState.pendingPaymentBooking,
                        onViewPlans: () async {
                          await Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => const PlanCatalogScreen()));
                          await appState.refresh();
                        },
                        onBookNow: () async {
                          await Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => LeadBookingFlowScreen(
                                  initialMobile: appState.session?.mobile)));
                          await appState.refresh();
                        },
                        onPayBooking: appState.pendingPaymentBooking != null
                            ? () => _openPayBooking(context, appState, appState.pendingPaymentBooking!)
                            : null,
                      )
                    : _PremiumHeroCard(
                        planName: appState.jazeBilling?.summary
                                        ?.currentPlanName.isNotEmpty ==
                                    true
                                ? appState
                                    .jazeBilling!.summary!.currentPlanName
                                : billing.currentPlan,
                        wifiName: dashboard.wifiName,
                        usedGb: dashboard.usedGb,
                        totalGb: dashboard.totalGb,
                        usagePct: usagePct,
                        isOnline: isOnline ||
                            (appState.jazeBilling?.summary?.status ==
                                'active'),
                        activeDays: dashboard.activeDays,
                        ringAnimation: _ringProgress,
                        pulseCtrl: _pulseCtrl,
                        onUpgrade: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => const PlanCatalogScreen()),
                        ),
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

          // ── Billing Strip — only when due ─────────────────────
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

          // ── Usage Stats ───────────────────────────────────────
          SlideTransition(
            position: _statsSlide,
            child: FadeTransition(
              opacity: _statsFade,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SectionHeader(label: 'DATA & NETWORK'),
                  const SizedBox(height: 12),
                  // Premium Data Usage Card
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: _DataUsageCard(
                      usedGb: dashboard.usedGb,
                      totalGb: dashboard.totalGb,
                      usagePct: usagePct,
                      ringAnimation: _ringProgress,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Row(
                      children: [
                        Expanded(
                          child: _GlassStatTile(
                            icon: Icons.event_repeat_rounded,
                            accent: kAccentCyan,
                            label: 'Renewal In',
                            value: dashboard.activeDays > 0
                                ? '${dashboard.activeDays} days'
                                : '—',
                            sub: billing.nextBillDate.isEmpty
                                ? 'No date set'
                                : _fmtDate(billing.nextBillDate),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _GlassStatTile(
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
// ─── TOP BAR ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.name,
  });
  final String name;

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
        ? name
            .trim()
            .split(' ')
            .map((w) => w.isNotEmpty ? w[0] : '')
            .take(2)
            .join()
            .toUpperCase()
        : '?';

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 18, 0),
      child: Row(
        children: [
          // Avatar with gradient purple ring
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFA855F7), Color(0xFF6D28D9)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: kPrimary.withValues(alpha: 0.3),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: Text(
                initials,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
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
              const SizedBox(height: 2),
              Text(
                first.isEmpty ? 'there' : first,
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.6,
                  height: 1.1,
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
// ─── PREMIUM HERO CARD WITH ANIMATED RING ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _PremiumHeroCard extends StatelessWidget {
  const _PremiumHeroCard({
    required this.planName,
    required this.wifiName,
    required this.usedGb,
    required this.totalGb,
    required this.usagePct,
    required this.isOnline,
    required this.activeDays,
    required this.ringAnimation,
    required this.pulseCtrl,
    required this.onUpgrade,
  });

  final String planName, wifiName;
  final double usedGb, totalGb, usagePct;
  final bool isOnline;
  final int activeDays;
  final Animation<double> ringAnimation;
  final AnimationController pulseCtrl;
  final VoidCallback onUpgrade;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF8224E3), Color(0xFF5B10A0), Color(0xFF3D0B6E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          stops: [0.0, 0.5, 1.0],
        ),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: const Color(0x33D8B4FE)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF8224E3).withValues(alpha: 0.3),
            blurRadius: 40,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Decorative orbs for glassmorphism depth
          Positioned(
            top: -40,
            right: -40,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.06),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -60,
            left: -50,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    kPrimary.withValues(alpha: 0.15),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: 60,
            right: -20,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    kAccentCyan.withValues(alpha: 0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status chip with pulsing dot
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
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
                                              .withValues(
                                                  alpha:
                                                      0.5 * pulseCtrl.value),
                                          blurRadius: 6,
                                          spreadRadius: 1,
                                        ),
                                      ]
                                    : null,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
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
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '${activeDays}d left',
                          style: GoogleFonts.inter(
                            color: Colors.white60,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 20),

                // Plan label
                Text(
                  'YOUR PLAN',
                  style: GoogleFonts.inter(
                    color: kPrimaryLight,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 6),

                // Plan name
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

                const SizedBox(height: 24),

                // Animated Usage Ring
                if (totalGb > 0)
                  Center(
                    child: AnimatedBuilder(
                      animation: ringAnimation,
                      builder: (_, __) => SizedBox(
                        width: 140,
                        height: 140,
                        child: CustomPaint(
                          painter: _UsageRingPainter(
                            progress: usagePct * ringAnimation.value,
                            bgOpacity: 0.08,
                            strokeWidth: 6.0,
                          ),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  usedGb.toStringAsFixed(1),
                                  style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontSize: 28,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -1,
                                    height: 1.0,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'of ${totalGb.toStringAsFixed(0)} GB',
                                  style: GoogleFonts.inter(
                                    color: Colors.white54,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),

                if (totalGb <= 0)
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.all_inclusive_rounded,
                              color: kAccentCyan, size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'Unlimited Data',
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                const SizedBox(height: 20),

                // Bottom mini stat chips
                Row(
                  children: [
                    Expanded(
                      child: _MiniStatChip(
                        icon: Icons.speed_rounded,
                        label: wifiName.isNotEmpty ? wifiName : 'Wi-Fi',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MiniStatChip(
                        icon: Icons.calendar_today_rounded,
                        label: activeDays > 0
                            ? '$activeDays days'
                            : 'No expiry',
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 18),

                // Action button
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: onUpgrade,
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF6D28D9),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999)),
                      elevation: 0,
                    ),
                    child: Text(
                      planName.isEmpty ? 'View Plans' : 'Upgrade Plan',
                      style: GoogleFonts.inter(
                          fontSize: 14, fontWeight: FontWeight.w800),
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

// ─── Mini Stat Chip ───────────────────────────────────────────────────────────

class _MiniStatChip extends StatelessWidget {
  const _MiniStatChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white54, size: 14),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.inter(
                color: Colors.white70,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
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
    this.bgOpacity = 0.08,
    this.strokeWidth = 6.0,
  });

  final double progress;
  final double bgOpacity;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Background ring
    final bgPaint = Paint()
      ..color = Colors.white.withValues(alpha: bgOpacity)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, bgPaint);

    // Progress ring with gradient
    if (progress > 0) {
      final rect = Rect.fromCircle(center: center, radius: radius);
      final gradient = SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: 3 * math.pi / 2,
        colors: const [
          Color(0xFFA855F7), // purple
          Color(0xFF7C3AED), // deeper purple
          Color(0xFF22D3EE), // cyan
          Color(0xFFA855F7), // back to purple
        ],
        stops: const [0.0, 0.3, 0.7, 1.0],
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

      // Glow effect on the tip
      final tipAngle = -math.pi / 2 + sweepAngle;
      final tipX = center.dx + radius * math.cos(tipAngle);
      final tipY = center.dy + radius * math.sin(tipAngle);
      final glowPaint = Paint()
        ..color = kAccentCyan.withValues(alpha: 0.5)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
      canvas.drawCircle(Offset(tipX, tipY), strokeWidth / 2, glowPaint);
    }
  }

  @override
  bool shouldRepaint(_UsageRingPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── QUICK ACTIONS ROW ────────────────────────────────────────────────────────
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
      children: [
        Expanded(
          child: _QuickActionButton(
            icon: Icons.payment_rounded,
            label: 'Pay\nBill',
            gradient: const [Color(0xFF0891B2), Color(0xFF22D3EE)],
            onTap: onPayBill,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _QuickActionButton(
            icon: Icons.wifi_rounded,
            label: 'Wi-Fi',
            gradient: const [Color(0xFF059669), Color(0xFF10B981)],
            onTap: onWifi,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _QuickActionButton(
            icon: Icons.headset_mic_rounded,
            label: 'Support',
            gradient: const [Color(0xFFD97706), Color(0xFFF59E0B)],
            onTap: onSupport,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _QuickActionButton(
            icon: Icons.person_rounded,
            label: 'Profile',
            gradient: const [Color(0xFF7C3AED), Color(0xFFA855F7)],
            onTap: onProfile,
          ),
        ),
      ],
    );
  }
}

class _QuickActionButton extends StatelessWidget {
  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.gradient,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final List<Color> gradient;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      haptic: true,
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: kSurface2,
              shape: BoxShape.circle,
              border: Border.all(color: kBorder),
              boxShadow: [
                BoxShadow(
                  color: gradient[1].withValues(alpha: 0.12),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [
                    gradient[0].withValues(alpha: 0.15),
                    gradient[1].withValues(alpha: 0.05),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Icon(icon, color: gradient[1], size: 22),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: kMuted,
              fontSize: 10,
              fontWeight: FontWeight.w600,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── BILLING STRIP ────────────────────────────────────────────────────────────
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
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0369A1), Color(0xFF0891B2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x4422D3EE)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0891B2).withValues(alpha: 0.2),
            blurRadius: 24,
            offset: const Offset(0, 8),
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
                    fontSize: 11,
                    color: Colors.white60,
                    fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 3),
              Text(
                '₹${dueAmount.toStringAsFixed(0)}',
                style: GoogleFonts.inter(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
              if (nextBillDate.isNotEmpty)
                Text(
                  'Due ${_fmtDate(nextBillDate)}',
                  style: GoogleFonts.inter(
                      fontSize: 11, color: Colors.white54),
                ),
            ],
          ),
          const Spacer(),
          PressableScale(
            onTap: onPay,
            haptic: true,
            child: Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 22, vertical: 13),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(999),
                boxShadow: [
                  BoxShadow(
                    color: Colors.white.withValues(alpha: 0.2),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Text(
                'Pay Now',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: const Color(0xFF0369A1),
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
            color: const Color(0xFF0EA5E9).withValues(alpha: 0.2),
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
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.schedule_rounded,
                    color: Colors.white, size: 12),
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
            style:
                GoogleFonts.inter(color: Colors.white60, fontSize: 12),
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
                      style: GoogleFonts.inter(
                          color: Colors.white60, fontSize: 11),
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
                    style: GoogleFonts.inter(
                        color: Colors.white60, fontSize: 11),
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
            child: PressableScale(
              onTap: booking.amount > 0 ? onPayNow : null,
              haptic: true,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.payment_rounded,
                        size: 18, color: Color(0xFF0369A1)),
                    const SizedBox(width: 8),
                    Text(
                      booking.amount > 0
                          ? 'Pay Now  ₹${booking.amount.toInt()}'
                          : 'Pay Now',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0369A1),
                      ),
                    ),
                  ],
                ),
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DATA USAGE CARD (PREMIUM) ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _DataUsageCard extends StatelessWidget {
  const _DataUsageCard({
    required this.usedGb,
    required this.totalGb,
    required this.usagePct,
    required this.ringAnimation,
  });

  final double usedGb, totalGb, usagePct;
  final Animation<double> ringAnimation;

  @override
  Widget build(BuildContext context) {
    final isUnlimited = totalGb <= 0;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kBorder),
        boxShadow: [
          BoxShadow(
            color: kPrimary.withValues(alpha: 0.06),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          // Mini animated ring
          AnimatedBuilder(
            animation: ringAnimation,
            builder: (_, __) => SizedBox(
              width: 72,
              height: 72,
              child: CustomPaint(
                painter: _UsageRingPainter(
                  progress: isUnlimited ? 0.0 : usagePct * ringAnimation.value,
                  bgOpacity: 0.1,
                  strokeWidth: 5.0,
                ),
                child: Center(
                  child: isUnlimited
                      ? const Icon(Icons.all_inclusive_rounded, color: kAccentCyan, size: 22)
                      : Text(
                          '${(usagePct * 100 * ringAnimation.value).toStringAsFixed(0)}%',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 18),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Data Usage',
                  style: GoogleFonts.inter(
                    color: kMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isUnlimited
                      ? 'Unlimited'
                      : '${usedGb.toStringAsFixed(1)} GB used',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                  ),
                ),
                if (!isUnlimited) ...[
                  const SizedBox(height: 4),
                  Text(
                    'of ${totalGb.toStringAsFixed(0)} GB total',
                    style: GoogleFonts.inter(
                      color: kMuted,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Progress bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: AnimatedBuilder(
                      animation: ringAnimation,
                      builder: (_, __) => Container(
                        height: 4,
                        color: Colors.white.withValues(alpha: 0.08),
                        child: FractionallySizedBox(
                          alignment: Alignment.centerLeft,
                          widthFactor: (usagePct * ringAnimation.value).clamp(0.0, 1.0),
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: usagePct > 0.85
                                    ? [const Color(0xFFEF4444), const Color(0xFFF87171)]
                                    : [kPrimary, kAccentCyan],
                              ),
                              borderRadius: BorderRadius.circular(999),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
                if (isUnlimited) ...[
                  const SizedBox(height: 4),
                  Text(
                    'No data cap on your plan',
                    style: GoogleFonts.inter(color: kMuted, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── GLASS STAT TILE ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _GlassStatTile extends StatelessWidget {
  const _GlassStatTile({
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
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  accent.withValues(alpha: 0.2),
                  accent.withValues(alpha: 0.06),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: accent.withValues(alpha: 0.15)),
            ),
            child: Icon(icon, color: accent, size: 17),
          ),
          const SizedBox(height: 14),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: smallValue ? 15 : 22,
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
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Colors.white60,
            ),
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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── SECTION HEADER ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── NEW USER BOOKING SECTION (PREMIUM) ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

class _NewUserBookingSection extends StatelessWidget {
  const _NewUserBookingSection({
    required this.mobile,
    required this.pendingBooking,
    required this.onViewPlans,
    required this.onBookNow,
    this.onPayBooking,
  });

  final String mobile;
  final BookingQuote? pendingBooking;
  final VoidCallback onViewPlans;
  final VoidCallback onBookNow;
  final VoidCallback? onPayBooking;

  @override
  Widget build(BuildContext context) {
    final hasPending = pendingBooking != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── Welcome Hero Card ─────────────────────────────────────
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF8224E3), Color(0xFF5B10A0)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: const Color(0x44D8B4FE)),
            boxShadow: [
              BoxShadow(
                color: kPrimary.withValues(alpha: 0.25),
                blurRadius: 30,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          padding: const EdgeInsets.all(26),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                hasPending ? 'Almost Connected!' : 'Welcome to\nJustFiber',
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -1,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 10),
              if (mobile.isNotEmpty)
                Text(
                  'Logged in as +91 $mobile',
                  style: GoogleFonts.inter(color: Colors.white70, fontSize: 13),
                ),
              const SizedBox(height: 6),
              Text(
                hasPending
                    ? 'Complete your payment to confirm your installation booking.'
                    : 'Choose a plan and book your installation to get connected.',
                style: GoogleFonts.inter(
                  color: Colors.white54,
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // ── Payment Ticket (when pending) ─────────────────────────
        if (hasPending) ...[
          _PaymentTicketCard(
            booking: pendingBooking!,
            onPayNow: onPayBooking ?? () {},
          ),
          const SizedBox(height: 20),
        ],

        // ── Action Cards (when no pending) ────────────────────────
        if (!hasPending) ...[
          _BookingActionCard(
            icon: Icons.grid_view_rounded,
            iconColor: const Color(0xFF0EA5E9),
            title: 'View Plans',
            subtitle: 'Browse all available fiber internet plans and pricing.',
            buttonLabel: 'View Plans',
            onTap: onViewPlans,
          ),
          const SizedBox(height: 12),
          _BookingActionCard(
            icon: Icons.calendar_month_rounded,
            iconColor: const Color(0xFF10B981),
            title: 'Book Installation',
            subtitle: 'Schedule your fiber installation at a time that works for you.',
            buttonLabel: 'Book Now',
            onTap: onBookNow,
          ),
        ],
      ],
    );
  }
}

class _BookingActionCard extends StatelessWidget {
  const _BookingActionCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.buttonLabel,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title, subtitle, buttonLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: kBorder),
          boxShadow: [
            BoxShadow(
              color: iconColor.withValues(alpha: 0.06),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    iconColor.withValues(alpha: 0.22),
                    iconColor.withValues(alpha: 0.08),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: iconColor.withValues(alpha: 0.2)),
              ),
              child: Icon(icon, color: iconColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(color: kMuted, fontSize: 12, height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Icon(Icons.arrow_forward_ios_rounded, color: iconColor, size: 16),
          ],
        ),
      ),
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
      height: 42,
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
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: isSelected
                    ? kPrimary.withValues(alpha: 0.15)
                    : kSurface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: isSelected
                      ? kPrimary.withValues(alpha: 0.5)
                      : kBorder,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.router_rounded,
                    size: 14,
                    color: isSelected ? kPrimaryLight : kMuted,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    conn.address.isNotEmpty
                        ? conn.address
                        : conn.customerId,
                    style: GoogleFonts.inter(
                      color: isSelected ? Colors.white : kMuted,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (isSelected) ...[
                    const SizedBox(width: 6),
                    const Icon(Icons.check_circle_rounded,
                        color: kPrimaryLight, size: 14),
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
