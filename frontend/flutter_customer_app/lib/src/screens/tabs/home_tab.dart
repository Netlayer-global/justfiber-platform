import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/pressable_scale.dart';
import '../billing_payment_screen.dart';
import '../booking_payment_screen.dart';
import '../lead_booking_flow_screen.dart';
import '../plan_catalog_screen.dart';
import '../public_plan_catalog_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  HOME TAB — JustFiber Design System (see /design-system/MASTER.md)
//  Pure black canvas, translucent surfaces, single purple accent, big type.
// ─────────────────────────────────────────────────────────────────────────────

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
  late final Animation<double> _ringProgress;

  @override
  void initState() {
    super.initState();
    _staggerCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..forward();
    _ringCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..forward();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _ringProgress = CurvedAnimation(parent: _ringCtrl, curve: Curves.easeOutCubic);
  }

  @override
  void dispose() {
    _staggerCtrl.dispose();
    _ringCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Animation<double> _fade(double s, double e) => CurvedAnimation(
        parent: _staggerCtrl,
        curve: Interval(s, e, curve: Curves.easeOut),
      );

  Animation<Offset> _slide(double s, double e) => Tween<Offset>(
        begin: const Offset(0, 0.06),
        end: Offset.zero,
      ).animate(CurvedAnimation(
        parent: _staggerCtrl,
        curve: Interval(s, e, curve: Curves.easeOutCubic),
      ));

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final billing = appState.billing;
    final usagePct = dashboard.totalGb > 0
        ? (dashboard.usedGb / dashboard.totalGb).clamp(0.0, 1.0)
        : 0.0;
    final isOnline =
        dashboard.serviceStatus.toLowerCase().contains('active') ||
            dashboard.serviceStatus.isEmpty;
    final isNewUser =
        appState.connections.isEmpty && appState.jazeBilling?.summary == null;

    return RefreshIndicator(
      onRefresh: appState.refresh,
      color: kAccent,
      backgroundColor: const Color(0xFF0A0A14),
      child: ListView(
        padding: EdgeInsets.only(
          top: MediaQuery.of(context).padding.top + 16,
          bottom: 140,
        ),
        children: [
          // ── Top Bar ─────────────────────────────────────────
          SlideTransition(
            position: _slide(0.0, 0.35),
            child: FadeTransition(
              opacity: _fade(0.0, 0.35),
              child: _TopBar(name: dashboard.customerName),
            ),
          ),
          const SizedBox(height: 20),

          // ── Connection switcher ───────────────────────────────
          if (appState.connections.length > 1)
            SlideTransition(
              position: _slide(0.1, 0.45),
              child: FadeTransition(
                opacity: _fade(0.1, 0.45),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 0, 22, 16),
                  child: _ConnectionSwitcher(
                    connections: appState.connections,
                    selectedId: appState.selectedCustomerId,
                    onSwitch: (id) => appState.selectConnection(id),
                  ),
                ),
              ),
            ),

          // ── Plan hero card (full-bleed accent gradient + glassy panel) ─
          SlideTransition(
            position: _slide(0.15, 0.5),
            child: FadeTransition(
              opacity: _fade(0.15, 0.5),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: isNewUser
                    ? _NewUserHero(
                        mobile: appState.session?.mobile ?? '',
                        pendingBooking: appState.pendingPaymentBooking,
                        pulseCtrl: _pulseCtrl,
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
                            ? () => _openPayBooking(context, appState,
                                appState.pendingPaymentBooking!)
                            : null,
                      )
                    : _PlanHero(
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
                        onUpgrade: () => Navigator.of(context).push(
                          MaterialPageRoute(
                              builder: (_) => const PlanCatalogScreen()),
                        ),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 22),

          // ── Data usage card (translucent surface, accent ring) ─────
          if (!isNewUser)
            SlideTransition(
              position: _slide(0.25, 0.6),
              child: FadeTransition(
                opacity: _fade(0.25, 0.6),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  child: _DataUsageCard(
                    usedGb: dashboard.usedGb,
                    totalGb: dashboard.totalGb,
                    usagePct: usagePct,
                    ringAnimation: _ringProgress,
                    daysLeft: dashboard.activeDays,
                  ),
                ),
              ),
            ),
          if (!isNewUser) const SizedBox(height: 22),

          // ── Banner carousel (auto-scroll offers) ──────────────
          if (appState.banners.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 22),
              child: _BannerCarousel(
                banners: appState.banners,
                onTap: (banner) => _handleBannerTap(context, appState, banner),
              ),
            ),

          // ── Pending payment booking ───────────────────────────
          if (appState.pendingPaymentBooking != null) ...[
            SlideTransition(
              position: _slide(0.4, 0.75),
              child: FadeTransition(
                opacity: _fade(0.4, 0.75),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  child: _PaymentTicketCard(
                    booking: appState.pendingPaymentBooking!,
                    onPayNow: () => _openPayBooking(
                        context, appState, appState.pendingPaymentBooking!),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 22),
          ],

          // ── Billing due (translucent + accent text, NOT a colored block) ─
          if (billing.hasActionableDue) ...[
            SlideTransition(
              position: _slide(0.4, 0.75),
              child: FadeTransition(
                opacity: _fade(0.4, 0.75),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  child: _BillingDueRow(
                    dueAmount: billing.actionableDueAmount,
                    nextBillDate: billing.nextBillDate,
                    onPay: () => _openPayBill(context, appState),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 28),
          ],

          // ── Explore section — two modern pill buttons ──────
          SlideTransition(
            position: _slide(0.5, 0.85),
            child: FadeTransition(
              opacity: _fade(0.5, 0.85),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: Row(
                  children: [
                    Expanded(
                      child: PressableScale(
                        onTap: () async {
                          await Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) =>
                                      const PublicPlanCatalogScreen()));
                          await appState.refresh();
                        },
                        haptic: true,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          decoration: BoxDecoration(
                            color: kAccent,
                            borderRadius: BorderRadius.circular(kRButton),
                            boxShadow: [
                              BoxShadow(
                                color: kAccent.withValues(alpha: 0.4),
                                blurRadius: 14,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Center(
                            child: Text(
                              'View Plans',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: PressableScale(
                        onTap: () async {
                          await Navigator.of(context).push(
                              MaterialPageRoute(
                                  builder: (_) => LeadBookingFlowScreen(
                                      initialMobile:
                                          appState.session?.mobile)));
                          await appState.refresh();
                        },
                        haptic: true,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(kRButton),
                            border: Border.all(color: kBorderSoft),
                          ),
                          child: Center(
                            child: Text(
                              'Book Install',
                              style: GoogleFonts.inter(
                                color: kText,
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ),
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

  // ─── Actions ─────────────────────────────────────────────────────────────
  void _handleBannerTap(
      BuildContext context, AppState appState, AppBannerItem banner) {
    switch (banner.targetType) {
      case 'plans':
        Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const PublicPlanCatalogScreen()));
        break;
      case 'billing':
        widget.onNavigate(1);
        break;
      case 'support':
        widget.onNavigate(3);
        break;
      default:
        // No action for unknown target types
        break;
    }
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

// ═══════════════════════════════════════════════════════════════════════════
//  TOP BAR — time-based greeting + name (no avatar, no notification icon)
// ═══════════════════════════════════════════════════════════════════════════

class _TopBar extends StatelessWidget {
  const _TopBar({required this.name});
  final String name;

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final first = name.split(' ').first;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _greeting(),
            style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: kTextMuted,
              letterSpacing: 0.2,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            first.isEmpty ? 'Guest' : first,
            style: GoogleFonts.inter(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: kText,
              letterSpacing: -0.6,
              height: 1.1,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
//  PLAN HERO — Premium: brand mark + glassy info strip
// ═══════════════════════════════════════════════════════════════════════════

class _PlanHero extends StatefulWidget {
  const _PlanHero({
    required this.planName,
    required this.isOnline,
    required this.activeDays,
    required this.nextBillDate,
    required this.pulseCtrl,
    required this.onUpgrade,
  });

  final String planName;
  final bool isOnline;
  final int activeDays;
  final String nextBillDate;
  final AnimationController pulseCtrl;
  final VoidCallback onUpgrade;

  @override
  State<_PlanHero> createState() => _PlanHeroState();
}

class _PlanHeroState extends State<_PlanHero> {
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(kRCard),
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [kAccent, kAccentDeep, Color(0xFF2D0566)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            stops: [0.0, 0.6, 1.0],
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -100,
              top: -100,
              child: Container(
                width: 280,
                height: 280,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.white.withValues(alpha: 0.15),
                      Colors.white.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),

            // ─── Foreground content (single Column, no overlapping Positioned) ─
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Top section
                Padding(
                  padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top row: brand pill + status pill
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(kRPill),
                              border: Border.all(
                                  color:
                                      Colors.white.withValues(alpha: 0.22)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.verified_rounded,
                                    color: Colors.white, size: 12),
                                const SizedBox(width: 4),
                                Text(
                                  'JustFiber',
                                  style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.3,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Spacer(),
                          _StatusPill(
                              isOnline: widget.isOnline,
                              pulseCtrl: widget.pulseCtrl),
                        ],
                      ),

                      const SizedBox(height: 28),

                      // Eyebrow
                      Text(
                        'CURRENT PLAN',
                        style: GoogleFonts.inter(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.6,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Plan name — large and breathable
                      Text(
                        widget.planName.isEmpty
                            ? 'No active plan'
                            : widget.planName,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.6,
                          height: 1.15,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                // Bottom info strip + Upgrade CTA — own row in flow, no overlap
                Container(
                  padding:
                      const EdgeInsets.fromLTRB(22, 16, 14, 16),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.28),
                    border: Border(
                      top: BorderSide(
                          color: Colors.white.withValues(alpha: 0.10),
                          width: 1),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (widget.activeDays > 0)
                              Row(
                                children: [
                                  const Icon(Icons.schedule_rounded,
                                      color: Colors.white70, size: 13),
                                  const SizedBox(width: 5),
                                  Text(
                                    '${widget.activeDays} days left',
                                    style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            if (widget.nextBillDate.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                'Renews ${_fmtDate(widget.nextBillDate)}',
                                style: GoogleFonts.inter(
                                  color: Colors.white
                                      .withValues(alpha: 0.65),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      PressableScale(
                        onTap: widget.onUpgrade,
                        haptic: true,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 18, vertical: 11),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(kRButton),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                'Upgrade',
                                style: GoogleFonts.inter(
                                  color: kAccentDeep,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.2,
                                ),
                              ),
                              const SizedBox(width: 6),
                              const Icon(Icons.arrow_forward_rounded,
                                  color: kAccentDeep, size: 16),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.isOnline, required this.pulseCtrl});
  final bool isOnline;
  final AnimationController pulseCtrl;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(kRPill),
        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: pulseCtrl,
            builder: (_, __) {
              final scale = 1.0 + 0.5 * pulseCtrl.value;
              return Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 8 * scale,
                    height: 8 * scale,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: (isOnline ? kSuccess : kDanger)
                          .withValues(alpha: 0.45 * (1 - pulseCtrl.value)),
                    ),
                  ),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isOnline ? kSuccess : kDanger,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(width: 8),
          Text(
            isOnline ? 'Connected' : 'Offline',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  DATA USAGE CARD — premium ring + clean used/total stats
// ═══════════════════════════════════════════════════════════════════════════

class _DataUsageCard extends StatelessWidget {
  const _DataUsageCard({
    required this.usedGb,
    required this.totalGb,
    required this.usagePct,
    required this.ringAnimation,
    required this.daysLeft,
  });

  final double usedGb, totalGb, usagePct;
  final Animation<double> ringAnimation;
  final int daysLeft;

  @override
  Widget build(BuildContext context) {
    final isUnlimited = totalGb <= 0;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRCard),
        border: Border.all(color: kBorderSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: eyebrow + cycle pill
          Row(
            children: [
              Text(
                'DATA USAGE',
                style: GoogleFonts.inter(
                  color: kTextMuted,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.6,
                ),
              ),
              const Spacer(),
              if (daysLeft > 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: kAccentSoft,
                    borderRadius: BorderRadius.circular(kRPill),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.event_rounded,
                          color: kAccent, size: 11),
                      const SizedBox(width: 4),
                      Text(
                        '$daysLeft days',
                        style: GoogleFonts.inter(
                          color: kAccent,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),

          // Main ring + value row
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              AnimatedBuilder(
                animation: ringAnimation,
                builder: (_, __) => SizedBox(
                  width: 92,
                  height: 92,
                  child: CustomPaint(
                    // For unlimited plans, ring stays empty (track only).
                    // For metered plans, ring fills with usage percentage.
                    painter: _UsageRingPainter(
                      progress:
                          isUnlimited ? 0.0 : usagePct * ringAnimation.value,
                      strokeWidth: 9,
                    ),
                    child: Center(
                      child: isUnlimited
                          ? const Icon(Icons.all_inclusive_rounded,
                                    color: kAccent, size: 26)
                          : Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  (usagePct * 100 * ringAnimation.value)
                                      .toStringAsFixed(0),
                                  style: GoogleFonts.inter(
                                    color: kText,
                                    fontSize: 22,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.6,
                                    height: 1,
                                  ),
                                ),
                                Text(
                                  '%',
                                  style: GoogleFonts.inter(
                                    color: kTextMuted,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          usedGb.toStringAsFixed(1),
                          style: GoogleFonts.inter(
                            color: kText,
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.8,
                            height: 1,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'GB used',
                          style: GoogleFonts.inter(
                            color: kTextMuted,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isUnlimited
                          ? 'Unlimited plan'
                          : '${(totalGb - usedGb).clamp(0, totalGb).toStringAsFixed(1)} GB left',
                      style: GoogleFonts.inter(
                        color: kTextMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // (Speed pills removed — speed shown elsewhere via plan/services screens)
        ],
      ),
    );
  }
}

class _UsageRingPainter extends CustomPainter {
  _UsageRingPainter({required this.progress, this.strokeWidth = 9});
  final double progress;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    // Track — translucent white, no second color
    final track = Paint()
      ..color = const Color(0x14FFFFFF)
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, track);

    if (progress > 0) {
      final rect = Rect.fromCircle(center: center, radius: radius);
      // Subtle gradient on the arc — accent → light purple → accent
      // (single hue family, no rainbow)
      final shader = ui.Gradient.sweep(
        center,
        const [
          kAccent,
          Color(0xFFB87BF0),
          kAccent,
        ],
        const [0.0, 0.5, 1.0],
        TileMode.clamp,
        -math.pi / 2,
        3 * math.pi / 2,
      );
      final paint = Paint()
        ..shader = shader
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;
      // Soft glow under the arc
      final glow = Paint()
        ..color = kAccent.withValues(alpha: 0.4)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth * 1.6
        ..strokeCap = StrokeCap.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6);
      final sweep = 2 * math.pi * progress;
      canvas.drawArc(rect, -math.pi / 2, sweep, false, glow);
      canvas.drawArc(rect, -math.pi / 2, sweep, false, paint);

      // Tip dot
      final tipAngle = -math.pi / 2 + sweep;
      final tipOffset = Offset(
        center.dx + radius * math.cos(tipAngle),
        center.dy + radius * math.sin(tipAngle),
      );
      final tipPaint = Paint()..color = Colors.white;
      canvas.drawCircle(tipOffset, strokeWidth / 2 + 1.5, tipPaint);
      final tipInner = Paint()..color = kAccent;
      canvas.drawCircle(tipOffset, strokeWidth / 2 - 1, tipInner);
    }
  }

  @override
  bool shouldRepaint(_UsageRingPainter o) => o.progress != progress;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BILLING DUE ROW — translucent + accent text + Pay CTA
// ═══════════════════════════════════════════════════════════════════════════

class _BillingDueRow extends StatelessWidget {
  const _BillingDueRow({
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
      padding: const EdgeInsets.fromLTRB(18, 16, 14, 16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRSurface),
        border: Border.all(color: kAccentSoft),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: kAccentSoft,
              borderRadius: BorderRadius.circular(kRSmall),
            ),
            child: const Icon(Icons.receipt_long_rounded,
                color: kAccent, size: 18),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'BILL DUE',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    color: kTextMuted,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      '₹${dueAmount.toStringAsFixed(0)}',
                      style: GoogleFonts.inter(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: kText,
                        letterSpacing: -0.5,
                      ),
                    ),
                    if (nextBillDate.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Text(
                        '· due ${_fmtDate(nextBillDate)}',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: kTextMuted,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          PressableScale(
            onTap: onPay,
            haptic: true,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              decoration: BoxDecoration(
                color: kAccent,
                borderRadius: BorderRadius.circular(kRSmall),
                boxShadow: [
                  BoxShadow(
                    color: kAccent.withValues(alpha: 0.45),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Text(
                'Pay',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                  color: kText,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  PAYMENT TICKET CARD — pending booking
// ═══════════════════════════════════════════════════════════════════════════

class _PaymentTicketCard extends StatelessWidget {
  const _PaymentTicketCard({required this.booking, required this.onPayNow});
  final BookingQuote booking;
  final VoidCallback onPayNow;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRCard),
        border: Border.all(color: kAccentSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: kAccentSoft,
              borderRadius: BorderRadius.circular(kRPill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.schedule_rounded,
                    color: kAccent, size: 12),
                const SizedBox(width: 4),
                Text(
                  'Payment Pending',
                  style: GoogleFonts.inter(
                    color: kAccent,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Text(
            booking.planName.isNotEmpty ? booking.planName : 'Your Plan',
            style: GoogleFonts.inter(
              color: kText,
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Booking #${booking.bookingNumber}',
            style: GoogleFonts.inter(color: kTextMuted, fontSize: 12),
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
                      style: GoogleFonts.inter(color: kTextMuted, fontSize: 11),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      booking.amount > 0
                          ? '₹${booking.amount.toInt()}'
                          : 'TBD',
                      style: GoogleFonts.inter(
                        color: kText,
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
                    style: GoogleFonts.inter(color: kTextMuted, fontSize: 11),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    booking.durationLabel.isNotEmpty
                        ? booking.durationLabel
                        : '${booking.durationMonths} month',
                    style: GoogleFonts.inter(
                      color: kText,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          PressableScale(
            onTap: onPayNow,
            haptic: true,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 15),
              decoration: BoxDecoration(
                color: kAccent,
                borderRadius: BorderRadius.circular(kRButton),
                boxShadow: [
                  BoxShadow(
                    color: kAccent.withValues(alpha: 0.5),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Center(
                child: Text(
                  booking.amount > 0
                      ? 'Pay Now  ₹${booking.amount.toInt()}'
                      : 'Pay Now',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: kText,
                    letterSpacing: 0.2,
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

// ═══════════════════════════════════════════════════════════════════════════
//  NEW USER HERO — when no connections yet
// ═══════════════════════════════════════════════════════════════════════════

class _NewUserHero extends StatelessWidget {
  const _NewUserHero({
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
        ClipRRect(
          borderRadius: BorderRadius.circular(kRCard),
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [kAccent, kAccentDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Stack(
              children: [
                Positioned(
                  right: -80,
                  top: -80,
                  child: Container(
                    width: 220,
                    height: 220,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.06),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        hasPending
                            ? 'Almost connected'
                            : 'Welcome to JustFiber',
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                          height: 1.15,
                        ),
                      ),
                      const SizedBox(height: 8),
                      if (mobile.isNotEmpty)
                        Text(
                          '+91 $mobile',
                          style: GoogleFonts.inter(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      const SizedBox(height: 6),
                      Text(
                        hasPending
                            ? 'Complete payment to confirm your installation.'
                            : 'Pick a plan and book your installation to get connected.',
                        style: GoogleFonts.inter(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 13,
                          height: 1.5,
                        ),
                      ),
                      if (!hasPending) ...[
                        const SizedBox(height: 20),
                        PressableScale(
                          onTap: onViewPlans,
                          haptic: true,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 15),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(kRButton),
                            ),
                            child: Center(
                              child: Text(
                                'Browse Plans',
                                style: GoogleFonts.inter(
                                  color: kAccentDeep,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        PressableScale(
                          onTap: onBookNow,
                          haptic: true,
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(kRButton),
                              border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.4)),
                            ),
                            child: Center(
                              child: Text(
                                'Book Installation',
                                style: GoogleFonts.inter(
                                  color: Colors.white,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (hasPending) ...[
          const SizedBox(height: 14),
          _PaymentTicketCard(
            booking: pendingBooking!,
            onPayNow: onPayBooking ?? () {},
          ),
        ],
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONNECTION SWITCHER
// ═══════════════════════════════════════════════════════════════════════════

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
      height: 38,
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
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? kAccentSoft : kSurface,
                borderRadius: BorderRadius.circular(kRPill),
                border: Border.all(
                  color: isSelected ? kAccent : kBorderSoft,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.router_rounded,
                    size: 14,
                    color: isSelected ? kAccent : kTextMuted,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    conn.address.isNotEmpty
                        ? conn.address
                        : conn.customerId,
                    style: GoogleFonts.inter(
                      color: isSelected ? kText : kTextDim,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (isSelected) ...[
                    const SizedBox(width: 6),
                    const Icon(Icons.check_circle_rounded,
                        color: kAccent, size: 14),
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

// ═══════════════════════════════════════════════════════════════════════════
//  BANNER CAROUSEL — auto-scrolling offer banners
// ═══════════════════════════════════════════════════════════════════════════

class _BannerCarousel extends StatefulWidget {
  const _BannerCarousel({required this.banners, required this.onTap});
  final List<AppBannerItem> banners;
  final ValueChanged<AppBannerItem> onTap;

  @override
  State<_BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<_BannerCarousel> {
  late final PageController _pageCtrl;
  int _currentPage = 0;
  late final _timer = _startAutoScroll();

  @override
  void initState() {
    super.initState();
    _pageCtrl = PageController(viewportFraction: 0.92);
  }

  @override
  void dispose() {
    _timer.cancel();
    _pageCtrl.dispose();
    super.dispose();
  }

  Timer _startAutoScroll() {
    return Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || widget.banners.length <= 1) return;
      final next = (_currentPage + 1) % widget.banners.length;
      _pageCtrl.animateToPage(
        next,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 130,
          child: PageView.builder(
            controller: _pageCtrl,
            itemCount: widget.banners.length,
            onPageChanged: (i) => setState(() => _currentPage = i),
            itemBuilder: (_, i) {
              final banner = widget.banners[i];
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: GestureDetector(
                  onTap: () => widget.onTap(banner),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(kRSurface),
                      border: Border.all(color: kBorderSoft),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(kRSurface),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          // Banner image or gradient fallback
                          if (banner.imageUrl.isNotEmpty)
                            Image.network(
                              banner.imageUrl,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  _bannerFallback(banner),
                            )
                          else
                            _bannerFallback(banner),
                          // Text overlay
                          Container(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.centerLeft,
                                end: Alignment.centerRight,
                                colors: [
                                  Colors.black.withValues(alpha: 0.7),
                                  Colors.black.withValues(alpha: 0.1),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                Text(
                                  banner.title,
                                  style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.3,
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                if (banner.description.isNotEmpty) ...[
                                  const SizedBox(height: 3),
                                  Text(
                                    banner.description,
                                    style: GoogleFonts.inter(
                                      color: Colors.white
                                          .withValues(alpha: 0.85),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        // Dot indicators
        if (widget.banners.length > 1) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.banners.length, (i) {
              final active = i == _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: active ? kAccent : kBorderSoft,
                  borderRadius: BorderRadius.circular(kRPill),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }

  Widget _bannerFallback(AppBannerItem banner) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [kAccent, kAccentDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

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
