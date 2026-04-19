import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'billing_history_screen.dart';
import 'plan_catalog_screen.dart';
import 'service_tracking_screen.dart';
import 'support_history_screen.dart';

// ── Notification kind enum ────────────────────────────────────────────────────

enum _Kind { billing, tracking, support, general }

// ── Screen ────────────────────────────────────────────────────────────────────

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  // ── Categorisation ──────────────────────────────────────────────────────────

  _Kind _kindFor(NotificationItem item) {
    final type = item.type.toLowerCase();
    if (type.contains('billing_') ||
        type.contains('refund') ||
        type.contains('receipt')) { return _Kind.billing; }
    if (type.contains('booking') ||
        type.contains('installer') ||
        type.contains('job')) { return _Kind.tracking; }
    if (type.contains('ticket') ||
        type.contains('request') ||
        type.contains('support')) { return _Kind.support; }

    final text = '${item.title} ${item.body}'.toLowerCase();
    if (text.contains('bill') ||
        text.contains('invoice') ||
        text.contains('payment') ||
        text.contains('due') ||
        text.contains('receipt') ||
        text.contains('gst')) { return _Kind.billing; }
    if (text.contains('booking') ||
        text.contains('install') ||
        text.contains('visit')) { return _Kind.tracking; }
    if (text.contains('ticket') ||
        text.contains('support') ||
        text.contains('complaint')) { return _Kind.support; }
    return _Kind.general;
  }

  // ── Kind metadata ───────────────────────────────────────────────────────────

  static const _kindMeta = {
    _Kind.billing: (
      label: 'Billing',
      icon: Icons.receipt_long_rounded,
      color: Color(0xFFF59E0B),
      bg: Color(0xFF1F1500),
      border: Color(0x44F59E0B),
    ),
    _Kind.tracking: (
      label: 'Tracking',
      icon: Icons.router_rounded,
      color: Color(0xFFA855F7),
      bg: Color(0xFF160B24),
      border: Color(0x44A855F7),
    ),
    _Kind.support: (
      label: 'Support',
      icon: Icons.support_agent_rounded,
      color: Color(0xFF60A5FA),
      bg: Color(0xFF091525),
      border: Color(0x4460A5FA),
    ),
    _Kind.general: (
      label: 'Update',
      icon: Icons.notifications_rounded,
      color: Color(0xFF94A3B8),
      bg: Color(0xFF0F1018),
      border: Color(0x3394A3B8),
    ),
  };

  // ── Detail lines from payload ────────────────────────────────────────────────

  List<(String, String)> _details(NotificationItem item) {
    final p = item.payload;
    final lines = <(String, String)>[];

    void add(String k, String v) {
      if (v.isNotEmpty) lines.add((k, v));
    }

    add('Plan', (p['planName'] ?? '').toString());
    final w24 = (p['wifiSsid24'] ?? '').toString();
    final w5 = (p['wifiSsid5'] ?? '').toString();
    if (w24.isNotEmpty || w5.isNotEmpty) {
      add('Wi-Fi', '${w24.isEmpty ? '-' : w24}${w5.isEmpty ? '' : ' / $w5'}');
    }
    add('Password', (p['wifiPassword'] ?? '').toString());
    add('Config', (p['configStatus'] ?? '').toString());
    add('Resolution', (p['resolutionCode'] ?? '').toString());
    add('Note', (p['resolutionNote'] ?? '').toString());

    final recPlan = (p['recommendedPlanName'] ?? '').toString();
    if (recPlan.isNotEmpty) {
      final spd = (p['recommendedSpeedMbps'] ?? '').toString();
      final price = (p['recommendedPrice'] ?? '').toString();
      add('Upgrade',
          '$recPlan${spd.isEmpty ? '' : ' · ${spd.replaceAll('.0', '')} Mbps'}${price.isEmpty ? '' : ' · Rs ${price.replaceAll('.0', '')}'}');
    }

    if (p['replacedDevice'] == true) {
      add('ONT replaced', (p['newSerialNumber'] ?? 'Yes').toString());
      add('Old ONT', (p['oldSerialNumber'] ?? '').toString());
    }
    return lines;
  }

  bool _hasUpgradeOffer(NotificationItem item) =>
      item.payload['upgradeRecommended'] == true ||
      (item.payload['recommendedPlanCode'] ?? '').toString().isNotEmpty;

  // ── Actions ─────────────────────────────────────────────────────────────────

  Future<void> _openAction(
      BuildContext context, AppState appState, NotificationItem item) async {
    if (item.id.isNotEmpty) await appState.markNotificationRead(item.id);
    if (!context.mounted) return;

    if (_hasUpgradeOffer(item)) {
      await Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => const PlanCatalogScreen()));
      if (context.mounted) await appState.refresh();
      return;
    }
    switch (_kindFor(item)) {
      case _Kind.billing:
        await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const BillingHistoryScreen()));
        break;
      case _Kind.tracking:
        await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()));
        break;
      case _Kind.support:
      case _Kind.general:
        await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const SupportHistoryScreen()));
        break;
    }
    if (context.mounted) await appState.refresh();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  String _relTime(NotificationItem item) {
    if (item.createdAt.isEmpty) return 'Latest';
    final dt = DateTime.tryParse(item.createdAt);
    if (dt == null) return item.createdAt;
    final diff = DateTime.now().difference(dt.toLocal());
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }

  // ── Build ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final notifs = appState.notifications;
    final unread = notifs.where((n) => n.readAt.isEmpty).length;

    CustomerConnection? conn;
    for (final c in appState.connections) {
      if (c.customerId == appState.selectedCustomerId) {
        conn = c;
        break;
      }
    }

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refresh,
        child: CustomScrollView(
          slivers: [
            // ── Simple top bar ────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.only(
                  top: MediaQuery.of(context).padding.top + 18,
                  left: 18,
                  right: 18,
                  bottom: 20,
                ),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: kSurface,
                          borderRadius: BorderRadius.circular(11),
                          border: Border.all(color: kBorder),
                        ),
                        child: const Icon(Icons.arrow_back_ios_new_rounded,
                            color: Colors.white, size: 16),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Alerts & Updates',
                              style: GoogleFonts.inter(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                  letterSpacing: -0.4)),
                          if (unread > 0)
                            Text('$unread unread',
                                style: GoogleFonts.inter(
                                    fontSize: 12, color: kMuted)),
                        ],
                      ),
                    ),
                    if (unread > 0)
                      GestureDetector(
                        onTap: () => appState.markAllNotificationsRead(),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: kBorder),
                          ),
                          child: Text('Mark all read',
                              style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: kPrimaryLight)),
                        ),
                      ),
                  ],
                ),
              ),
            ),

            // ── Connection strip ──────────────────────────────────────
            if (conn != null)
              SliverToBoxAdapter(
                child: Padding(
                  padding:
                      const EdgeInsets.fromLTRB(18, 0, 18, 16),
                  child: _ConnectionStrip(connection: conn),
                ),
              ),

            // ── Error banner ──────────────────────────────────────────
            if ((appState.error ?? '').isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: kSurface2,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0x44FF6B6B)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded,
                            color: Color(0xFFFF6B6B), size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            appState.error!,
                            style: GoogleFonts.inter(
                                fontSize: 12,
                                color: const Color(0xFFFF8A8A)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

            // ── Empty state ───────────────────────────────────────────
            if (notifs.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: kSurface,
                          shape: BoxShape.circle,
                          border: Border.all(color: kBorder),
                        ),
                        child: const Icon(Icons.notifications_off_rounded,
                            color: kMuted, size: 32),
                      ),
                      const SizedBox(height: 16),
                      Text('All clear',
                          style: GoogleFonts.inter(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Colors.white)),
                      const SizedBox(height: 6),
                      Text(
                        'No alerts right now.\nBilling, support & install updates\nwill appear here.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                            fontSize: 13, color: kMuted, height: 1.55),
                      ),
                    ],
                  ),
                ),
              ),

            // ── Notification cards ────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 100),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    final item = notifs[i];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _NotifCard(
                        item: item,
                        kind: _kindFor(item),
                        details: _details(item),
                        relTime: _relTime(item),
                        hasUpgrade: _hasUpgradeOffer(item),
                        onAction: () => _openAction(context, appState, item),
                        onMarkRead: item.readAt.isEmpty
                            ? () async {
                                if (item.id.isNotEmpty) {
                                  await appState.markNotificationRead(item.id);
                                }
                              }
                            : null,
                      ),
                    );
                  },
                  childCount: notifs.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Notification card ─────────────────────────────────────────────────────────

class _NotifCard extends StatelessWidget {
  const _NotifCard({
    required this.item,
    required this.kind,
    required this.details,
    required this.relTime,
    required this.hasUpgrade,
    required this.onAction,
    required this.onMarkRead,
  });

  final NotificationItem item;
  final _Kind kind;
  final List<(String, String)> details;
  final String relTime;
  final bool hasUpgrade;
  final VoidCallback onAction;
  final VoidCallback? onMarkRead;

  @override
  Widget build(BuildContext context) {
    final meta = NotificationsScreen._kindMeta[kind]!;
    final isUnread = item.readAt.isEmpty;

    return Container(
      decoration: BoxDecoration(
        color: meta.bg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: isUnread
              ? meta.color.withValues(alpha: 0.4)
              : meta.border,
        ),
        boxShadow: isUnread
            ? [
                BoxShadow(
                  color: meta.color.withValues(alpha: 0.1),
                  blurRadius: 16,
                  offset: const Offset(0, 4),
                )
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header row ───────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: Row(
              children: [
                // Kind icon bubble
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: meta.color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                    border:
                        Border.all(color: meta.color.withValues(alpha: 0.25)),
                  ),
                  child: Icon(meta.icon, color: meta.color, size: 18),
                ),
                const SizedBox(width: 10),
                // Kind label + unread dot
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: meta.color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                    border:
                        Border.all(color: meta.color.withValues(alpha: 0.25)),
                  ),
                  child: Text(
                    meta.label,
                    style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: meta.color),
                  ),
                ),
                if (isUnread) ...[
                  const SizedBox(width: 6),
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: meta.color,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                            color: meta.color.withValues(alpha: 0.6),
                            blurRadius: 4,
                            spreadRadius: 1)
                      ],
                    ),
                  ),
                ],
                const Spacer(),
                Text(
                  relTime,
                  style: GoogleFonts.inter(
                      fontSize: 11,
                      color: kMuted,
                      fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),

          // ── Title & body ─────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                      height: 1.3),
                ),
                const SizedBox(height: 5),
                Text(
                  item.body,
                  style: GoogleFonts.inter(
                      fontSize: 13, color: kMuted, height: 1.5),
                ),
              ],
            ),
          ),

          // ── Payload detail lines ─────────────────────────────────────
          if (details.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: meta.color.withValues(alpha: 0.15)),
              ),
              child: Column(
                children: details.map((entry) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 80,
                          child: Text(
                            entry.$1,
                            style: GoogleFonts.inter(
                                fontSize: 11,
                                color: kMuted,
                                fontWeight: FontWeight.w500),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            entry.$2,
                            style: GoogleFonts.inter(
                                fontSize: 11,
                                color: Colors.white,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],

          // ── Action buttons ───────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
            child: Row(
              children: [
                Expanded(
                  child: _CardBtn(
                    label: hasUpgrade ? 'Upgrade Plan' : _actionLabel(kind),
                    color: meta.color,
                    filled: true,
                    onTap: onAction,
                  ),
                ),
                if (onMarkRead != null) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: _CardBtn(
                      label: 'Mark read',
                      color: meta.color,
                      filled: false,
                      onTap: onMarkRead!,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _actionLabel(_Kind k) {
    switch (k) {
      case _Kind.billing:
        return 'Open Billing';
      case _Kind.tracking:
        return 'Open Tracking';
      case _Kind.support:
        return 'Open Support';
      case _Kind.general:
        return 'View Support';
    }
  }
}

class _CardBtn extends StatelessWidget {
  const _CardBtn({
    required this.label,
    required this.color,
    required this.filled,
    required this.onTap,
  });

  final String label;
  final Color color;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: filled ? color : color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
          border: filled ? null : Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: filled ? Colors.white : color,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Connection strip ──────────────────────────────────────────────────────────

class _ConnectionStrip extends StatelessWidget {
  const _ConnectionStrip({required this.connection});
  final CustomerConnection connection;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(11),
              border: Border.all(color: kPrimary.withValues(alpha: 0.2)),
            ),
            child:
                const Icon(Icons.router_rounded, color: kPrimaryLight, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  connection.planName.isEmpty
                      ? 'Broadband connection'
                      : connection.planName,
                  style: GoogleFonts.inter(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Colors.white),
                ),
                const SizedBox(height: 2),
                Text(
                  connection.address.isEmpty
                      ? connection.serviceId
                      : connection.address,
                  style: GoogleFonts.inter(fontSize: 11, color: kMuted),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          // Online/offline pill
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
            decoration: BoxDecoration(
              color: connection.onlineStatus.toLowerCase().contains('active')
                  ? const Color(0x1A4ADE80)
                  : kSurface,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color:
                    connection.onlineStatus.toLowerCase().contains('active')
                        ? const Color(0x554ADE80)
                        : kBorder,
              ),
            ),
            child: Text(
              connection.onlineStatus.isEmpty
                  ? 'Unknown'
                  : connection.onlineStatus,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color:
                    connection.onlineStatus.toLowerCase().contains('active')
                        ? const Color(0xFF4ADE80)
                        : kMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
