import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';

class ServiceTrackingScreen extends StatelessWidget {
  const ServiceTrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final latestBooking = appState.latestBooking;
    final bookingTracking = appState.bookingTracking;
    final visits = appState.installerVisits;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Booking & Visit Tracking'),
        backgroundColor: const Color(0xFF090C1A),
        foregroundColor: Colors.white,
      ),
      backgroundColor: const Color(0xFF060816),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF10213A), Color(0xFF1D4ED8)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Current booking', style: Theme.of(context).textTheme.titleLarge?.copyWith(color: Colors.white)),
                const SizedBox(height: 12),
                _row('Booking no.', latestBooking?.bookingNumber ?? '-'),
                _row('Plan', latestBooking?.planName ?? '-'),
                _row('Amount', latestBooking == null ? '-' : 'Rs ${latestBooking.amount.toStringAsFixed(0)}'),
                _row('Current step', bookingTracking?.currentStep ?? latestBooking?.currentStep ?? '-'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: appState.busy ? null : () => appState.refreshBookingTracking(),
                  child: const Text('Refresh tracking'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Booking timeline', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (bookingTracking == null || bookingTracking.steps.isEmpty)
                  const Text('No booking timeline available yet.', style: TextStyle(color: Color(0xFF7B625A)))
                else
                  ...bookingTracking.steps.map((step) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 10,
                              height: 10,
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
                                  Text(step.code.replaceAll('_', ' '), style: const TextStyle(fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 4),
                                  Text(step.at.isEmpty ? 'Pending' : step.at, style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12)),
                                ],
                              ),
                            ),
                            Text(step.status, style: TextStyle(color: _stepColor(step.status), fontSize: 12)),
                          ],
                        ),
                      )),
              ],
            ),
          ),
          const SizedBox(height: 18),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Installer visits', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                if (visits.isEmpty)
                  const Text('No installer visit or complaint job assigned yet.', style: TextStyle(color: Color(0xFF7B625A)))
                else
                  ...visits.map((visit) => Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(18),
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
                                        Text(visit.jobNumber, style: const TextStyle(fontWeight: FontWeight.w700)),
                                        const SizedBox(height: 4),
                                        Text(
                                          '${visit.type} | ${visit.priority} | ${visit.createdAt.isEmpty ? '-' : visit.createdAt}',
                                          style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(visit.status, style: TextStyle(color: _stepColor(visit.status), fontWeight: FontWeight.w600)),
                                      if (visit.completedAt.isNotEmpty)
                                        Text(visit.completedAt, style: const TextStyle(color: Color(0xFF7B625A), fontSize: 12)),
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
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Text(label, style: const TextStyle(color: Colors.white70)),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
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
          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13),
          children: [
            TextSpan(text: '$label: ', style: const TextStyle(fontWeight: FontWeight.w700)),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }

  Future<void> _openMap(String mapUrl) async {
    final uri = Uri.tryParse(mapUrl);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
