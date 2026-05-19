import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'booking_payment_screen.dart';
import 'lead_booking_flow_screen.dart';
import 'public_plan_catalog_screen.dart';

class NewUserHomeScreen extends StatelessWidget {
  const NewUserHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final mobile = appState.session?.mobile ?? '';
    final pendingBooking = appState.pendingPaymentBooking;
    final hasPending = pendingBooking != null;

    return Scaffold(
      backgroundColor: kBg,
      body: Stack(
        children: [
          // Full-screen hero background image (when set by admin)
          if (appState.newUserHeroImageUrl.isNotEmpty)
            Positioned.fill(
              child: Image.network(
                appState.newUserHeroImageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          // Gradient overlay for text readability
          if (appState.newUserHeroImageUrl.isNotEmpty)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.3),
                      Colors.black.withValues(alpha: 0.85),
                    ],
                  ),
                ),
              ),
            ),
          // Main content
          RefreshIndicator(
            color: kPrimary,
            backgroundColor: kSurface,
            onRefresh: appState.refresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
            SliverToBoxAdapter(
              child: SafeArea(
                child: Column(
                  children: [
                    // ── Top Bar ──────────────────────────────────────────
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                      child: Stack(
                        children: [
                          Center(
                            child: Image.asset(
                              'assets/images/logo.png',
                              height: 170,
                              fit: BoxFit.contain,
                            ),
                          ),
                          Positioned(
                            top: 0,
                            right: 0,
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (appState.busy)
                                  const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation<Color>(kPrimaryLight),
                                    ),
                                  ),
                                const SizedBox(width: 8),
                                GestureDetector(
                                  onTap: () => _confirmLogout(context, appState),
                                  child: Container(
                                    width: 42,
                                    height: 42,
                                    decoration: BoxDecoration(
                                      color: kSurface,
                                      borderRadius: BorderRadius.circular(13),
                                      border: Border.all(color: kBorder),
                                    ),
                                    child: const Icon(Icons.logout_rounded,
                                        color: Colors.white54, size: 18),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 8),

                    // ── Welcome Hero ─────────────────────────────────────
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Container(
                        width: double.infinity,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF8224E3), Color(0xFF5B10A0)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(28),
                          border: Border.all(
                              color: const Color(0x44D8B4FE)),
                        ),
                        padding: const EdgeInsets.all(26),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              hasPending
                                  ? 'Almost Connected!'
                                  : 'Welcome to\nJustFiber',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 30,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -1,
                                height: 1.15,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              mobile.isNotEmpty
                                  ? 'Logged in as +91 $mobile'
                                  : 'Get started with high-speed fiber internet.',
                              style: GoogleFonts.inter(
                                color: Colors.white70,
                                fontSize: 13,
                                height: 1.5,
                              ),
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
                    ),

                    const SizedBox(height: 24),

                    // ── Payment Ticket (shown when pending) ──────────────
                    if (hasPending) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: _PaymentTicketCard(
                          booking: pendingBooking,
                          onPayNow: () =>
                              _handlePayNow(context, appState, pendingBooking),
                        ),
                      ),
                      const SizedBox(height: 28),
                    ],

                    // ── Section label ────────────────────────────────────
                    if (!hasPending) ...[
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Align(
                          alignment: Alignment.centerLeft,
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
                      ),
                      const SizedBox(height: 14),
                      // ── Browse Plans & Book (single unified button) ──
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: GestureDetector(
                          onTap: () async {
                            await Navigator.of(context).push(MaterialPageRoute(
                                builder: (_) => LeadBookingFlowScreen(
                                    initialMobile: mobile)));
                            await appState.refresh();
                          },
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF8224E3),
                              borderRadius: BorderRadius.circular(18),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF8224E3).withValues(alpha: 0.4),
                                  blurRadius: 14,
                                  offset: const Offset(0, 6),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Browse Plans & Book',
                                  style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Icon(Icons.arrow_forward_rounded,
                                    color: Colors.white, size: 18),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32),
                    ],

                    // ── Pull to refresh hint ─────────────────────────────
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 40),
                      child: Text(
                        hasPending
                            ? 'Pull down to refresh your booking status.'
                            : 'Pull down to refresh if you already have an active connection.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                            fontSize: 12,
                            color: kMuted,
                            height: 1.6),
                      ),
                    ),

                    const SizedBox(height: 40),
                  ],
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

  Future<void> _handlePayNow(
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
          appState.bookingError ?? 'Could not load payment details.',
          style: GoogleFonts.inter(fontSize: 13),
        ),
      ));
      return;
    }
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => BookingPaymentScreen(
        bookingNumber: booking.bookingNumber,
        paymentOrder: order,
        planName: booking.planName,
        durationLabel: booking.durationLabel,
      ),
    ));
    await appState.refresh();
  }

  Future<void> _confirmLogout(BuildContext context, AppState appState) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Log out?',
            style: GoogleFonts.inter(
                color: Colors.white, fontWeight: FontWeight.w800)),
        content: Text('You will need to log in again.',
            style: GoogleFonts.inter(color: kMuted, fontSize: 14)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Cancel',
                style: GoogleFonts.inter(color: kMuted)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Log out',
                style: GoogleFonts.inter(
                    color: const Color(0xFFEF4444),
                    fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      appState.logout();
    }
  }
}

// ─── Payment Ticket Card ──────────────────────────────────────────────────────

class _PaymentTicketCard extends StatelessWidget {
  const _PaymentTicketCard({
    required this.booking,
    required this.onPayNow,
  });

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
        borderRadius: BorderRadius.circular(24),
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
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
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
            ],
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
            style: GoogleFonts.inter(
              color: Colors.white60,
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
            child: FilledButton.icon(
              onPressed: onPayNow,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0369A1),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              icon: const Icon(Icons.payment_rounded, size: 18),
              label: Text(
                booking.amount > 0 ? 'Pay Now  ₹${booking.amount.toInt()}' : 'Pay Now',
                style: GoogleFonts.inter(
                    fontSize: 15, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Action Card ──────────────────────────────────────────────────────────────

class _ActionCard extends StatelessWidget {
  const _ActionCard({
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
    return Container(
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
                  style: GoogleFonts.inter(
                      color: kMuted, fontSize: 12, height: 1.4),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: onTap,
                    style: FilledButton.styleFrom(
                      backgroundColor: iconColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(
                      buttonLabel,
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w700, fontSize: 13),
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
