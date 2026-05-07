import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'support_assistant_screen.dart';
import 'support_history_screen.dart';

/// A clean, simplified Support landing screen.
///
/// Replaces the dense `SupportHistoryScreen` as the primary "Support" tab.
/// Layout:
///   1. Friendly header
///   2. Big "What's wrong?" category cards
///   3. Talk-to-us actions (chat, call)
///   4. Compact recent cases list (tickets + requests merged)
///   5. View full history link
class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  static const _supportPhone = '+919240204444';
  static const _supportPhoneDisplay = '+91 92402 04444';

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final cases = _recentCases(appState);

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refresh,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Help & Support',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5)),
                    const SizedBox(height: 4),
                    Text(
                      'Tell us what is happening — we will guide you.',
                      style: GoogleFonts.inter(
                          color: kMuted, fontSize: 13, height: 1.4),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 18),
            // Big primary "Call us" card with the support number
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _CallCard(
                phoneDisplay: _supportPhoneDisplay,
                onCall: () => _call(context),
                onChat: () => Navigator.of(context).push(
                  MaterialPageRoute(
                      builder: (_) => const SupportAssistantScreen()),
                ),
              ),
            ),

            const SizedBox(height: 22),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
              child: _sectionLabel("WHAT'S WRONG?"),
            ),
            const SizedBox(height: 10),
            _categories(context),

            const SizedBox(height: 22),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
              child: Row(
                children: [
                  Expanded(child: _sectionLabel('YOUR RECENT CASES')),
                  if (cases.isNotEmpty)
                    PressableScale(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => const SupportHistoryScreen()),
                      ),
                      child: Text('View all',
                          style: GoogleFonts.inter(
                              color: kPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            if (cases.isEmpty)
              _emptyCases(context)
            else
              ...cases.take(4).map((c) => Padding(
                    padding:
                        const EdgeInsets.fromLTRB(20, 0, 20, 10),
                    child: _CaseTile(
                      reference: c.reference,
                      title: c.title,
                      status: c.status,
                      createdAt: c.createdAt,
                      isTicket: c.isTicket,
                    ),
                  )),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  Widget _sectionLabel(String text) => Text(
        text,
        style: GoogleFonts.inter(
            color: kMuted,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4),
      );

  Widget _categories(BuildContext context) {
    const items = [
      _Category('Internet down', Icons.wifi_off_rounded,
          Color(0xFFEF4444), 'internet'),
      _Category('Slow speed', Icons.speed_rounded,
          Color(0xFFFBBF24), 'speed'),
      _Category('Wi-Fi problem', Icons.router_rounded,
          Color(0xFF60A5FA), 'wifi'),
      _Category('Billing issue', Icons.receipt_long_rounded,
          Color(0xFF34D399), 'billing'),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.45,
        children: items
            .map((cat) => _CategoryCard(
                  category: cat,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                        builder: (_) => SupportAssistantScreen(
                            issueType: cat.issueType)),
                  ),
                ))
            .toList(),
      ),
    );
  }

  Widget _emptyCases(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
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
                  color: kPrimary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.inbox_rounded, color: kPrimary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('No active cases',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(
                        'Pick a category above to start a request or chat.',
                        style: GoogleFonts.inter(
                            color: kMuted, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
        ),
      );

  Future<void> _call(BuildContext context) async {
    final uri = Uri(scheme: 'tel', path: _supportPhone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to start a call.')),
      );
    }
  }

  // Merge tickets + requests, sort by createdAt desc, prefer open
  List<_Case> _recentCases(AppState appState) {
    final all = <_Case>[];
    for (final t in appState.tickets) {
      all.add(_Case(
        reference: t.ticketNumber,
        title: t.subject.isEmpty ? t.category : t.subject,
        status: t.status,
        createdAt: t.createdAt,
        isTicket: true,
      ));
    }
    for (final r in appState.requests) {
      all.add(_Case(
        reference: r.referenceNumber,
        title: r.title.isEmpty ? r.type : r.title,
        status: r.status,
        createdAt: r.createdAt,
        isTicket: false,
      ));
    }
    all.sort((a, b) {
      final aClosed = _isClosed(a.status) ? 1 : 0;
      final bClosed = _isClosed(b.status) ? 1 : 0;
      if (aClosed != bClosed) return aClosed - bClosed;
      return b.createdAt.compareTo(a.createdAt);
    });
    return all;
  }

  static bool _isClosed(String s) {
    final v = s.toLowerCase();
    return v.contains('closed') ||
        v.contains('resolved') ||
        v.contains('completed') ||
        v.contains('done');
  }
}

// ── Internal models ──────────────────────────────────────────────────────────

class _Category {
  const _Category(this.label, this.icon, this.color, this.issueType);
  final String label;
  final IconData icon;
  final Color color;
  final String issueType;
}

class _Case {
  _Case({
    required this.reference,
    required this.title,
    required this.status,
    required this.createdAt,
    required this.isTicket,
  });
  final String reference, title, status, createdAt;
  final bool isTicket;
}

// ── Widgets ──────────────────────────────────────────────────────────────────

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.category, required this.onTap});
  final _Category category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: category.color.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(category.icon, color: category.color, size: 20),
            ),
            Text(
              category.label,
              style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800),
            ),
          ],
        ),
      ),
    );
  }
}

/// Hero "Talk to us" card.
///
/// Shows the support phone number prominently with a big green Call button
/// and a secondary Chat button. Tapping the number itself also dials.
class _CallCard extends StatelessWidget {
  const _CallCard({
    required this.phoneDisplay,
    required this.onCall,
    required this.onChat,
  });

  final String phoneDisplay;
  final VoidCallback onCall;
  final VoidCallback onChat;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF13051F), Color(0xFF6D28D9)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x55A855F7)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFA855F7).withValues(alpha: 0.18),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFF34D399).withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.support_agent_rounded,
                    color: Color(0xFF34D399), size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('24×7 Support',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text('We answer in under a minute',
                        style: GoogleFonts.inter(
                            color: Colors.white70, fontSize: 12)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Tappable phone number
          PressableScale(
            onTap: onCall,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                  horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: Colors.white.withValues(alpha: 0.12)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.phone_in_talk_rounded,
                      color: Colors.white70, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      phoneDisplay,
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5),
                    ),
                  ),
                  Icon(Icons.copy_rounded,
                      color: Colors.white.withValues(alpha: 0.5),
                      size: 16),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: PressableScale(
                  onTap: onCall,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFF34D399),
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF34D399)
                              .withValues(alpha: 0.4),
                          blurRadius: 14,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.call_rounded,
                            color: Colors.black, size: 18),
                        const SizedBox(width: 8),
                        Text('Call now',
                            style: GoogleFonts.inter(
                                color: Colors.black,
                                fontSize: 14,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: PressableScale(
                  onTap: onChat,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.chat_bubble_rounded,
                            color: Colors.white, size: 16),
                        const SizedBox(width: 8),
                        Text('Chat',
                            style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CaseTile extends StatelessWidget {
  const _CaseTile({
    required this.reference,
    required this.title,
    required this.status,
    required this.createdAt,
    required this.isTicket,
  });
  final String reference, title, status, createdAt;
  final bool isTicket;

  Color _statusColor() {
    final s = status.toLowerCase();
    if (s.contains('resolved') ||
        s.contains('closed') ||
        s.contains('completed') ||
        s.contains('done')) {
      return const Color(0xFF34D399);
    }
    if (s.contains('progress') ||
        s.contains('working') ||
        s.contains('assigned')) {
      return const Color(0xFFFBBF24);
    }
    return const Color(0xFF60A5FA);
  }

  @override
  Widget build(BuildContext context) {
    final color = _statusColor();
    return PressableScale(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const SupportHistoryScreen()),
      ),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: kBorder),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: (isTicket ? kPrimary : const Color(0xFF60A5FA))
                    .withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                isTicket
                    ? Icons.support_agent_rounded
                    : Icons.assignment_rounded,
                size: 18,
                color: isTicket ? kPrimary : const Color(0xFF60A5FA),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title.isEmpty ? reference : title,
                    style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$reference · ${isTicket ? 'Ticket' : 'Request'}',
                    style: GoogleFonts.inter(
                        color: kMuted, fontSize: 11),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(
                  horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                status,
                style: GoogleFonts.inter(
                    color: color,
                    fontSize: 10,
                    fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
