import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'service_tracking_screen.dart';
import 'support_assistant_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  SUPPORT — Clean, premium. No support history page link.
//  Chat opens like Airtel (full-screen assistant). Track Service stays.
// ─────────────────────────────────────────────────────────────────────────────

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
        color: kAccent,
        backgroundColor: const Color(0xFF0A0A14),
        onRefresh: appState.refresh,
        child: ListView(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 16,
            bottom: 140,
          ),
          children: [
            // ── Headline ───────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: Text(
                'Support',
                style: GoogleFonts.inter(
                  color: kText,
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                ),
              ),
            ),
            const SizedBox(height: 20),

            // ── Chat CTA hero (Airtel-style — big accent card with chat icon) ─
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: PressableScale(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                      builder: (_) => const SupportAssistantScreen()),
                ),
                haptic: true,
                child: ClipRRect(
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
                          right: -50,
                          top: -50,
                          child: Container(
                            width: 160,
                            height: 160,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withValues(alpha: 0.06),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(22),
                          child: Row(
                            children: [
                              Container(
                                width: 52,
                                height: 52,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.18),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                      color: Colors.white
                                          .withValues(alpha: 0.25)),
                                ),
                                child: const Icon(
                                    Icons.chat_bubble_rounded,
                                    color: Colors.white,
                                    size: 24),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Chat with us',
                                      style: GoogleFonts.inter(
                                        color: Colors.white,
                                        fontSize: 18,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.3,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Get instant help with your connection, billing, or Wi-Fi',
                                      style: GoogleFonts.inter(
                                        color: Colors.white
                                            .withValues(alpha: 0.85),
                                        fontSize: 12,
                                        fontWeight: FontWeight.w500,
                                        height: 1.4,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Icon(Icons.arrow_forward_rounded,
                                  color: Colors.white, size: 20),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 22),

            // ── Call us row ────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: PressableScale(
                onTap: () => _call(context),
                haptic: true,
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(kRSurface),
                    border: Border.all(color: kBorderSoft),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: kAccentSoft,
                          borderRadius: BorderRadius.circular(kRSmall),
                        ),
                        child: const Icon(Icons.call_rounded,
                            color: kAccent, size: 20),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Call support',
                              style: GoogleFonts.inter(
                                color: kText,
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _supportPhoneDisplay,
                              style: GoogleFonts.inter(
                                color: kTextMuted,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right_rounded,
                          color: kTextFaint, size: 18),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 28),

            // ── Issue categories ──────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _Eyebrow("QUICK HELP"),
                  const SizedBox(height: 14),
                  GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.55,
                    children: const [
                      _Category('Internet down', Icons.wifi_off_rounded,
                          'internet'),
                      _Category(
                          'Slow speed', Icons.speed_rounded, 'speed'),
                      _Category(
                          'Wi-Fi problem', Icons.router_rounded, 'wifi'),
                      _Category('Billing issue',
                          Icons.receipt_long_rounded, 'billing'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // ── Track Service ─────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _Eyebrow('SERVICE'),
                  const SizedBox(height: 14),
                  PressableScale(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => const ServiceTrackingScreen()),
                    ),
                    haptic: true,
                    child: Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: kSurface,
                        borderRadius: BorderRadius.circular(kRSurface),
                        border: Border.all(color: kBorderSoft),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: kAccentSoft,
                              borderRadius: BorderRadius.circular(kRSmall),
                            ),
                            child: const Icon(
                                Icons.local_shipping_rounded,
                                color: kAccent,
                                size: 20),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Track Installation',
                                  style: GoogleFonts.inter(
                                    color: kText,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'View booking & installation progress',
                                  style: GoogleFonts.inter(
                                    color: kTextMuted,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded,
                              color: kTextFaint, size: 18),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Recent cases (inline, no separate page) ───────
            if (cases.isNotEmpty) ...[
              const SizedBox(height: 28),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                child: const _Eyebrow('RECENT CASES'),
              ),
              const SizedBox(height: 14),
              ...cases.take(3).map((c) => Padding(
                    padding: const EdgeInsets.fromLTRB(22, 0, 22, 10),
                    child: _CaseTile(
                      reference: c.reference,
                      title: c.title,
                      status: c.status,
                      isTicket: c.isTicket,
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }

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

// ═══════════════════════════════════════════════════════════════════════════

class _Eyebrow extends StatelessWidget {
  const _Eyebrow(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 2),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: kTextMuted,
          letterSpacing: 1.6,
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CATEGORY — translucent tile, accent icon
// ═══════════════════════════════════════════════════════════════════════════

class _Category extends StatelessWidget {
  const _Category(this.label, this.icon, this.issueType);
  final String label;
  final IconData icon;
  final String issueType;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(
            builder: (_) => SupportAssistantScreen(issueType: issueType)),
      ),
      haptic: true,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRSurface),
          border: Border.all(color: kBorderSoft),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: kAccentSoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: kAccent, size: 18),
            ),
            Text(
              label,
              style: GoogleFonts.inter(
                color: kText,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CASE TILE
// ═══════════════════════════════════════════════════════════════════════════

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

class _CaseTile extends StatelessWidget {
  const _CaseTile({
    required this.reference,
    required this.title,
    required this.status,
    required this.isTicket,
  });
  final String reference, title, status;
  final bool isTicket;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRSmall),
        border: Border.all(color: kBorderSoft),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: kAccentSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              isTicket
                  ? Icons.support_agent_rounded
                  : Icons.assignment_rounded,
              size: 18,
              color: kAccent,
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
                    color: kText,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  reference,
                  style: GoogleFonts.inter(color: kTextMuted, fontSize: 11),
                ),
              ],
            ),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: kAccentSoft,
              borderRadius: BorderRadius.circular(kRPill),
            ),
            child: Text(
              status,
              style: GoogleFonts.inter(
                color: kAccent,
                fontSize: 10,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
