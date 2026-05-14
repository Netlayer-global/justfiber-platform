import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'billing_history_screen.dart';
import 'plan_catalog_screen.dart';
import 'service_hub_screen.dart';
import 'service_tracking_screen.dart';
import 'support_screen.dart';
import 'tabs/home_tab.dart';
import 'tabs/profile_tab.dart';

// Tab indices (5 tabs)
// 0 Home | 1 Billing | 2 Services | 3 Support | 4 Profile

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;
  int _prevIndex = 0;
  bool _handlingPendingNavigation = false;

  static const _navItems = [
    (icon: Icons.home_rounded, label: 'Home'),
    (icon: Icons.receipt_long_rounded, label: 'Billing'),
    (icon: Icons.router_rounded, label: 'Services'),
    (icon: Icons.support_agent_rounded, label: 'Support'),
    (icon: Icons.person_rounded, label: 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    _handlePendingNavigation(appState);

    final billingBadge = appState.billing.hasActionableDue ? 1 : 0;
    final unreadNotifs =
        appState.notifications.where((n) => n.readAt.isEmpty).length;
    final openSupport = appState.tickets
            .where((t) =>
                !t.status.toLowerCase().contains('closed') &&
                !t.status.toLowerCase().contains('resolved'))
            .length +
        appState.requests
            .where((r) =>
                !r.status.toLowerCase().contains('closed') &&
                !r.status.toLowerCase().contains('completed'))
            .length;
    final profileBadge = unreadNotifs.clamp(0, 99);
    final supportBadge = openSupport.clamp(0, 99);

    final badges = [0, 0, 0, 0, 0];

    final pages = [
      HomeTab(onNavigate: _goTo),
      const BillingHistoryScreen(),
      const ServiceHubScreen(),
      const SupportScreen(),
      const ProfileTab(),
    ];

    return Scaffold(
      backgroundColor: kBg,
      body: Column(
        children: [
          if (appState.isOffline)
            Material(
              color: const Color(0xFF1A0A00),
              child: SafeArea(
                bottom: false,
                child: Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: const BoxDecoration(
                    border: Border(
                        bottom: BorderSide(color: Color(0xFF7C2D12), width: 1)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.wifi_off_rounded,
                          color: Color(0xFFFB923C), size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'No internet connection. Pull to refresh when back online.',
                          style: GoogleFonts.inter(
                              color: const Color(0xFFFED7AA),
                              fontSize: 12,
                              fontWeight: FontWeight.w600),
                        ),
                      ),
                      GestureDetector(
                        onTap: () => appState.refresh(),
                        child: Text('Retry',
                            style: GoogleFonts.inter(
                                color: const Color(0xFFFB923C),
                                fontSize: 12,
                                fontWeight: FontWeight.w800)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) {
                final goingRight = _index >= _prevIndex;
                final begin = goingRight
                    ? const Offset(0.05, 0)
                    : const Offset(-0.05, 0);
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: begin,
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                );
              },
              child: KeyedSubtree(
                key: ValueKey<int>(_index),
                child: pages[_index],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: _BottomNav(
        current: _index,
        items: _navItems,
        badges: badges,
        onTap: _goTo,
      ),
    );
  }

  void _goTo(int i) {
    if (i == _index) return;
    setState(() {
      _prevIndex = _index;
      _index = i;
    });
  }

  void _handlePendingNavigation(AppState appState) {
    final target = appState.pendingNavigationTarget;
    if (target == null || target.isEmpty || _handlingPendingNavigation) return;
    _handlingPendingNavigation = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        if (!mounted) return;
        final next = appState.consumePendingNavigationTarget();
        final notifId = appState.consumePendingNotificationReadId();
        if (notifId != null && notifId.isNotEmpty) {
          await appState.markNotificationRead(notifId);
        }
        if (next == null || next.isEmpty) return;
        switch (next) {
          case 'billing':
            _goTo(1);
            await appState.refresh();
            return;
          case 'tracking':
            _goTo(3);
            await appState.refreshBookingTracking();
            return;
          case 'support':
            _goTo(3);
            await appState.refresh();
            return;
          case 'plans':
          case 'plans_resume':
            if (!mounted) return;
            // ignore: use_build_context_synchronously
            await Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
            if (mounted) await appState.refresh();
            return;
          case 'tracking_detail':
            if (!mounted) return;
            // ignore: use_build_context_synchronously
            await Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => const ServiceTrackingScreen()));
            if (mounted) await appState.refreshBookingTracking();
            return;
          default:
            _goTo(0);
            await appState.refresh();
        }
      } finally {
        _handlingPendingNavigation = false;
      }
    });
  }
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

typedef _NavItem = ({IconData icon, String label});

class _BottomNav extends StatefulWidget {
  const _BottomNav({
    required this.current,
    required this.items,
    required this.badges,
    required this.onTap,
  });

  final int current;
  final List<_NavItem> items;
  final List<int> badges;
  final ValueChanged<int> onTap;

  @override
  State<_BottomNav> createState() => _BottomNavState();
}

class _BottomNavState extends State<_BottomNav>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;
  double _fromFrac = 0.0;
  double _toFrac = 0.0;

  static double _centerFrac(int index, int count) => (index + 0.5) / count;
  double get _curFrac => _fromFrac + (_toFrac - _fromFrac) * _anim.value;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 380));
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutBack)
      ..addListener(() => setState(() {}));
    _fromFrac = _centerFrac(widget.current, widget.items.length);
    _toFrac = _fromFrac;
    _ctrl.value = 1.0;
  }

  @override
  void didUpdateWidget(covariant _BottomNav old) {
    super.didUpdateWidget(old);
    if (old.current != widget.current) {
      _fromFrac = _curFrac;
      _toFrac = _centerFrac(widget.current, widget.items.length);
      _ctrl.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.items.length;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 0, 18, 12),
        child: Container(
          height: 82,
          decoration: BoxDecoration(
            color: const Color(0xFF0D0D14),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.58),
                blurRadius: 34,
                offset: const Offset(0, 14),
              ),
              BoxShadow(
                color: kPrimary.withValues(alpha: 0.1),
                blurRadius: 34,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final totalW = constraints.maxWidth;
              // Circle: 40px, vertically centered leaving room for label
              const indicatorWidth = 46.0;
              // icon+gap+label ≈ 22+4+11 = 37px, center it in 72
              final indicatorLeft = _curFrac * totalW - indicatorWidth / 2;

              return Stack(
                children: [
                  // ── Sliding circle background ─────────────────────────
                  AnimatedPositioned(
                    duration: const Duration(milliseconds: 340),
                    curve: Curves.easeOutCubic,
                    left: indicatorLeft,
                    top: 0,
                    child: Container(
                      width: indicatorWidth,
                      height: 3,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF7C3AED), Color(0xFFA855F7)],
                        ),
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: [
                          BoxShadow(
                            color: kPrimary.withValues(alpha: 0.55),
                            blurRadius: 12,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ── Tab items ─────────────────────────────────────────
                  Row(
                    children: List.generate(count, (i) {
                      final item = widget.items[i];
                      final sel = i == widget.current;
                      return Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            HapticFeedback.lightImpact();
                            widget.onTap(i);
                          },
                          child: SizedBox(
                            height: 82,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                AnimatedContainer(
                                  duration: const Duration(milliseconds: 220),
                                  curve: Curves.easeOutCubic,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 6, vertical: 8),
                                  decoration: BoxDecoration(
                                    color: sel
                                        ? kPrimary.withValues(alpha: 0.1)
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(16),
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        item.icon,
                                        size: 22,
                                        color: sel
                                            ? kPrimaryLight
                                            : Colors.white
                                                .withValues(alpha: 0.42),
                                      ),
                                      const SizedBox(height: 5),
                                      Text(
                                        item.label,
                                        style: GoogleFonts.inter(
                                          fontSize: 10,
                                          fontWeight: sel
                                              ? FontWeight.w800
                                              : FontWeight.w500,
                                          color: sel
                                              ? kPrimaryLight
                                              : Colors.white
                                                  .withValues(alpha: 0.42),
                                          letterSpacing: 0,
                                        ),
                                      ),
                                      AnimatedContainer(
                                        duration:
                                            const Duration(milliseconds: 220),
                                        margin: const EdgeInsets.only(top: 4),
                                        width: sel ? 5 : 0,
                                        height: sel ? 5 : 0,
                                        decoration: const BoxDecoration(
                                          color: kPrimary,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (widget.badges[i] > 0)
                                  Positioned(
                                    top: 10,
                                    right: 10,
                                    child: _BadgeDot(count: widget.badges[i]),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 5,
                    child: Center(
                      child: Container(
                        width: 92,
                        height: 3,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.28),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _BadgeDot extends StatelessWidget {
  const _BadgeDot({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    final showNumber = count > 1;
    return Container(
      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
      padding: showNumber
          ? const EdgeInsets.symmetric(horizontal: 4)
          : EdgeInsets.zero,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFF6B6B), Color(0xFFEF4444)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        shape: showNumber ? BoxShape.rectangle : BoxShape.circle,
        borderRadius: showNumber ? BorderRadius.circular(999) : null,
        border: Border.all(color: Colors.black, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFEF4444).withValues(alpha: 0.5),
            blurRadius: 6,
            spreadRadius: 1,
          ),
        ],
      ),
      child: showNumber
          ? Text(
              count > 9 ? '9+' : '$count',
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 8,
                fontWeight: FontWeight.w800,
              ),
              textAlign: TextAlign.center,
            )
          : null,
    );
  }
}
