import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../job_detail_screen.dart';

class ComplaintsTab extends StatefulWidget {
  const ComplaintsTab({super.key});

  @override
  State<ComplaintsTab> createState() => _ComplaintsTabState();
}

class _ComplaintsTabState extends State<ComplaintsTab> {
  String _search = '';
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<InstallerJob> _filterSearch(List<InstallerJob> list) {
    if (_search.isEmpty) return list;
    final q = _search.toLowerCase();
    return list
        .where((j) =>
            j.jobNumber.toLowerCase().contains(q) ||
            j.customerName.toLowerCase().contains(q) ||
            j.customerPhone.toLowerCase().contains(q) ||
            j.customerAddress.toLowerCase().contains(q) ||
            j.status.toLowerCase().contains(q))
        .toList();
  }

  String _shortTime(DateTime value) {
    final ist = value.toUtc().add(const Duration(hours: 5, minutes: 30));
    final h12 = ist.hour % 12 == 0 ? 12 : ist.hour % 12;
    final min = ist.minute.toString().padLeft(2, '0');
    final ampm = ist.hour < 12 ? 'AM' : 'PM';
    return '$h12:$min $ampm';
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final all = appState.jobs
        .where((j) => _normalizedJobType(j) == 'complaint')
        .toList();
    final complaints = _filterSearch(all);

    final pending =
        all.where((j) => j.status.toLowerCase() == 'assigned').length;
    final active = all
        .where((j) =>
            j.status.toLowerCase().contains('enroute') ||
            j.status.toLowerCase().contains('onsite') ||
            j.status.toLowerCase().contains('progress'))
        .length;
    final resolved =
        all.where((j) => j.status.toLowerCase().contains('complet')).length;

    return RefreshIndicator(
      color: const Color(0xFFFBBF24),
      backgroundColor: kSurface,
      onRefresh: appState.refresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // ── Header ──────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF78350F), Color(0xFFB45309)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Complaints',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.5,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '${all.length} TOTAL',
                              style: GoogleFonts.inter(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          _stat('$pending', 'Pending',
                              const Color(0xFFFCD34D)),
                          const SizedBox(width: 10),
                          _stat('$active', 'On-Site',
                              const Color(0xFFFB923C)),
                          const SizedBox(width: 10),
                          _stat('$resolved', 'Resolved',
                              const Color(0xFF34D399)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      // Sync status
                      Row(
                        children: [
                          if (appState.busy)
                            const SizedBox(
                              width: 9,
                              height: 9,
                              child: CircularProgressIndicator(
                                  strokeWidth: 1.5,
                                  color: Colors.white54),
                            )
                          else
                            const Icon(Icons.check_circle_rounded,
                                color: Color(0xFF4ADE80), size: 11),
                          const SizedBox(width: 5),
                          Text(
                            appState.busy
                                ? 'Syncing...'
                                : appState.lastSyncedAt != null
                                    ? 'Synced ${_shortTime(appState.lastSyncedAt!)}'
                                    : 'Not synced',
                            style: GoogleFonts.inter(
                                color: Colors.white60, fontSize: 10),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Error ────────────────────────────────────────────────
          if ((appState.error ?? '').isNotEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
              sliver: SliverToBoxAdapter(
                child: _ErrorBanner(
                    message: appState.error!, onRetry: appState.refresh),
              ),
            ),

          // ── Search bar ──────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
              child: Container(
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: kBorder),
                ),
                child: TextField(
                  controller: _searchCtrl,
                  onChanged: (v) => setState(() => _search = v),
                  style:
                      GoogleFonts.inter(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Search complaints…',
                    hintStyle:
                        GoogleFonts.inter(color: kSubtle, fontSize: 13),
                    prefixIcon: const Icon(Icons.search_rounded,
                        color: kMuted, size: 20),
                    suffixIcon: _search.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded,
                                color: kMuted, size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _search = '');
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                  ),
                ),
              ),
            ),
          ),

          // ── List ────────────────────────────────────────────────
          if (complaints.isEmpty)
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 40),
              sliver: SliverToBoxAdapter(
                child: Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: kSurface,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: kBorder),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.build_circle_outlined,
                          color: kSubtle, size: 44),
                      const SizedBox(height: 12),
                      Text(
                        all.isEmpty
                            ? 'No complaint jobs assigned'
                            : 'No complaints match your search',
                        style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 15),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        all.isEmpty
                            ? 'Pull down to refresh for latest assignments.'
                            : 'Try a different search term.',
                        style:
                            GoogleFonts.inter(color: kMuted, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 40),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ComplaintCard(job: complaints[i]),
                  ),
                  childCount: complaints.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _normalizedJobType(InstallerJob job) {
    final value = job.jobType.trim().toLowerCase();
    if (value == 'complaint') return 'complaint';
    return 'installation';
  }

  Widget _stat(String value, String label, Color color) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Column(
            children: [
              Text(value,
                  style: GoogleFonts.inter(
                      color: color,
                      fontWeight: FontWeight.w900,
                      fontSize: 18)),
              Text(label,
                  style: GoogleFonts.inter(
                      color: Colors.white60, fontSize: 10)),
            ],
          ),
        ),
      );
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      decoration: BoxDecoration(
        color: const Color(0x0DFF6B6B),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x33FF6B6B)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: Color(0xFFFCA5A5), size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(message,
                style: GoogleFonts.inter(
                    color: const Color(0xFFFCA5A5), fontSize: 13)),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onRetry,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0x22FF6B6B),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text('Retry',
                  style: GoogleFonts.inter(
                      color: const Color(0xFFFCA5A5),
                      fontSize: 12,
                      fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Complaint Card ───────────────────────────────────────────────────────────

class _ComplaintCard extends StatelessWidget {
  const _ComplaintCard({required this.job});
  final InstallerJob job;

  static const _amber = Color(0xFFFBBF24);
  static const _orange = Color(0xFFF97316);

  @override
  Widget build(BuildContext context) {
    final statusInfo = _statusInfo(job.status);
    final priorityInfo = _priorityInfo(job.priority);
    final isDeferred = job.status.toLowerCase().contains('defer');
    final isCancelled = job.status.toLowerCase().contains('cancel');
    final rxPower = job.rxPowerText.trim();
    final opticalRaw = job.opticalHealth.trim();
    final issueType = job.complaintCategory.trim().replaceAll('_', ' ');
    final issueDesc = job.complaintDescription.trim();
    final hasIssue = issueType.isNotEmpty || issueDesc.isNotEmpty;

    // Optical health color
    final opticalColor = opticalRaw.toLowerCase().contains('good')
        ? const Color(0xFF10B981)
        : opticalRaw.toLowerCase().contains('warn')
            ? const Color(0xFFF59E0B)
            : opticalRaw.toLowerCase().contains('critical')
                ? const Color(0xFFEF4444)
                : kSubtle;

    // RX power color
    final rxNum = double.tryParse(rxPower.replaceAll(RegExp(r'[^0-9.\-]'), ''));
    final rxColor = rxNum == null
        ? kSubtle
        : rxNum >= -22
            ? const Color(0xFF10B981)
            : rxNum >= -26
                ? const Color(0xFFF59E0B)
                : const Color(0xFFEF4444);

    return GestureDetector(
      onTap: () async {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => JobDetailScreen(job: job)),
        );
        if (context.mounted) {
          await InstallerStateScope.of(context).refresh();
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: _amber.withValues(alpha: 0.2)),
          boxShadow: [
            BoxShadow(
              color: _amber.withValues(alpha: 0.06),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Hero strip ────────────────────────────────────
            Container(
              padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
              decoration: BoxDecoration(
                color: _amber.withValues(alpha: 0.07),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: _amber.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: _amber.withValues(alpha: 0.3)),
                    ),
                    child: const Icon(Icons.build_circle_rounded, color: _amber, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          Flexible(
                            child: Text(job.jobNumber,
                                style: GoogleFonts.inter(
                                    color: Colors.white, fontWeight: FontWeight.w900,
                                    fontSize: 15, letterSpacing: -0.3),
                                overflow: TextOverflow.ellipsis),
                          ),
                          if (priorityInfo != null) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: priorityInfo.$2.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(5),
                                border: Border.all(color: priorityInfo.$2.withValues(alpha: 0.35)),
                              ),
                              child: Text(priorityInfo.$1,
                                  style: GoogleFonts.inter(
                                      color: priorityInfo.$2, fontSize: 8,
                                      fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                            ),
                          ],
                        ]),
                        const SizedBox(height: 2),
                        if (job.customerName.isNotEmpty && job.customerName != '-')
                          Text(job.customerName,
                              style: GoogleFonts.inter(
                                  color: Colors.white70, fontSize: 12,
                                  fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  // Call
                  if (job.customerPhone.isNotEmpty) ...[
                    _heroBtn(icon: Icons.call_rounded,
                        color: const Color(0xFF34D399),
                        onTap: () => _openUri('tel:${job.customerPhone}')),
                    const SizedBox(width: 6),
                  ],
                  // WhatsApp
                  if (job.customerPhone.isNotEmpty) ...[
                    _heroBtn(icon: Icons.chat_rounded,
                        color: const Color(0xFF25D366),
                        onTap: () => _openUri(
                            'https://wa.me/91${job.customerPhone}?text=${Uri.encodeComponent('Hello! I am the JustFiber technician assigned to your complaint. I will be coming shortly.')}')),
                    const SizedBox(width: 6),
                  ],
                  // Map
                  if (job.mapUrl.isNotEmpty || (job.latitude != null && job.longitude != null)) ...[
                    _heroBtn(
                        icon: Icons.map_rounded,
                        color: const Color(0xFF0EA5E9),
                        onTap: () => _openUri(job.mapUrl.isNotEmpty
                            ? job.mapUrl
                            : 'https://maps.google.com/?q=${job.latitude},${job.longitude}')),
                    const SizedBox(width: 6),
                  ],
                  // Status badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                    decoration: BoxDecoration(
                      color: statusInfo.$2.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: statusInfo.$2.withValues(alpha: 0.4)),
                    ),
                    child: Text(statusInfo.$1,
                        style: GoogleFonts.inter(
                            color: statusInfo.$2, fontSize: 10, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),

            // ── Issue banner ──────────────────────────────────
            if (hasIssue)
              Container(
                margin: const EdgeInsets.fromLTRB(14, 10, 14, 0),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: _orange.withValues(alpha: 0.09),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _orange.withValues(alpha: 0.35)),
                ),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.report_problem_rounded, color: _orange, size: 16),
                  const SizedBox(width: 8),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (issueType.isNotEmpty)
                      Text(issueType.toUpperCase(),
                          style: GoogleFonts.inter(
                              color: _orange, fontSize: 10,
                              fontWeight: FontWeight.w800, letterSpacing: 0.6)),
                    if (issueDesc.isNotEmpty) ...[
                      if (issueType.isNotEmpty) const SizedBox(height: 3),
                      Text(issueDesc,
                          style: GoogleFonts.inter(
                              color: const Color(0xFFFED7AA), fontSize: 13, height: 1.4),
                          maxLines: 2, overflow: TextOverflow.ellipsis),
                    ],
                  ])),
                ]),
              ),

            // ── Info rows ─────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (job.customerPhone.isNotEmpty)
                  _infoRow(Icons.phone_rounded, '+91 ${job.customerPhone}'),
                if (job.customerAddress.isNotEmpty && job.customerAddress != '-') ...[
                  const SizedBox(height: 4),
                  _infoRow(Icons.location_on_rounded, job.customerAddress, maxLines: 2),
                ],
                if (isDeferred && job.deferNote.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  _noteRow(Icons.schedule_rounded, job.deferNote, const Color(0xFFFBBF24)),
                ],
                if (isCancelled && job.cancelNote.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  _noteRow(Icons.cancel_outlined, job.cancelNote, const Color(0xFFFCA5A5)),
                ],

                // ── Diagnostics row ───────────────────────────
                const SizedBox(height: 10),
                Row(children: [
                  // RX Power badge
                  if (rxPower.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                      decoration: BoxDecoration(
                        color: rxColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: rxColor.withValues(alpha: 0.3)),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Container(width: 6, height: 6,
                            decoration: BoxDecoration(color: rxColor, shape: BoxShape.circle)),
                        const SizedBox(width: 5),
                        Text('RX $rxPower dBm',
                            style: GoogleFonts.inter(
                                color: rxColor, fontSize: 11, fontWeight: FontWeight.w700)),
                      ]),
                    ),
                    const SizedBox(width: 8),
                  ],
                  // Optical health badge
                  if (opticalRaw.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                      decoration: BoxDecoration(
                        color: opticalColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: opticalColor.withValues(alpha: 0.3)),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.wifi_tethering_rounded, color: opticalColor, size: 12),
                        const SizedBox(width: 4),
                        Text(opticalRaw.replaceAll('_', ' ').toUpperCase(),
                            style: GoogleFonts.inter(
                                color: opticalColor, fontSize: 11, fontWeight: FontWeight.w700)),
                      ]),
                    ),
                  ],
                ]),
              ]),
            ),

            // ── Footer ────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 13),
              child: Row(children: [
                if (job.scheduledAt.isNotEmpty) ...[
                  const Icon(Icons.schedule_rounded, color: kMuted, size: 12),
                  const SizedBox(width: 4),
                  Expanded(child: Text(_fmtIst(job.scheduledAt),
                      style: GoogleFonts.inter(color: kMuted, fontSize: 11),
                      overflow: TextOverflow.ellipsis)),
                ] else
                  const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: _amber.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _amber.withValues(alpha: 0.35)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text('Open Job',
                        style: GoogleFonts.inter(
                            color: _amber, fontSize: 12, fontWeight: FontWeight.w700)),
                    const SizedBox(width: 4),
                    const Icon(Icons.arrow_forward_rounded, color: _amber, size: 13),
                  ]),
                ),
              ]),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text, {int maxLines = 1}) => Row(children: [
        Icon(icon, color: kMuted, size: 13),
        const SizedBox(width: 6),
        Expanded(child: Text(text,
            style: GoogleFonts.inter(color: kMuted, fontSize: 12, height: 1.3),
            maxLines: maxLines, overflow: TextOverflow.ellipsis)),
      ]);

  Widget _noteRow(IconData icon, String text, Color color) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 12),
          const SizedBox(width: 5),
          Expanded(child: Text(text,
              style: GoogleFonts.inter(color: color, fontSize: 11, height: 1.3),
              maxLines: 2, overflow: TextOverflow.ellipsis)),
        ],
      );

  Widget _heroBtn({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(9),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Icon(icon, color: color, size: 16),
        ),
      );

  Future<void> _openUri(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  (String, Color)? _priorityInfo(String priority) {
    switch (priority.toLowerCase()) {
      case 'urgent':
        return ('URGENT', const Color(0xFFEF4444));
      case 'high':
        return ('HIGH', const Color(0xFFF59E0B));
      default:
        return null;
    }
  }

  (String, Color) _statusInfo(String status) {
    final s = status.toLowerCase();
    if (s == 'assigned') return ('ASSIGNED', kPrimary);
    if (s.contains('travel') || s.contains('enroute')) {
      return ('TRAVELLING', const Color(0xFF0EA5E9));
    }
    if (s.contains('onsite') || s.contains('progress')) {
      return ('ON-SITE', const Color(0xFFF59E0B));
    }
    if (s.contains('complet')) return ('RESOLVED', const Color(0xFF10B981));
    if (s.contains('defer')) return ('DEFERRED', const Color(0xFFE879F9));
    if (s.contains('cancel')) return ('CANCELLED', const Color(0xFFEF4444));
    return (status.toUpperCase(), kMuted);
  }
}

// IST = UTC+5:30
String _fmtIst(String raw) {
  if (raw.isEmpty) return raw;
  try {
    final utc = DateTime.parse(raw).toUtc();
    final ist = utc.add(const Duration(hours: 5, minutes: 30));
    final d = ist.day.toString().padLeft(2, '0');
    final mo = ist.month.toString().padLeft(2, '0');
    final y = ist.year;
    final h12 = ist.hour % 12 == 0 ? 12 : ist.hour % 12;
    final min = ist.minute.toString().padLeft(2, '0');
    final ampm = ist.hour < 12 ? 'AM' : 'PM';
    return '$d-$mo-$y  $h12:$min $ampm';
  } catch (_) {
    return raw;
  }
}
