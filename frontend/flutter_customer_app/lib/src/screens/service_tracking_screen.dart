import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'booking_flow_screen.dart';
import 'notifications_screen.dart';
import 'support_history_screen.dart';

class ServiceTrackingScreen extends StatelessWidget {
  const ServiceTrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final latestBooking = appState.latestBooking;
    final bookingTracking = appState.bookingTracking;
    final visits = appState.installerVisits;
    final requests = appState.requests;
    final tickets = appState.tickets;
    final notifications = appState.notifications;
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
            // ── Gradient App Bar ──────────────────────────────────
            SliverToBoxAdapter(
              child: _TrackingHeroHeader(
                latestBooking: latestBooking,
                onRefresh: () =>
                    _refreshTrackingWithFeedback(context, appState),
                busy: appState.busy,
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Error banner
                  if ((appState.error ?? '').isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _ErrorBanner(
                      message: appState.error!,
                      onRetry: appState.busy
                          ? null
                          : () => _refreshTrackingWithFeedback(
                              context, appState),
                    ),
                  ],

                  // Connection strip
                  if (selectedConnection != null) ...[
                    const SizedBox(height: 18),
                    _ConnectionCard(connection: selectedConnection),
                  ],

                  // Booking Details
                  const SizedBox(height: 18),
                  _BookingCard(
                    latestBooking: latestBooking,
                    visits: visits,
                    requests: requests,
                    tickets: tickets,
                    onBookAnother: () async {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const BookingFlowScreen()));
                      if (context.mounted) {
                        await appState.refreshBookingTracking();
                      }
                    },
                    onSupport: () async {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const SupportHistoryScreen()));
                      if (context.mounted) {
                        await appState.refreshBookingTracking();
                      }
                    },
                    onRefresh: appState.busy
                        ? null
                        : () => _refreshTrackingWithFeedback(context, appState),
                  ),

                  // Timeline
                  const SizedBox(height: 18),
                  _TimelineCard(
                    bookingTracking: bookingTracking,
                    latestBooking: latestBooking,
                    onBook: () async {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const BookingFlowScreen()));
                      if (context.mounted) {
                        await appState.refreshBookingTracking();
                      }
                    },
                  ),

                  // Installer visits
                  if (visits.isNotEmpty) ...[
                    const SizedBox(height: 18),
                    const _SectionHeader(
                        icon: Icons.engineering_rounded,
                        title: 'INSTALLER VISITS'),
                    const SizedBox(height: 12),
                    ...visits.map((visit) => Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: _VisitCard(
                            visit: visit,
                            onOpenMap: visit.mapUrl.isNotEmpty
                                ? () => _openMap(context, visit.mapUrl)
                                : null,
                          ),
                        )),
                  ] else ...[
                    const SizedBox(height: 18),
                    _EmptyCard(
                      icon: Icons.engineering_rounded,
                      title: 'No installer visit assigned yet',
                      subtitle:
                          'Assigned jobs and visit updates will appear here once operations dispatches a team.',
                      actionLabel: 'Refresh tracking',
                      onTap: () => _refreshTrackingWithFeedback(
                          context, appState),
                    ),
                  ],

                  // Alerts
                  const SizedBox(height: 18),
                  _AlertsCard(
                    notifications: notifications,
                    onOpenAll: () async {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const NotificationsScreen()));
                      if (context.mounted) {
                        await appState.refreshBookingTracking();
                      }
                    },
                  ),

                  // Support activity
                  const SizedBox(height: 18),
                  _SupportCard(
                    requests: requests,
                    tickets: tickets,
                    onOpen: () async {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const SupportHistoryScreen()));
                      if (context.mounted) {
                        await appState.refreshBookingTracking();
                      }
                    },
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

  Future<void> _openMap(BuildContext context, String mapUrl) async {
    final uri = Uri.tryParse(mapUrl);
    if (uri == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Location link is not available right now.')),
        );
      }
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Unable to open installer location right now.')),
      );
    }
  }

  Future<void> _refreshTrackingWithFeedback(
      BuildContext context, AppState appState) async {
    await appState.refreshBookingTracking();
    if (!context.mounted) return;
    final hasData = (appState.bookingTracking?.steps.isNotEmpty ?? false) ||
        appState.installerVisits.isNotEmpty ||
        appState.requests.isNotEmpty ||
        appState.tickets.isNotEmpty ||
        appState.notifications.isNotEmpty;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(
          hasData ? 'Tracking updated' : 'No new tracking updates yet'),
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
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF13051F), Color(0xFF3B0D7A), Color(0xFFA855F7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -60,
            right: -50,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  Colors.white.withValues(alpha: 0.07),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 8, 24),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 12),
                        Text(
                          'Requests & Tracking',
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.6,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          latestBooking == null
                              ? 'No active booking'
                              : 'Booking #${latestBooking.bookingNumber}',
                          style: GoogleFonts.inter(
                            color: Colors.white60,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: busy ? null : onRefresh,
                    icon: busy
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                                color: Colors.white, strokeWidth: 2),
                          )
                        : const Icon(Icons.refresh_rounded,
                            color: Colors.white),
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

// ─── Connection Card ───────────────────────────────────────────────────────────

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
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
            ),
            child: Text(
              connection.status.isEmpty ? 'Active' : connection.status,
              style: GoogleFonts.inter(
                  color: kPrimary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Booking Card ──────────────────────────────────────────────────────────────

class _BookingCard extends StatelessWidget {
  const _BookingCard({
    required this.latestBooking,
    required this.visits,
    required this.requests,
    required this.tickets,
    required this.onBookAnother,
    required this.onSupport,
    required this.onRefresh,
  });

  final dynamic latestBooking;
  final List visits;
  final List requests;
  final List tickets;
  final VoidCallback onBookAnother;
  final VoidCallback onSupport;
  final VoidCallback? onRefresh;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF13051F), Color(0xFF3B0D7A), Color(0xFFA855F7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0x55D8B4FE)),
        boxShadow: [
          BoxShadow(
            color: kPrimary.withValues(alpha: 0.3),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -40,
            right: -30,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  Colors.white.withValues(alpha: 0.06),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Label
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: Text(
                        'BOOKING CONSOLE',
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                Text(
                  latestBooking == null
                      ? 'No active booking yet'
                      : 'Current booking',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                    height: 1.15,
                  ),
                ),

                if (latestBooking != null) ...[
                  const SizedBox(height: 16),
                  _bookingRow('Booking no.',
                      latestBooking.bookingNumber ?? '-'),
                  _bookingRow('Plan', latestBooking.planName ?? '-'),
                  _bookingRow('Amount',
                      'Rs ${latestBooking.amount?.toStringAsFixed(0) ?? '-'}'),
                  _bookingRow('Current step',
                      latestBooking.currentStep ?? '-'),
                  if ((latestBooking.preferredDate ?? '').isNotEmpty)
                    _bookingRow(
                        'Preferred date', latestBooking.preferredDate),
                  if ((latestBooking.preferredSlotLabel ?? '').isNotEmpty)
                    _bookingRow(
                        'Preferred slot', latestBooking.preferredSlotLabel),
                ] else ...[
                  const SizedBox(height: 10),
                  Text(
                    'Create a new connection request to start installation tracking, installer updates, and service movement here.',
                    style: GoogleFonts.inter(
                        color: Colors.white60, fontSize: 13, height: 1.5),
                  ),
                ],

                const SizedBox(height: 18),

                // Count chips
                Row(
                  children: [
                    Expanded(
                        child: _CountChip(
                            label: 'Visits', count: visits.length)),
                    const SizedBox(width: 8),
                    Expanded(
                        child: _CountChip(
                            label: 'Requests', count: requests.length)),
                    const SizedBox(width: 8),
                    Expanded(
                        child: _CountChip(
                            label: 'Tickets', count: tickets.length)),
                  ],
                ),

                const SizedBox(height: 16),

                // Refresh button
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: onRefresh,
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: Text(
                      'Refresh tracking',
                      style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: const Color(0xFF3B0D7A),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                    ),
                  ),
                ),

                const SizedBox(height: 10),

                // Secondary actions
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onBookAnother,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.3)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(
                          'Book connection',
                          style: GoogleFonts.inter(
                              fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onSupport,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.3)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(
                          'Need support',
                          style: GoogleFonts.inter(
                              fontSize: 12, fontWeight: FontWeight.w700),
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

  Widget _bookingRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
                color: Colors.white60, fontSize: 13),
          ),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Count Chip ────────────────────────────────────────────────────────────────

class _CountChip extends StatelessWidget {
  const _CountChip({required this.label, required this.count});
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: GoogleFonts.inter(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 18),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.inter(
                color: Colors.white54, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

// ─── Timeline Card ─────────────────────────────────────────────────────────────

class _TimelineCard extends StatelessWidget {
  const _TimelineCard({
    required this.bookingTracking,
    required this.latestBooking,
    required this.onBook,
  });

  final dynamic bookingTracking;
  final dynamic latestBooking;
  final VoidCallback onBook;

  @override
  Widget build(BuildContext context) {
    final steps = bookingTracking?.steps ?? [];

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
          const _SectionHeader(
              icon: Icons.timeline_rounded, title: 'BOOKING TIMELINE'),
          const SizedBox(height: 16),
          if (steps.isEmpty)
            _EmptyCard(
              icon: Icons.route_rounded,
              title: 'No booking timeline available yet',
              subtitle:
                  'Create a new broadband booking or refresh tracking to fetch the latest status.',
              actionLabel: 'Book connection',
              onTap: onBook,
              inline: true,
            )
          else
            ...steps.asMap().entries.map((entry) {
              final i = entry.key;
              final step = entry.value;
              final isLast = i == steps.length - 1;
              return _TimelineStep(
                step: step,
                isLast: isLast,
                showSlot: i == 0 &&
                    (latestBooking?.preferredSlotLabel ?? '').isNotEmpty,
                slotLabel: latestBooking?.preferredSlotLabel ?? '',
              );
            }),
        ],
      ),
    );
  }
}

class _TimelineStep extends StatelessWidget {
  const _TimelineStep({
    required this.step,
    required this.isLast,
    required this.showSlot,
    required this.slotLabel,
  });

  final dynamic step;
  final bool isLast, showSlot;
  final String slotLabel;

  Color _color(String status) {
    final s = status.toLowerCase();
    if (s == 'done' || s == 'completed' || s == 'active') {
      return const Color(0xFF4ADE80);
    }
    if (s == 'pending' ||
        s == 'assigned' ||
        s == 'accepted' ||
        s == 'enroute' ||
        s == 'onsite') {
      return const Color(0xFFFBBF24);
    }
    return const Color(0xFFEF4444);
  }

  @override
  Widget build(BuildContext context) {
    final color = _color(step.status as String);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Line + dot column
          Column(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: color.withValues(alpha: 0.5),
                      blurRadius: 8,
                      spreadRadius: 1,
                    ),
                  ],
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: kBorder,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          (step.code as String).replaceAll('_', ' '),
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          step.status as String,
                          style: GoogleFonts.inter(
                              color: color,
                              fontSize: 10,
                              fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    (step.at as String).isEmpty
                        ? 'Pending'
                        : step.at as String,
                    style:
                        GoogleFonts.inter(color: kMuted, fontSize: 12),
                  ),
                  if (showSlot) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Preferred slot: $slotLabel',
                      style: GoogleFonts.inter(
                          color: kPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Visit Card ────────────────────────────────────────────────────────────────

class _VisitCard extends StatelessWidget {
  const _VisitCard({required this.visit, this.onOpenMap});
  final InstallerVisitItem visit;
  final VoidCallback? onOpenMap;

  Color _statusColor(String status) {
    final s = status.toLowerCase();
    if (s == 'done' || s == 'completed' || s == 'active') {
      return const Color(0xFF4ADE80);
    }
    if (s == 'pending' ||
        s == 'assigned' ||
        s == 'accepted' ||
        s == 'enroute' ||
        s == 'onsite') {
      return const Color(0xFFFBBF24);
    }
    return const Color(0xFFEF4444);
  }

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(visit.status);
    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: kPrimary.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Visit header
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: kPrimary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.engineering_rounded,
                      color: kPrimary, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        visit.jobNumber,
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 15),
                      ),
                      Text(
                        '${visit.type} · ${visit.priority}',
                        style: GoogleFonts.inter(
                            color: kMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: color.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    visit.status,
                    style: GoogleFonts.inter(
                        color: color,
                        fontSize: 11,
                        fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
            child: Column(
              children: [
                _visitRow(Icons.person_rounded,
                    visit.installerName.isEmpty ? 'Assigned team' : visit.installerName),
                if (visit.installerPhone.isNotEmpty)
                  _visitRow(Icons.phone_rounded, visit.installerPhone),
                if (visit.planName.isNotEmpty)
                  _visitRow(Icons.wifi_rounded, visit.planName),
                _visitRow(
                    Icons.access_time_rounded,
                    visit.etaText.isEmpty ? '—' : visit.etaText,
                    label: 'ETA'),
                if (visit.lastUpdateNote.isNotEmpty ||
                    visit.latestEventCode.isNotEmpty)
                  _visitRow(
                      Icons.info_outline_rounded,
                      visit.lastUpdateNote.isEmpty
                          ? visit.latestEventCode
                          : visit.lastUpdateNote,
                      label: 'Update'),
              ],
            ),
          ),

          // Map card — big and prominent
          if (onOpenMap != null)
            _MapCard(onOpen: onOpenMap!)
          else
            const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _visitRow(IconData icon, String value, {String? label}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 15, color: kMuted),
          const SizedBox(width: 8),
          if (label != null) ...[
            Text(
              '$label: ',
              style: GoogleFonts.inter(color: kMuted, fontSize: 13),
            ),
          ],
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w600),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Map Card ──────────────────────────────────────────────────────────────────

class _MapCard extends StatelessWidget {
  const _MapCard({required this.onOpen});
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onOpen,
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 12, 12, 12),
        height: 160,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: const LinearGradient(
            colors: [Color(0xFF0F0A1E), Color(0xFF1C1040), Color(0xFF2D1B6B)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(color: kPrimary.withValues(alpha: 0.35)),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: 0.2),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Subtle grid lines (map feel)
            CustomPaint(
              size: const Size(double.infinity, 160),
              painter: _MapGridPainter(),
            ),
            // Content
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Pin icon
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFFBB6FF7), Color(0xFF7C3AED)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: kPrimary.withValues(alpha: 0.6),
                          blurRadius: 20,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.location_on_rounded,
                        color: Colors.white, size: 26),
                  ),
                  // Pin tail
                  Container(
                    width: 2,
                    height: 6,
                    color: kPrimary,
                  ),
                ],
              ),
            ),
            // Open button overlay
            Positioned(
              bottom: 12,
              left: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      kPrimary.withValues(alpha: 0.9),
                      const Color(0xFF7C3AED).withValues(alpha: 0.9),
                    ],
                    begin: Alignment.centerLeft,
                    end: Alignment.centerRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                      color: Colors.white.withValues(alpha: 0.15)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.open_in_new_rounded,
                        color: Colors.white, size: 15),
                    const SizedBox(width: 7),
                    Text(
                      'Open Installer Location',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
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

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..strokeWidth = 1;

    const spacing = 28.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ─── Alerts Card ───────────────────────────────────────────────────────────────

class _AlertsCard extends StatelessWidget {
  const _AlertsCard(
      {required this.notifications, required this.onOpenAll});
  final List notifications;
  final VoidCallback onOpenAll;

  @override
  Widget build(BuildContext context) {
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
          const _SectionHeader(
              icon: Icons.notifications_rounded, title: 'LATEST ALERTS'),
          const SizedBox(height: 16),
          if (notifications.isEmpty)
            _EmptyCard(
              icon: Icons.notifications_none_rounded,
              title: 'No tracking alerts right now',
              subtitle:
                  'Booking, installer, and service movement alerts will show up here.',
              actionLabel: 'Open support center',
              onTap: onOpenAll,
              inline: true,
            )
          else ...[
            ...notifications.take(3).map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: kSurface2,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: kPrimary.withValues(alpha: 0.12)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title as String,
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 14),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          item.body as String,
                          style: GoogleFonts.inter(
                              color: kMuted, fontSize: 13, height: 1.4),
                        ),
                      ],
                    ),
                  ),
                )),
            const SizedBox(height: 4),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: onOpenAll,
                style: OutlinedButton.styleFrom(
                  foregroundColor: kPrimary,
                  side: BorderSide(color: kPrimary.withValues(alpha: 0.3)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Open all alerts',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ─── Support Card ──────────────────────────────────────────────────────────────

class _SupportCard extends StatelessWidget {
  const _SupportCard(
      {required this.requests, required this.tickets, required this.onOpen});
  final List requests;
  final List tickets;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
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
          const _SectionHeader(
              icon: Icons.support_agent_rounded, title: 'SUPPORT ACTIVITY'),
          const SizedBox(height: 16),
          _activityRow('Open requests', '${requests.length}'),
          _activityRow('Open tickets', '${tickets.length}'),
          _activityRow(
            'Latest request',
            requests.isEmpty
                ? 'No request raised yet'
                : '${requests.first.referenceNumber} · ${requests.first.status}',
          ),
          _activityRow(
            'Latest ticket',
            tickets.isEmpty
                ? 'No complaint raised yet'
                : '${tickets.first.ticketNumber} · ${tickets.first.status}',
            last: true,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onOpen,
              icon: const Icon(Icons.headset_mic_rounded, size: 16),
              label: Text(
                'Open Support Center',
                style: GoogleFonts.inter(fontWeight: FontWeight.w700),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: kPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _activityRow(String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(
        border: Border(
            bottom: last
                ? BorderSide.none
                : BorderSide(color: kPrimary.withValues(alpha: 0.1))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: GoogleFonts.inter(
                    color: kMuted,
                    fontWeight: FontWeight.w500,
                    fontSize: 13)),
          ),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 13),
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

// ─── Empty Card ────────────────────────────────────────────────────────────────

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onTap,
    this.inline = false,
  });

  final IconData icon;
  final String title, subtitle, actionLabel;
  final VoidCallback onTap;
  final bool inline;

  @override
  Widget build(BuildContext context) {
    final inner = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: kPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: kPrimary, size: 20),
        ),
        const SizedBox(height: 12),
        Text(title,
            style: GoogleFonts.inter(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 14)),
        const SizedBox(height: 5),
        Text(subtitle,
            style: GoogleFonts.inter(
                color: kMuted, fontSize: 12, height: 1.45)),
        const SizedBox(height: 14),
        FilledButton(
          onPressed: onTap,
          style: FilledButton.styleFrom(
            backgroundColor: kPrimary,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12)),
          ),
          child: Text(actionLabel,
              style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
        ),
      ],
    );

    if (inline) return inner;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kPrimary.withValues(alpha: 0.12)),
      ),
      child: inner,
    );
  }
}

// ─── Section Header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.icon, required this.title});
  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: kPrimaryLight),
        const SizedBox(width: 7),
        Text(
          title,
          style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: kMuted,
            letterSpacing: 1.6,
          ),
        ),
      ],
    );
  }
}
