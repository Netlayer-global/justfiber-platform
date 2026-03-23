import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Requests & Tracking'),
        backgroundColor: const Color(0xFF050505),
        foregroundColor: const Color(0xFFEFEEE8),
      ),
      backgroundColor: const Color(0xFF050505),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF090D15), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'TRACKING CONSOLE',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF9CA3AF),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Current booking',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: const Color(0xFFEFEEE8), fontSize: 28),
                ),
                const SizedBox(height: 12),
                _row('Booking no.', latestBooking?.bookingNumber ?? '-'),
                _row('Plan', latestBooking?.planName ?? '-'),
                _row('Amount', latestBooking == null ? '-' : 'Rs ${latestBooking.amount.toStringAsFixed(0)}'),
                _row('Current step', bookingTracking?.currentStep ?? latestBooking?.currentStep ?? '-'),
                _row('Preferred date', latestBooking?.preferredDate.isNotEmpty == true ? latestBooking!.preferredDate : '-'),
                _row('Preferred slot', latestBooking?.preferredSlotLabel.isNotEmpty == true ? latestBooking!.preferredSlotLabel : '-'),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(child: _countChip('Visits', visits.length)),
                    const SizedBox(width: 8),
                    Expanded(child: _countChip('Requests', requests.length)),
                    const SizedBox(width: 8),
                    Expanded(child: _countChip('Tickets', tickets.length)),
                  ],
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: appState.busy
                      ? null
                      : () async {
                          await appState.refreshBookingTracking();
                        },
                  style: FilledButton.styleFrom(backgroundColor: const Color(0xFFE6FF3C), foregroundColor: const Color(0xFF031B17)),
                  child: const Text('Refresh tracking'),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const BookingFlowScreen()),
                        );
                        if (context.mounted) {
                          await appState.refreshBookingTracking();
                        }
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEFEEE8),
                        backgroundColor: const Color(0xFF0E1520),
                        side: const BorderSide(color: Color(0x66E6FF3C)),
                      ),
                      child: const Text('Book another connection'),
                    ),
                    OutlinedButton(
                      onPressed: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
                        );
                        if (context.mounted) {
                          await appState.refreshBookingTracking();
                        }
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEFEEE8),
                        backgroundColor: const Color(0xFF0E1520),
                        side: const BorderSide(color: Color(0x66E6FF3C)),
                      ),
                      child: const Text('Need support'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFF0C1018),
            borderColor: const Color(0x22E6FF3C),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Booking timeline', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (bookingTracking == null || bookingTracking.steps.isEmpty)
                  const Text('No booking timeline available yet.', style: TextStyle(color: Color(0xFF9CA3AF)))
                else
                  ...bookingTracking.steps.asMap().entries.map((entry) {
                    final step = entry.value;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            margin: const EdgeInsets.only(top: 6),
                            decoration: BoxDecoration(
                              color: _stepColor(step.status),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(step.code.replaceAll('_', ' '), style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEFEEE8))),
                                const SizedBox(height: 4),
                                Text(step.at.isEmpty ? 'Pending' : step.at, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                                if (entry.key == 0 && latestBooking?.preferredSlotLabel.isNotEmpty == true) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    'Preferred slot: ${latestBooking!.preferredSlotLabel}',
                                    style: const TextStyle(color: Color(0xFFE6FF3C), fontSize: 12, fontWeight: FontWeight.w700),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Text(step.status, style: TextStyle(color: _stepColor(step.status), fontSize: 12)),
                        ],
                      ),
                    );
                  }),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFF0C1018),
            borderColor: const Color(0x22E6FF3C),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Installer visits', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (visits.isEmpty)
                  const Text('No installer visit or complaint job assigned yet.', style: TextStyle(color: Color(0xFF9CA3AF)))
                else
                  ...visits.map((visit) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF0B0F19), Color(0xFF111827)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(color: const Color(0x22E6FF3C)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(visit.jobNumber, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEFEEE8))),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${visit.type} | ${visit.priority} | ${visit.createdAt.isEmpty ? '-' : visit.createdAt}',
                                          style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(visit.status, style: TextStyle(color: _stepColor(visit.status), fontWeight: FontWeight.w600)),
                                      if (visit.completedAt.isNotEmpty)
                                        Text(visit.completedAt, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                                    ],
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              _visitInfo('Installer', visit.installerName.isEmpty ? 'Assigned team' : visit.installerName),
                              _visitInfo('ETA', visit.etaText.isEmpty ? '-' : visit.etaText),
                              _visitInfo('Latest update', visit.lastUpdateNote.isEmpty ? visit.latestEventCode : visit.lastUpdateNote),
                              _visitInfo('Updated at', visit.lastUpdateAt.isEmpty ? '-' : visit.lastUpdateAt),
                              if (visit.mapUrl.isNotEmpty) ...[
                                const SizedBox(height: 10),
                                OutlinedButton(
                                  onPressed: () => _openMap(visit.mapUrl),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: const Color(0xFFE6FF3C),
                                    backgroundColor: const Color(0xFF111827),
                                    side: const BorderSide(color: Color(0x66E6FF3C)),
                                  ),
                                  child: const Text('Open location'),
                                ),
                              ],
                            ],
                          ),
                        ),
                      )),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFF0C1018),
            borderColor: const Color(0x22E6FF3C),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Latest alerts', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (notifications.isEmpty)
                  const Text('No tracking alerts right now.', style: TextStyle(color: Color(0xFF9CA3AF)))
                else
                  ...notifications.take(3).map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF0B0F19), Color(0xFF111827)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0x22E6FF3C)),
                          ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.title, style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFFEFEEE8))),
                            const SizedBox(height: 6),
                            Text(item.body, style: const TextStyle(color: Color(0xFF9CA3AF), height: 1.4)),
                          ],
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const NotificationsScreen()),
                      );
                      if (context.mounted) {
                        await appState.refreshBookingTracking();
                      }
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFEFEEE8),
                      backgroundColor: const Color(0xFF0E1520),
                      side: const BorderSide(color: Color(0x55E6FF3C)),
                    ),
                    child: const Text('Open all alerts'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            color: const Color(0xFF0C1018),
            borderColor: const Color(0x22E6FF3C),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Support activity', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                _activityRow('Open requests', '${requests.length}'),
                _activityRow('Open tickets', '${tickets.length}'),
                _activityRow('Latest request', requests.isEmpty ? 'None' : '${requests.first.referenceNumber} | ${requests.first.status}'),
                _activityRow('Latest ticket', tickets.isEmpty ? 'None' : '${tickets.first.ticketNumber} | ${tickets.first.status}', last: true),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
                      );
                      if (context.mounted) {
                        await appState.refreshBookingTracking();
                      }
                    },
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFE6FF3C),
                      foregroundColor: const Color(0xFF111111),
                    ),
                    child: const Text('Open Support Center'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Color(0xB3EFEEE8))),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: const Color(0xFFEFEEE8), fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _countChip(String label, int count) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF101722),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x66E6FF3C)),
      ),
      child: Column(
        children: [
          Text('$count', style: const TextStyle(color: const Color(0xFFEFEEE8), fontWeight: FontWeight.w800, fontSize: 18)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
        ],
      ),
    );
  }

  Color _stepColor(String status) {
    final normalized = status.toLowerCase();
    if (normalized == 'done' || normalized == 'completed' || normalized == 'active') return const Color(0xFF22C55E);
    if (normalized == 'pending' || normalized == 'assigned' || normalized == 'accepted' || normalized == 'enroute' || normalized == 'onsite') {
      return const Color(0xFFF59E0B);
    }
    return const Color(0xFFD81F26);
  }

  Widget _visitInfo(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(color: Color(0xFFD1D5DB), fontSize: 13),
          children: [
            TextSpan(text: '$label: ', style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEFEEE8))),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }

  Widget _activityRow(String label, String value, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        border: Border(bottom: last ? BorderSide.none : const BorderSide(color: Color(0x22E6FF3C))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFEFEEE8))),
          ),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _openMap(String mapUrl) async {
    final uri = Uri.tryParse(mapUrl);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}

