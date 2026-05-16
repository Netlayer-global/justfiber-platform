import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../../widgets/pressable_scale.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  PROFILE — JustFiber Design System (see /design-system/MASTER.md)
// ─────────────────────────────────────────────────────────────────────────────

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final dashboard = appState.dashboard;
    final billing = appState.billing;

    CustomerConnection? conn;
    for (final c in appState.connections) {
      if (c.customerId == appState.selectedCustomerId) {
        conn = c;
        break;
      }
    }

    final name = conn?.fullName.isNotEmpty == true
        ? conn!.fullName
        : dashboard.customerName;
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';
    final isActive =
        (conn?.status.toLowerCase().contains('active') ?? false) ||
            billing.paymentStatus.toLowerCase().contains('paid') ||
            billing.paymentStatus.isEmpty;

    return ListView(
      padding: EdgeInsets.only(
        top: MediaQuery.of(context).padding.top + 16,
        bottom: 120,
      ),
      children: [
        // ── Headline ─────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Profile',
                style: GoogleFonts.inter(
                  color: kText,
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.6,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Account & connection details',
                style: GoogleFonts.inter(
                  color: kTextMuted,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),

        // ── Profile hero card ──────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: _ProfileHero(
            name: name,
            initial: initial,
            planName: billing.currentPlan,
            isActive: isActive,
            statusLabel: billing.paymentStatus.isEmpty
                ? (isActive ? 'Active' : 'Inactive')
                : billing.paymentStatus,
            dueAmount: billing.dueAmount,
            ticketCount: appState.tickets.length,
            connStatus:
                conn?.status.isNotEmpty == true ? conn!.status : 'Active',
            connectionId: conn?.customerId ?? '',
            connectionAddress: conn?.address ?? '',
            totalConnections: appState.connections.length,
            connectionIndex: appState.connections.indexWhere(
                (c) => c.customerId == appState.selectedCustomerId),
          ),
        ),

        const SizedBox(height: 28),

        // ── Personal Details ───────────────────────────────────
        _Section(
          title: 'PERSONAL DETAILS',
          rows: [
            _row('Full Name', name),
            _row(
              'Mobile',
              conn?.mobile.isNotEmpty == true
                  ? conn!.mobile
                  : (appState.session?.mobile ?? '—'),
            ),
            if (conn?.email.isNotEmpty == true) _row('Email', conn!.email),
            _row(
              'Address',
              conn?.address.isNotEmpty == true ? conn!.address : '—',
            ),
          ],
        ),
        const SizedBox(height: 14),

        // ── Account Info ───────────────────────────────────────
        _Section(
          title: 'ACCOUNT',
          rows: [
            if (conn?.customerId.isNotEmpty == true)
              _row('Customer ID', conn!.customerId),
            if (conn?.serviceId.isNotEmpty == true)
              _row('Service ID', conn!.serviceId),
            if (conn?.accountNumber.isNotEmpty == true)
              _row('Account No.', conn!.accountNumber),
            _row(
              'Bill Cycle',
              billing.billCycle.isEmpty ? '—' : billing.billCycle,
            ),
            _row(
              'Bill Mode',
              billing.billMode.isEmpty ? '—' : billing.billMode,
            ),
          ],
        ),
        const SizedBox(height: 14),

        // ── Current Plan ───────────────────────────────────────
        _Section(
          title: 'CURRENT PLAN',
          rows: [
            _row('Plan',
                billing.currentPlan.isEmpty ? '—' : billing.currentPlan),
            _row(
              'Amount',
              billing.recurringAmount > 0
                  ? '₹${billing.recurringAmount.toStringAsFixed(0)}/mo'
                  : billing.dueAmount > 0
                      ? '₹${billing.dueAmount.toStringAsFixed(0)}'
                      : '—',
            ),
            _row(
              'Next Renewal',
              billing.nextBillDate.isEmpty
                  ? '—'
                  : _fmtDate(billing.nextBillDate),
            ),
            _row(
              'Last Payment',
              billing.lastPaymentAmount > 0
                  ? '₹${billing.lastPaymentAmount.toStringAsFixed(0)}'
                  : '—',
            ),
          ],
        ),

        if (appState.connections.length > 1) ...[
          const SizedBox(height: 14),
          _ConnectionsSection(
            connections: appState.connections,
            selectedId: appState.selectedCustomerId,
            onSelect: appState.selectConnection,
          ),
        ],

        const SizedBox(height: 22),

        // ── Logout ─────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 22),
          child: PressableScale(
            onTap: appState.logout,
            haptic: true,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(kRButton),
                border: Border.all(color: kBorderSoft),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.logout_rounded,
                      color: kDanger, size: 18),
                  const SizedBox(width: 10),
                  Text(
                    'Logout',
                    style: GoogleFonts.inter(
                      color: kDanger,
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  static MapEntry<String, String> _row(String k, String v) => MapEntry(k, v);
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROFILE HERO — simple accent gradient (matches services page)
// ═══════════════════════════════════════════════════════════════════════════

class _ProfileHero extends StatelessWidget {
  const _ProfileHero({
    required this.name,
    required this.initial,
    required this.planName,
    required this.isActive,
    required this.statusLabel,
    required this.dueAmount,
    required this.ticketCount,
    required this.connStatus,
    required this.connectionId,
    required this.connectionAddress,
    required this.totalConnections,
    required this.connectionIndex,
  });

  final String name, initial, planName, statusLabel, connStatus;
  final String connectionId, connectionAddress;
  final int totalConnections, connectionIndex;
  final bool isActive;
  final double dueAmount;
  final int ticketCount;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
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
              child: Row(
                children: [
                  // Avatar
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.18),
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.3)),
                    ),
                    child: Center(
                      child: Text(
                        initial,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          name.isEmpty ? 'Your Account' : name,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                            height: 1.15,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isActive ? kSuccess : kDanger,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              statusLabel,
                              style: GoogleFonts.inter(
                                color: Colors.white.withValues(alpha: 0.9),
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (planName.isNotEmpty) ...[
                              const SizedBox(width: 10),
                              Flexible(
                                child: Text(
                                  planName,
                                  style: GoogleFonts.inter(
                                    color: Colors.white
                                        .withValues(alpha: 0.75),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION (info card with rows)
// ═══════════════════════════════════════════════════════════════════════════

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.rows});
  final String title;
  final List<MapEntry<String, String>> rows;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 12),
            child: Text(
              title,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: kTextMuted,
                letterSpacing: 1.6,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(kRCard),
              border: Border.all(color: kBorderSoft),
            ),
            child: Column(
              children: List.generate(rows.length, (i) {
                final isLast = i == rows.length - 1;
                return _InfoRow(
                  label: rows[i].key,
                  value: rows[i].value,
                  last: isLast,
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    this.last = false,
  });
  final String label, value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 110,
                child: Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: kTextMuted,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  value.isEmpty ? '—' : value,
                  textAlign: TextAlign.right,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: kText,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (!last)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18),
            child: Divider(color: kBorderSoft, height: 1, thickness: 1),
          ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CONNECTIONS LIST
// ═══════════════════════════════════════════════════════════════════════════

class _ConnectionsSection extends StatelessWidget {
  const _ConnectionsSection({
    required this.connections,
    required this.selectedId,
    required this.onSelect,
  });
  final List<CustomerConnection> connections;
  final String? selectedId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 12),
            child: Text(
              'MY CONNECTIONS',
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: kTextMuted,
                letterSpacing: 1.6,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(kRCard),
              border: Border.all(color: kBorderSoft),
            ),
            child: Column(
              children: List.generate(connections.length, (i) {
                final c = connections[i];
                final isSelected = c.customerId == selectedId;
                final isLast = i == connections.length - 1;
                return _ConnectionRow(
                  connection: c,
                  isSelected: isSelected,
                  isLast: isLast,
                  onTap: isSelected ? null : () => onSelect(c.customerId),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

class _ConnectionRow extends StatelessWidget {
  const _ConnectionRow({
    required this.connection,
    required this.isSelected,
    required this.isLast,
    required this.onTap,
  });

  final CustomerConnection connection;
  final bool isSelected;
  final bool isLast;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        PressableScale(
          onTap: onTap,
          haptic: true,
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: isSelected ? kAccentSoft : kSurfaceLow,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: isSelected ? kAccent : kBorderSoft),
                  ),
                  child: Icon(
                    Icons.wifi_rounded,
                    size: 18,
                    color: isSelected ? kAccent : kTextMuted,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        connection.address.isNotEmpty
                            ? connection.address
                            : (connection.fullName.isNotEmpty
                                ? connection.fullName
                                : connection.customerId),
                        style: GoogleFonts.inter(
                          color: kText,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        connection.customerId,
                        style: GoogleFonts.inter(
                          color: kTextMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (isSelected)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: kAccentSoft,
                      borderRadius: BorderRadius.circular(kRPill),
                    ),
                    child: Text(
                      'Active',
                      style: GoogleFonts.inter(
                        color: kAccent,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: kSurfaceLow,
                      borderRadius: BorderRadius.circular(kRPill),
                      border: Border.all(color: kBorderSoft),
                    ),
                    child: Text(
                      'Switch',
                      style: GoogleFonts.inter(
                        color: kTextMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        if (!isLast)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18),
            child: Divider(color: kBorderSoft, height: 1, thickness: 1),
          ),
      ],
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

String _fmtDate(String raw) {
  try {
    final dt = DateTime.parse(raw);
    const m = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${m[dt.month - 1]} ${dt.day}, ${dt.year}';
  } catch (_) {
    final t = raw.indexOf('T');
    return t > 0 ? raw.substring(0, t) : raw;
  }
}
