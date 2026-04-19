import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../../widgets/pressable_scale.dart';
import '../support_history_screen.dart';

class PointsTab extends StatelessWidget {
  const PointsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final openTickets = appState.tickets
        .where((t) =>
            !t.status.toLowerCase().contains('closed') &&
            !t.status.toLowerCase().contains('resolved'))
        .length;
    final openRequests = appState.requests
        .where((r) =>
            !r.status.toLowerCase().contains('closed') &&
            !r.status.toLowerCase().contains('completed'))
        .length;

    return ListView(
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 18,
        left: 18,
        right: 18,
        bottom: 100,
      ),
      children: [
        // Hero
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF8224E3),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: const Color(0x55A855F7)),
          ),
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: const BoxDecoration(
                              color: Color(0xFF4ADE80), shape: BoxShape.circle),
                        ),
                        const SizedBox(width: 5),
                        Text('24/7 Support',
                            style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  const Spacer(),
                  Text('SUPPORT',
                      style: GoogleFonts.inter(
                          color: Colors.white60,
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.2)),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: const Icon(Icons.support_agent_rounded,
                        color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Support Center',
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.3)),
                      Text('Help & tickets',
                          style: GoogleFonts.inter(
                              color: Colors.white60, fontSize: 12)),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  _stat('Tickets', '${appState.tickets.length}'),
                  _statDiv(),
                  _stat('Open', '$openTickets'),
                  _statDiv(),
                  _stat('Requests', '${appState.requests.length}'),
                  _statDiv(),
                  _stat('Pending', '$openRequests'),
                ],
              ),
              const SizedBox(height: 18),
              PressableScale(
                onTap: () async {
                  await Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => const SupportHistoryScreen()));
                  if (context.mounted) await appState.refresh();
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 13),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(14),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.2)),
                  ),
                  alignment: Alignment.center,
                  child: Text('Open Support Center',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 14)),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 22),
        _sectionLabel('RECENT ACTIVITY'),
        const SizedBox(height: 10),

        if (appState.tickets.isEmpty && appState.requests.isEmpty)
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: kBorder),
            ),
            child: Text(
              'No tickets or requests yet. Open the support center to create one.',
              style: GoogleFonts.inter(color: kMuted, height: 1.5),
            ),
          )
        else ...[
          if (appState.tickets.isNotEmpty)
            ...appState.tickets.take(4).map((t) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ActivityRow(
                    icon: Icons.confirmation_number_rounded,
                    iconColor: const Color(0xFF60A5FA),
                    title: t.subject,
                    sub: '${t.ticketNumber} · ${t.category}',
                    status: t.status,
                  ),
                )),
          if (appState.requests.isNotEmpty)
            ...appState.requests.take(3).map((r) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _ActivityRow(
                    icon: Icons.build_circle_rounded,
                    iconColor: kPrimaryLight,
                    title: r.title,
                    sub: '${r.referenceNumber} · ${r.type}',
                    status: r.status,
                  ),
                )),
        ],
      ],
    );
  }

  Widget _sectionLabel(String t) => Text(
        t,
        style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: kMuted,
            letterSpacing: 1.6),
      );

  Widget _stat(String label, String value) => Expanded(
        child: Column(children: [
          Text(value,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(label,
              style: GoogleFonts.inter(
                  color: Colors.white54,
                  fontSize: 10,
                  fontWeight: FontWeight.w500)),
        ]),
      );

  Widget _statDiv() => Container(
      width: 1, height: 24, color: Colors.white.withValues(alpha: 0.18));
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.sub,
    required this.status,
  });

  final IconData icon;
  final Color iconColor;
  final String title, sub, status;

  @override
  Widget build(BuildContext context) {
    final isOpen = !status.toLowerCase().contains('closed') &&
        !status.toLowerCase().contains('resolved') &&
        !status.toLowerCase().contains('completed');
    final statusColor =
        isOpen ? const Color(0xFFF59E0B) : const Color(0xFF22C55E);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: iconColor.withValues(alpha: 0.2)),
            ),
            child: Icon(icon, color: iconColor, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: Colors.white),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(sub,
                    style: GoogleFonts.inter(fontSize: 11, color: kMuted)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: statusColor.withValues(alpha: 0.3)),
            ),
            child: Text(
              isOpen ? 'Open' : 'Closed',
              style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: statusColor),
            ),
          ),
        ],
      ),
    );
  }
}
