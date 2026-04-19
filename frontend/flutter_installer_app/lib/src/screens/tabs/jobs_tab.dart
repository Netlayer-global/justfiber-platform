import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../core/theme.dart';
import '../job_detail_screen.dart';

class JobsTab extends StatefulWidget {
  const JobsTab({super.key});

  @override
  State<JobsTab> createState() => _JobsTabState();
}

class _JobsTabState extends State<JobsTab> {
  String _filter = 'all';
  String _search = '';
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<InstallerJob> _filtered(List<InstallerJob> jobs) {
    var list = jobs;
    if (_filter != 'all') {
      list = list
          .where((j) => j.jobType.toLowerCase().contains(_filter))
          .toList();
    }
    if (_search.isNotEmpty) {
      final q = _search.toLowerCase();
      list = list
          .where((j) =>
              j.jobNumber.toLowerCase().contains(q) ||
              j.customerName.toLowerCase().contains(q) ||
              j.customerAddress.toLowerCase().contains(q) ||
              j.status.toLowerCase().contains(q))
          .toList();
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final jobs = appState.jobs;
    final filtered = _filtered(jobs);

    final installCount =
        jobs.where((j) => j.jobType.toLowerCase().contains('install')).length;
    final complaintCount =
        jobs.where((j) => j.jobType.toLowerCase().contains('complaint')).length;

    return RefreshIndicator(
      color: kPrimaryLight,
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
                  colors: [Color(0xFF3B0A73), Color(0xFF6B21A8)],
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
                              'My Jobs',
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
                              '${jobs.length} TOTAL',
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
                      // Stats row
                      Row(
                        children: [
                          _headerStat('$installCount', 'Installations'),
                          const SizedBox(width: 10),
                          _headerStat('$complaintCount', 'Complaints'),
                          const SizedBox(width: 10),
                          _headerStat(
                              '${jobs.where((j) => j.status.toLowerCase() == 'assigned').length}',
                              'Pending'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Search & Filter bar ──────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
              child: Column(
                children: [
                  // Search
                  Container(
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: kBorder),
                    ),
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: (v) => setState(() => _search = v),
                      style: GoogleFonts.inter(
                          color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Search jobs, customer, address…',
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
                  const SizedBox(height: 10),
                  // Filter chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _filterChip('All', 'all', jobs.length),
                        const SizedBox(width: 8),
                        _filterChip(
                            'Installations', 'install', installCount),
                        const SizedBox(width: 8),
                        _filterChip(
                            'Complaints', 'complaint', complaintCount),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Job list ─────────────────────────────────────────────
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 40),
            sliver: SliverList(
              delegate: SliverChildListDelegate(
                filtered.isEmpty
                    ? [
                        Container(
                          padding: const EdgeInsets.all(24),
                          margin: const EdgeInsets.only(top: 8),
                          decoration: BoxDecoration(
                            color: kSurface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: kBorder),
                          ),
                          child: Column(
                            children: [
                              const Icon(Icons.assignment_outlined,
                                  color: kSubtle, size: 40),
                              const SizedBox(height: 12),
                              Text(
                                jobs.isEmpty
                                    ? 'No jobs assigned yet'
                                    : 'No jobs match your search',
                                style: GoogleFonts.inter(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 15),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                jobs.isEmpty
                                    ? 'Pull down to refresh for latest assignments.'
                                    : 'Try a different search or filter.',
                                style: GoogleFonts.inter(
                                    color: kMuted, fontSize: 13),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ]
                    : [
                        for (final job in filtered) ...[
                          _JobCard(job: job),
                          const SizedBox(height: 14),
                        ],
                      ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _headerStat(String value, String label) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
                color: Colors.white.withValues(alpha: 0.15)),
          ),
          child: Column(
            children: [
              Text(value,
                  style: GoogleFonts.inter(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 18)),
              Text(label,
                  style: GoogleFonts.inter(
                      color: Colors.white60, fontSize: 10)),
            ],
          ),
        ),
      );

  Widget _filterChip(String label, String value, int count) {
    final selected = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? kPrimary.withValues(alpha: 0.15)
              : kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected
                  ? kPrimary.withValues(alpha: 0.5)
                  : kBorder),
        ),
        child: Text(
          '$label ($count)',
          style: GoogleFonts.inter(
            color: selected ? kPrimaryLight : kMuted,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

class _JobCard extends StatelessWidget {
  const _JobCard({required this.job});
  final InstallerJob job;

  @override
  Widget build(BuildContext context) {
    final isInstall =
        job.jobType.toLowerCase().contains('install');
    final urgencyColor = _urgencyColor(job);
    final statusInfo = _statusInfo(job.status);

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
          border: Border.all(color: urgencyColor.withValues(alpha: 0.25)),
          boxShadow: [
            BoxShadow(
              color: urgencyColor.withValues(alpha: 0.06),
              blurRadius: 20,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header strip ──────────────────────────────────
            Container(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              decoration: BoxDecoration(
                color: urgencyColor.withValues(alpha: 0.06),
                borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  // Job type icon
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: urgencyColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: urgencyColor.withValues(alpha: 0.25)),
                    ),
                    child: Icon(
                      isInstall
                          ? Icons.router_rounded
                          : Icons.build_rounded,
                      color: urgencyColor,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          job.jobNumber,
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                            letterSpacing: -0.3,
                          ),
                        ),
                        Text(
                          job.jobType.toUpperCase(),
                          style: GoogleFonts.inter(
                            color: urgencyColor,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Status badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusInfo.$2.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                          color: statusInfo.$2.withValues(alpha: 0.35)),
                    ),
                    child: Text(
                      statusInfo.$1,
                      style: GoogleFonts.inter(
                        color: statusInfo.$2,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Customer info ──────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.person_rounded,
                          color: kMuted, size: 14),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          job.customerName,
                          style: GoogleFonts.inter(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 14),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const Icon(Icons.location_on_rounded,
                          color: kMuted, size: 14),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          job.customerAddress,
                          style: GoogleFonts.inter(
                              color: kMuted, fontSize: 12, height: 1.3),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  if (job.planName.isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        const Icon(Icons.wifi_rounded,
                            color: kMuted, size: 14),
                        const SizedBox(width: 6),
                        Text(
                          job.planName,
                          style: GoogleFonts.inter(
                              color: kMuted, fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            // ── Scheduled time + CTA ──────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Row(
                children: [
                  if (job.scheduledAt.isNotEmpty) ...[
                    const Icon(Icons.schedule_rounded,
                        color: kMuted, size: 13),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        job.scheduledAt,
                        style: GoogleFonts.inter(
                            color: kMuted, fontSize: 11),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                  ] else
                    const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: kPrimary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                          color: kPrimary.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Open Job',
                          style: GoogleFonts.inter(
                            color: kPrimaryLight,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.arrow_forward_rounded,
                            color: kPrimaryLight, size: 14),
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

  Color _urgencyColor(InstallerJob job) {
    final type = job.jobType.toLowerCase();
    if (type.contains('complaint')) return const Color(0xFFF59E0B);
    final status = job.status.toLowerCase();
    if (status == 'assigned') return kPrimary;
    if (status.contains('progress') || status.contains('travel')) {
      return const Color(0xFF0EA5E9);
    }
    if (status.contains('complete')) return const Color(0xFF10B981);
    return kPrimary;
  }

  (String, Color) _statusInfo(String status) {
    final s = status.toLowerCase();
    if (s == 'assigned') return ('ASSIGNED', kPrimary);
    if (s.contains('travel')) {
      return ('TRAVELLING', const Color(0xFF0EA5E9));
    }
    if (s.contains('onsite') || s.contains('progress')) {
      return ('ON-SITE', const Color(0xFFF59E0B));
    }
    if (s.contains('activat')) {
      return ('ACTIVATING', const Color(0xFFF59E0B));
    }
    if (s.contains('complet')) {
      return ('COMPLETED', const Color(0xFF10B981));
    }
    if (s.contains('defer')) return ('DEFERRED', kMuted);
    if (s.contains('cancel')) {
      return ('CANCELLED', const Color(0xFFEF4444));
    }
    return (status.toUpperCase(), kMuted);
  }

}
