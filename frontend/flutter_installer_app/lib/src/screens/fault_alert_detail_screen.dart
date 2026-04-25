import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';

class FaultAlertDetailScreen extends StatefulWidget {
  const FaultAlertDetailScreen({
    super.key,
    required this.alert,
  });

  final InstallerFaultAlert alert;

  @override
  State<FaultAlertDetailScreen> createState() => _FaultAlertDetailScreenState();
}

class _FaultAlertDetailScreenState extends State<FaultAlertDetailScreen> {
  bool _refreshing = false;

  InstallerFaultAlert _resolveAlert(InstallerAppState appState) {
    for (final alert in appState.faultAlerts) {
      if (alert.id == widget.alert.id) return alert;
    }
    return widget.alert;
  }

  Future<void> _refresh(InstallerAppState appState) async {
    setState(() => _refreshing = true);
    try {
      await appState.refresh();
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _copySummary(InstallerFaultAlert alert) async {
    final text = [
      alert.title,
      alert.message,
      if (alert.pathId.isNotEmpty) 'Path: ${alert.pathId}',
      if (alert.assetId.isNotEmpty) 'Asset: ${alert.assetId}',
      'Affected assets: ${alert.affectedAssets}',
      'Affected customers: ${alert.affectedCustomers}',
      if (alert.rxPower != null) 'RX power: ${alert.rxPower} dBm',
    ].join('\n');
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Fault summary copied'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final alert = _resolveAlert(appState);
    final severityColor = _severityColor(alert.severity);
    final actionItems = _recommendedActions(alert);

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        title: Text(
          'Fault Detail',
          style: GoogleFonts.inter(
            color: Colors.white,
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          IconButton(
            onPressed: _refreshing ? null : () => _refresh(appState),
            icon: _refreshing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white70,
                    ),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
          IconButton(
            onPressed: () => _copySummary(alert),
            icon: const Icon(Icons.copy_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: kPrimaryLight,
        backgroundColor: kSurface,
        onRefresh: () => _refresh(appState),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    severityColor.withValues(alpha: 0.28),
                    const Color(0xFF1A112B),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: severityColor.withValues(alpha: 0.32),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: severityColor.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: severityColor.withValues(alpha: 0.28),
                          ),
                        ),
                        child: Text(
                          alert.severity.toUpperCase(),
                          style: GoogleFonts.inter(
                            color: severityColor,
                            fontWeight: FontWeight.w800,
                            fontSize: 10,
                            letterSpacing: 1.1,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: kBorder),
                        ),
                        child: Text(
                          _kindLabel(alert.kind),
                          style: GoogleFonts.inter(
                            color: kMuted,
                            fontWeight: FontWeight.w700,
                            fontSize: 10,
                            letterSpacing: 0.7,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Text(
                    alert.title,
                    style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 22,
                      height: 1.15,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    alert.message,
                    style: GoogleFonts.inter(
                      color: kMuted,
                      fontSize: 13,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _summaryMetric(
                          'Assets',
                          '${alert.affectedAssets}',
                          Icons.device_hub_rounded,
                          severityColor,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _summaryMetric(
                          'Customers',
                          '${alert.affectedCustomers}',
                          Icons.person_pin_circle_rounded,
                          const Color(0xFF22D3EE),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _summaryMetric(
                          alert.rxPower != null ? 'RX' : 'Status',
                          alert.rxPower != null
                              ? '${alert.rxPower} dBm'
                              : (alert.status.isEmpty
                                  ? 'Live'
                                  : alert.status),
                          Icons.network_check_rounded,
                          const Color(0xFFF59E0B),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            _sectionLabel('FIELD ACTIONS'),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: kBorder),
              ),
              child: Column(
                children: [
                  for (var i = 0; i < actionItems.length; i++) ...[
                    _ActionRow(
                      index: i + 1,
                      text: actionItems[i],
                      color: severityColor,
                    ),
                    if (i != actionItems.length - 1) const SizedBox(height: 12),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            _sectionLabel('NETWORK REFERENCE'),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: kBorder),
              ),
              child: Column(
                children: [
                  _detailRow('Alert ID', alert.id),
                  if (alert.pathId.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _detailRow('Fiber path', alert.pathId),
                  ],
                  if (alert.assetId.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _detailRow('Primary asset', alert.assetId),
                  ],
                  if (alert.createdAt != null) ...[
                    const SizedBox(height: 12),
                    _detailRow('Raised', _formatDateTime(alert.createdAt!)),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            _sectionLabel('IMPACTED ENDPOINTS'),
            const SizedBox(height: 10),
            if (alert.impactedItems.isEmpty)
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: kBorder),
                ),
                child: Text(
                  'No impacted endpoints have been mapped yet for this alert.',
                  style: GoogleFonts.inter(
                    color: kMuted,
                    fontSize: 13,
                  ),
                ),
              )
            else
              ...alert.impactedItems.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ImpactCard(item: item),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _summaryMetric(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(height: 10),
          Text(
            value,
            style: GoogleFonts.inter(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: GoogleFonts.inter(
              color: kMuted,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 92,
          child: Text(
            label,
            style: GoogleFonts.inter(
              color: kSubtle,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            value,
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: GoogleFonts.inter(
        color: kMuted,
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.5,
      ),
    );
  }

  Color _severityColor(String severity) {
    switch (severity.toLowerCase()) {
      case 'critical':
        return const Color(0xFFEF4444);
      case 'warning':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFF22D3EE);
    }
  }

  String _kindLabel(String kind) {
    switch (kind.toLowerCase()) {
      case 'path_cut':
        return 'Fiber Cut';
      case 'optical_low':
        return 'Low Optical';
      default:
        return kind.isEmpty ? 'Fault' : kind;
    }
  }

  List<String> _recommendedActions(InstallerFaultAlert alert) {
    if (alert.kind.toLowerCase() == 'path_cut') {
      return [
        'Trace the affected fiber route and inspect the nearest cut corridor first.',
        'Check linked splitter or coupler joints before moving to downstream ONTs.',
        'Call splice or restoration support if the route is physically damaged.',
        'After restoration, refresh the alert and confirm impacted customers are back online.',
      ];
    }
    return [
      'Inspect connector seating, patch cord bends, and splitter/coupler cleanliness.',
      'Verify ONT optical level on-site and compare with the alert RX power.',
      'If power remains low, check upstream path health before reprovisioning the router.',
      'Refresh the feed after correction and confirm optical level improves above threshold.',
    ];
  }

  String _formatDateTime(DateTime value) {
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');
    final hour = value.hour.toString().padLeft(2, '0');
    final minute = value.minute.toString().padLeft(2, '0');
    return '$day/$month/${value.year} $hour:$minute';
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({
    required this.index,
    required this.text,
    required this.color,
  });

  final int index;
  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.16),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              '$index',
              style: GoogleFonts.inter(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 13,
              height: 1.45,
            ),
          ),
        ),
      ],
    );
  }
}

class _ImpactCard extends StatelessWidget {
  const _ImpactCard({required this.item});

  final Map<String, dynamic> item;

  Future<void> _openMap(BuildContext context) async {
    final mapUrl = (item['mapUrl'] ?? '').toString().trim();
    final latitude = double.tryParse('${item['latitude'] ?? ''}');
    final longitude = double.tryParse('${item['longitude'] ?? ''}');
    final target = mapUrl.isNotEmpty
        ? mapUrl
        : (latitude != null && longitude != null
            ? 'https://maps.google.com/?q=$latitude,$longitude'
            : '');
    if (target.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Map location not available for this endpoint'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    final uri = Uri.tryParse(target);
    if (uri == null || !await canLaunchUrl(uri)) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to open map for this endpoint'),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final customerName = (item['customerName'] ?? '').toString();
    final customerPhone = (item['customerPhone'] ?? '').toString();
    final assetType = (item['assetType'] ?? '').toString();
    final label = (item['label'] ?? item['assetId'] ?? '').toString();
    final status = (item['status'] ?? '').toString();
    final rx = double.tryParse('${item['rxPower'] ?? ''}');

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  customerName.isNotEmpty ? customerName : label,
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: kBorder),
                ),
                child: Text(
                  assetType.isEmpty ? 'endpoint' : assetType,
                  style: GoogleFonts.inter(
                    color: kPrimaryLight,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.7,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _impactRow('Asset', label),
          if (customerPhone.isNotEmpty) ...[
            const SizedBox(height: 8),
            _impactRow('Mobile', customerPhone),
          ],
          if (status.isNotEmpty) ...[
            const SizedBox(height: 8),
            _impactRow('Status', status),
          ],
          if (rx != null) ...[
            const SizedBox(height: 8),
            _impactRow('RX Power', '$rx dBm'),
          ],
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed: () => _openMap(context),
              icon: const Icon(Icons.map_rounded, size: 16),
              label: const Text('Open map trace'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _impactRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 68,
          child: Text(
            label,
            style: GoogleFonts.inter(
              color: kSubtle,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            style: GoogleFonts.inter(
              color: kMuted,
              fontSize: 12,
              height: 1.35,
            ),
          ),
        ),
      ],
    );
  }
}
