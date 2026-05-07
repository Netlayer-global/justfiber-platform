import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';

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
    final isActive = (conn?.status.toLowerCase().contains('active') ?? false) ||
        billing.paymentStatus.toLowerCase().contains('paid') ||
        billing.paymentStatus.isEmpty;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        // ── Hero Card (matches Home style) ─────────────────────────
        Padding(
          padding: EdgeInsets.only(
            top: MediaQuery.of(context).padding.top + 18,
            left: 18,
            right: 18,
          ),
          child: _ProfileHeroCard(
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
            connectionIndex:
                appState.connections.indexWhere((c) => c.customerId == appState.selectedCustomerId),
          ),
        ),

        const SizedBox(height: 24),

        // ── Personal Details ───────────────────────────────────────
        _Section(
          icon: Icons.person_outline_rounded,
          title: 'PERSONAL DETAILS',
          child: Column(
            children: [
              _InfoRow(label: 'Full Name', value: name),
              _InfoRow(
                label: 'Mobile',
                value: conn?.mobile.isNotEmpty == true
                    ? conn!.mobile
                    : (appState.session?.mobile ?? '—'),
              ),
              if (conn?.email.isNotEmpty == true)
                _InfoRow(label: 'Email', value: conn!.email),
              if (conn?.address.isNotEmpty == true)
                _InfoRow(label: 'Address', value: conn!.address, last: true)
              else
                const _InfoRow(label: 'Address', value: '—', last: true),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // ── Account Info ───────────────────────────────────────────
        _Section(
          icon: Icons.badge_outlined,
          title: 'ACCOUNT',
          child: Column(
            children: [
              if (conn?.customerId.isNotEmpty == true)
                _InfoRow(label: 'Customer ID', value: conn!.customerId),
              if (conn?.serviceId.isNotEmpty == true)
                _InfoRow(label: 'Service ID', value: conn!.serviceId),
              if (conn?.accountNumber.isNotEmpty == true)
                _InfoRow(label: 'Account No.', value: conn!.accountNumber),
              _InfoRow(
                label: 'Bill Cycle',
                value: billing.billCycle.isEmpty ? '—' : billing.billCycle,
              ),
              _InfoRow(
                label: 'Bill Mode',
                value: billing.billMode.isEmpty ? '—' : billing.billMode,
                last: true,
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // ── Current Plan ───────────────────────────────────────────
        _Section(
          icon: Icons.wifi_rounded,
          title: 'CURRENT PLAN',
          child: Column(
            children: [
              _InfoRow(
                label: 'Plan',
                value: billing.currentPlan.isEmpty ? '—' : billing.currentPlan,
              ),
              _InfoRow(
                label: 'Amount',
                value: billing.recurringAmount > 0
                    ? 'Rs ${billing.recurringAmount.toStringAsFixed(0)}/mo'
                    : billing.dueAmount > 0
                        ? 'Rs ${billing.dueAmount.toStringAsFixed(0)}'
                        : '—',
              ),
              _InfoRow(
                label: 'Next Renewal',
                value: billing.nextBillDate.isEmpty
                    ? '—'
                    : _fmtDate(billing.nextBillDate),
              ),
              _InfoRow(
                label: 'Generated',
                value: billing.generatedDate.isEmpty
                    ? '—'
                    : _fmtDate(billing.generatedDate),
              ),
              _InfoRow(
                label: 'Last Payment',
                value: billing.lastPaymentAmount > 0
                    ? 'Rs ${billing.lastPaymentAmount.toStringAsFixed(0)}'
                    : '—',
                last: true,
              ),
            ],
          ),
        ),

        if (appState.connections.length > 1) ...[
          const SizedBox(height: 14),
          _Section(
            icon: Icons.swap_horiz_rounded,
            title: 'MY CONNECTIONS',
            child: Column(
              children: appState.connections.asMap().entries.map((entry) {
                final i = entry.key;
                final c = entry.value;
                final isSelected = c.customerId == appState.selectedCustomerId;
                return _ConnectionRow(
                  connection: c,
                  isSelected: isSelected,
                  isLast: i == appState.connections.length - 1,
                  onTap: isSelected
                      ? null
                      : () => appState.selectConnection(c.customerId),
                );
              }).toList(),
            ),
          ),
        ],

        const SizedBox(height: 28),

        // ── Logout ─────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: OutlinedButton.icon(
            onPressed: appState.logout,
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFFF6B6B),
              side: const BorderSide(color: Color(0x44FF6B6B)),
              backgroundColor: const Color(0x0DFF6B6B),
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
            ),
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: Text(
              'Logout',
              style:
                  GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14),
            ),
          ),
        ),


        const SizedBox(height: 100),
      ],
    );
  }
}

// ─── Profile Hero Card ─────────────────────────────────────────────────────────

class _ProfileHeroCard extends StatelessWidget {
  const _ProfileHeroCard({
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
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF8224E3),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0x55D8B4FE)),
      ),
      child: Stack(
        children: [
          // Decorative orb
          Positioned(
            top: -50,
            right: -40,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    Colors.white.withValues(alpha: 0.07),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Status pills row
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
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
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              color: isActive
                                  ? const Color(0xFF4ADE80)
                                  : const Color(0xFFEF4444),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            statusLabel,
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (totalConnections > 1 && connectionIndex >= 0)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: Colors.white.withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.swap_horiz_rounded,
                                color: Colors.white, size: 12),
                            const SizedBox(width: 4),
                            Text(
                              'Connection ${connectionIndex + 1} of $totalConnections',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),

                const SizedBox(height: 18),

                // Avatar + name row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Avatar
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const LinearGradient(
                          colors: [Color(0xFFD8B4FE), Color(0xFF7C3AED)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: kPrimary.withValues(alpha: 0.4),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Text(
                          initial,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w900,
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
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                              height: 1.15,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (planName.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Row(
                              children: [
                                const Icon(Icons.wifi_rounded,
                                    color: Colors.white70, size: 12),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    planName,
                                    style: GoogleFonts.inter(
                                      color: Colors.white70,
                                      fontSize: 12,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                          if (connectionId.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                const Icon(Icons.badge_outlined,
                                    color: Colors.white60, size: 11),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    connectionId,
                                    style: GoogleFonts.inter(
                                      color: Colors.white60,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 0.2,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                          if (connectionAddress.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.location_on_outlined,
                                    color: Colors.white54, size: 11),
                                const SizedBox(width: 4),
                                Expanded(
                                  child: Text(
                                    connectionAddress,
                                    style: GoogleFonts.inter(
                                      color: Colors.white54,
                                      fontSize: 11,
                                      height: 1.3,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 22),

                // Stats row
                Row(
                  children: [
                    _HeroStat(
                      label: 'Amount Due',
                      value: 'Rs ${dueAmount.toStringAsFixed(0)}',
                      valueColor: dueAmount > 0
                          ? const Color(0xFFFBBF24)
                          : const Color(0xFF4ADE80),
                    ),
                    _heroDivider(),
                    _HeroStat(
                      label: 'Tickets',
                      value: '$ticketCount',
                    ),
                    _heroDivider(),
                    _HeroStat(
                      label: 'Status',
                      value: connStatus.isEmpty ? 'Active' : connStatus,
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

  Widget _heroDivider() => Container(
        width: 1,
        height: 30,
        margin: const EdgeInsets.symmetric(horizontal: 14),
        color: Colors.white.withValues(alpha: 0.2),
      );
}

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.label,
    required this.value,
    this.valueColor,
  });

  final String label, value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: GoogleFonts.inter(
            color: valueColor ?? Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.inter(
            color: Colors.white54,
            fontSize: 10,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

String _fmtDate(String raw) {
  try {
    final dt = DateTime.parse(raw);
    const m = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${m[dt.month - 1]} ${dt.day}, ${dt.year}';
  } catch (_) {
    final t = raw.indexOf('T');
    return t > 0 ? raw.substring(0, t) : raw;
  }
}

// ─── Supporting Widgets ────────────────────────────────────────────────────────

class _Section extends StatelessWidget {
  const _Section(
      {required this.icon, required this.title, required this.child});
  final IconData icon;
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 13, color: kMuted),
              const SizedBox(width: 6),
              Text(
                title,
                style: GoogleFonts.inter(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: kMuted,
                  letterSpacing: 1.1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: kBorder),
            ),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value, this.last = false});
  final String label, value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 110,
                child: Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: kMuted,
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
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (!last)
          const Divider(
            color: kBorder,
            height: 1,
            indent: 18,
            endIndent: 18,
          ),
      ],
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
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isSelected
                        ? kPrimary.withValues(alpha: 0.15)
                        : kBg,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: isSelected
                            ? kPrimary.withValues(alpha: 0.4)
                            : kBorder),
                  ),
                  child: Icon(Icons.wifi_rounded,
                      size: 17,
                      color: isSelected ? kPrimaryLight : Colors.white38),
                ),
                const SizedBox(width: 12),
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
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          height: 1.3,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Row(
                        children: [
                          const Icon(Icons.badge_outlined,
                              size: 10, color: kMuted),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              connection.customerId,
                              style: GoogleFonts.inter(
                                color: kMuted,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 0.3,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (connection.planName.isNotEmpty) ...[
                            Text(' · ',
                                style: GoogleFonts.inter(
                                    color: kMuted, fontSize: 10)),
                            Flexible(
                              child: Text(
                                connection.planName,
                                style: GoogleFonts.inter(
                                  color: kMuted,
                                  fontSize: 10,
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
                if (isSelected)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: kPrimary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border:
                          Border.all(color: kPrimary.withValues(alpha: 0.3)),
                    ),
                    child: Text('Active',
                        style: GoogleFonts.inter(
                            color: kPrimaryLight,
                            fontSize: 10,
                            fontWeight: FontWeight.w700)),
                  )
                else
                  const Icon(Icons.chevron_right_rounded,
                      color: Colors.white24, size: 18),
              ],
            ),
          ),
          if (!isLast)
            const Divider(color: kBorder, height: 1, indent: 18, endIndent: 18),
        ],
      ),
    );
  }
}
