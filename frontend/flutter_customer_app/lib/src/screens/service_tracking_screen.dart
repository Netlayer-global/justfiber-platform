import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';

class ServiceTrackingScreen extends StatelessWidget {
  const ServiceTrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final latestBooking = appState.latestBooking;
    final bookingTracking = appState.bookingTracking;
    CustomerConnection? selectedConnection;
    for (final item in appState.connections) {
      if (item.customerId == appState.selectedCustomerId) {
        selectedConnection = item;
        break;
      }
    }

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refreshBookingTracking,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _TrackingHeroHeader(
                latestBooking: latestBooking,
                onRefresh: () => _refreshTrackingWithFeedback(context, appState),
                busy: appState.busy,
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  if ((appState.error ?? '').isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _ErrorBanner(
                      message: appState.error!,
                      onRetry: appState.busy
                          ? null
                          : () => _refreshTrackingWithFeedback(context, appState),
                    ),
                  ],
                  if (selectedConnection != null) ...[
                    const SizedBox(height: 18),
                    _ConnectionCard(connection: selectedConnection),
                  ],
                  const SizedBox(height: 18),
                  _MilestoneCard(
                    latestBooking: latestBooking,
                    steps: bookingTracking?.steps ?? const [],
                  ),
                  const SizedBox(height: 20),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _refreshTrackingWithFeedback(
      BuildContext context, AppState appState) async {
    await appState.refreshBookingTracking();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Tracking updated'),
    ));
  }
}

// ─── Hero Header ───────────────────────────────────────────────────────────────

class _TrackingHeroHeader extends StatelessWidget {
  const _TrackingHeroHeader({
    required this.latestBooking,
    required this.onRefresh,
    required this.busy,
  });

  final dynamic latestBooking;
  final VoidCallback onRefresh;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(22, 16, 22, 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Back + title + refresh
            Row(
              children: [
                GestureDetector(
                  onTap: () => Navigator.of(context).maybePop(),
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(kRSmall),
                      border: Border.all(color: kBorderSoft),
                    ),
                    child: const Icon(Icons.arrow_back_rounded,
                        color: kText, size: 18),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    'Track Service',
                    style: GoogleFonts.inter(
                      color: kText,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: busy ? null : onRefresh,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(kRSmall),
                      border: Border.all(color: kBorderSoft),
                    ),
                    child: busy
                        ? const Padding(
                            padding: EdgeInsets.all(10),
                            child: CircularProgressIndicator(
                                color: kAccent, strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh_rounded,
                            color: kText, size: 18),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Hero card — accent gradient with booking info
            ClipRRect(
              borderRadius: BorderRadius.circular(kRCard),
              child: Container(
                width: double.infinity,
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
                      right: -60,
                      top: -60,
                      child: Container(
                        width: 180,
                        height: 180,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withValues(alpha: 0.06),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(22),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.18),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                      color: Colors.white
                                          .withValues(alpha: 0.25)),
                                ),
                                child: const Icon(
                                    Icons.local_shipping_rounded,
                                    color: Colors.white,
                                    size: 22),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Installation Tracking',
                                      style: GoogleFonts.inter(
                                        color: Colors.white,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.3,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      latestBooking == null
                                          ? 'No active booking'
                                          : 'Booking #${latestBooking.bookingNumber}',
                                      style: GoogleFonts.inter(
                                        color: Colors.white
                                            .withValues(alpha: 0.85),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500,
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
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Connection Card ────────────────────────────────────────────────────────────

class _ConnectionCard extends StatelessWidget {
  const _ConnectionCard({required this.connection});
  final CustomerConnection connection;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.router_rounded, color: kPrimary, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  connection.planName.isEmpty
                      ? 'Broadband Connection'
                      : connection.planName,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  connection.address.isEmpty
                      ? connection.serviceId
                      : connection.address,
                  style: GoogleFonts.inter(
                      color: kMuted, fontSize: 12, height: 1.35),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
            ),
            child: Text(
              connection.status.isEmpty ? 'Active' : connection.status,
              style: GoogleFonts.inter(
                  color: kPrimary, fontSize: 11, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Milestone Card ─────────────────────────────────────────────────────────────

class _MilestoneCard extends StatelessWidget {
  const _MilestoneCard({required this.latestBooking, required this.steps});
  final dynamic latestBooking;
  final List steps;

  bool _hasCompletedStep(List<String> keywords) {
    for (final s in steps) {
      final code = (s.code as String).toLowerCase();
      final status = (s.status as String).toLowerCase();
      final done =
          status == 'done' || status == 'completed' || status == 'active';
      if (done && keywords.any((k) => code.contains(k))) return true;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final hasBooking = latestBooking != null;
    final assigned = hasBooking &&
        _hasCompletedStep(
            ['assigned', 'accepted', 'enroute', 'onsite', 'arrived', 'installer']);
    final changed = hasBooking &&
        _hasCompletedStep(
            ['reassign', 'change', 'realloc', 'transfer', 'replace']);
    final installed = hasBooking &&
        _hasCompletedStep(['installed', 'active', 'done', 'completed']);

    final milestones = <_MilestoneItem>[
      _MilestoneItem(
        icon: Icons.check_circle_outline_rounded,
        label: 'Connection Booked',
        sublabel:
            hasBooking ? 'Booking #${latestBooking.bookingNumber}' : 'Not booked yet',
        done: hasBooking,
      ),
      _MilestoneItem(
        icon: Icons.engineering_rounded,
        label: 'Installer Assigned',
        sublabel:
            assigned ? 'Installation team dispatched' : 'Awaiting assignment',
        done: assigned,
      ),
      if (changed)
        const _MilestoneItem(
          icon: Icons.swap_horiz_rounded,
          label: 'Installer Changed',
          sublabel: 'Team was reassigned',
          done: true,
        ),
      _MilestoneItem(
        icon: Icons.wifi_rounded,
        label: 'Installation Complete',
        sublabel:
            installed ? 'Your connection is live' : 'Pending installation',
        done: installed,
      ),
    ];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: kPrimary.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.route_rounded, size: 14, color: kPrimaryLight),
            const SizedBox(width: 7),
            Text(
              'BOOKING PROGRESS',
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: kMuted,
                letterSpacing: 1.6,
              ),
            ),
          ]),
          const SizedBox(height: 20),
          if (!hasBooking)
            _noBookingState()
          else
            ...milestones.asMap().entries.map((e) => _MilestoneRow(
                  item: e.value,
                  isLast: e.key == milestones.length - 1,
                )),
        ],
      ),
    );
  }

  Widget _noBookingState() => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child:
                  const Icon(Icons.wifi_off_rounded, color: kPrimary, size: 26),
            ),
            const SizedBox(height: 14),
            Text(
              'No active booking',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              'Your connection booking will appear here once created by our team.',
              textAlign: TextAlign.center,
              style:
                  GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.45),
            ),
          ],
        ),
      );
}

class _MilestoneItem {
  const _MilestoneItem({
    required this.icon,
    required this.label,
    required this.sublabel,
    required this.done,
  });
  final IconData icon;
  final String label, sublabel;
  final bool done;
}

class _MilestoneRow extends StatelessWidget {
  const _MilestoneRow({required this.item, required this.isLast});
  final _MilestoneItem item;
  final bool isLast;

  static const _doneColor = Color(0xFF4ADE80);

  @override
  Widget build(BuildContext context) {
    final color = item.done ? _doneColor : kMuted;
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: item.done
                      ? _doneColor.withValues(alpha: 0.10)
                      : Colors.white.withValues(alpha: 0.04),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: item.done ? _doneColor : kBorder,
                    width: 1.5,
                  ),
                ),
                child: Icon(item.icon, size: 18, color: color),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 5),
                    color: item.done
                        ? _doneColor.withValues(alpha: 0.25)
                        : kBorder,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18, top: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.label,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: (item.done ? _doneColor : kMuted)
                              .withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          item.done ? 'Done' : 'Pending',
                          style: GoogleFonts.inter(
                            color: item.done ? _doneColor : kMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.sublabel,
                    style: GoogleFonts.inter(color: kMuted, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Error Banner ──────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A0A0A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x44FF6B6B)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: Color(0xFFFF6B6B), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: GoogleFonts.inter(
                  color: const Color(0xFFFF6B6B), fontSize: 13),
            ),
          ),
          if (onRetry != null) ...[
            const SizedBox(width: 10),
            TextButton(
              onPressed: onRetry,
              child: Text('Retry',
                  style: GoogleFonts.inter(
                      color: const Color(0xFFFF6B6B),
                      fontWeight: FontWeight.w700)),
            ),
          ],
        ],
      ),
    );
  }
}
