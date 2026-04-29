import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/pressable_scale.dart';
import 'service_tracking_screen.dart';
import 'support_assistant_screen.dart';

class SupportHistoryScreen extends StatefulWidget {
  const SupportHistoryScreen({super.key});

  @override
  State<SupportHistoryScreen> createState() => _SupportHistoryScreenState();
}

class _SupportHistoryScreenState extends State<SupportHistoryScreen> {
  String _ticketFilter = 'open';
  String _requestFilter = 'open';

  bool _isClosedLike(String status) {
    final value = status.toLowerCase();
    return value.contains('closed') ||
        value.contains('resolved') ||
        value.contains('completed') ||
        value.contains('done');
  }

  List<SupportTicketItem> _filterTickets(List<SupportTicketItem> input) {
    final sorted = [...input]..sort((a, b) {
      final aOpenRank = _isClosedLike(a.status) ? 1 : 0;
      final bOpenRank = _isClosedLike(b.status) ? 1 : 0;
      if (aOpenRank != bOpenRank) return aOpenRank - bOpenRank;
      return b.createdAt.compareTo(a.createdAt);
    });
    if (_ticketFilter == 'all') return sorted;
    if (_ticketFilter == 'closed') {
      return sorted.where((item) => _isClosedLike(item.status)).toList();
    }
    return sorted.where((item) => !_isClosedLike(item.status)).toList();
  }

  List<RequestItem> _filterRequests(List<RequestItem> input) {
    final sorted = [...input]..sort((a, b) {
      final aOpenRank = _isClosedLike(a.status) ? 1 : 0;
      final bOpenRank = _isClosedLike(b.status) ? 1 : 0;
      if (aOpenRank != bOpenRank) return aOpenRank - bOpenRank;
      return b.createdAt.compareTo(a.createdAt);
    });
    if (_requestFilter == 'all') return sorted;
    if (_requestFilter == 'closed') {
      return sorted.where((item) => _isClosedLike(item.status)).toList();
    }
    return sorted.where((item) => !_isClosedLike(item.status)).toList();
  }

  String _nextStepText(String status) {
    final value = status.toLowerCase();
    if (value.contains('resolved') ||
        value.contains('closed') ||
        value.contains('completed')) {
      return 'This case looks closed from our side. If the issue returns, create a fresh ticket.';
    }
    if (value.contains('assigned')) {
      return 'Support team has picked this up. Please keep your phone reachable for callbacks.';
    }
    if (value.contains('progress') || value.contains('working')) {
      return 'Our team is actively working on this case. Track the latest update here.';
    }
    if (value.contains('pending') || value.contains('open')) {
      return 'This case is in queue. Keep the reference handy and avoid raising duplicates.';
    }
    return 'Track the latest update here. If nothing moves for a while, contact support with this reference.';
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final visibleTickets = _filterTickets(appState.tickets);
    final visibleRequests = _filterRequests(appState.requests);
    final openTickets = appState.tickets
        .where((t) => !t.status.toLowerCase().contains('closed') &&
            !t.status.toLowerCase().contains('resolved'))
        .length;
    final openRequests = appState.requests
        .where((r) => !r.status.toLowerCase().contains('closed') &&
            !r.status.toLowerCase().contains('completed'))
        .length;

    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimary,
        backgroundColor: kSurface,
        onRefresh: appState.refresh,
        child: CustomScrollView(
          slivers: [
            // ── Hero ─────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                  child: _SupportHeroCard(
                    totalTickets: appState.tickets.length,
                    openTickets: openTickets,
                    totalRequests: appState.requests.length,
                    openRequests: openRequests,
                    onChat: () async {
                      await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const SupportAssistantScreen()));
                      if (context.mounted) await appState.refresh();
                    },
                    onTicket: () => _showCreateTicketSheet(context, appState),
                    onRequest: () =>
                        _showCreateRequestSheet(context, appState),
                  ),
                ),
              ),
            ),

            // ── Issue shortcuts ───────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('QUICK HELP'),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _IssueChip(label: 'Internet', issueType: 'internet', context: context, appState: appState),
                        _IssueChip(label: 'Wi-Fi', issueType: 'wifi', context: context, appState: appState),
                        _IssueChip(label: 'Speed', issueType: 'speed', context: context, appState: appState),
                        _IssueChip(label: 'Billing', issueType: 'billing', context: context, appState: appState),
                        _IssueChip(label: 'Plan', issueType: 'plan', context: context, appState: appState),
                        _TrackingChip(context: context, appState: appState),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 0),
                child: _TrackingEntryCard(
                  openItems: openTickets + openRequests,
                  onTap: () => _openTracking(context, appState),
                ),
              ),
            ),

            // ── Tickets ───────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('SUPPORT TICKETS'),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _FilterChip(
                          label: 'Open',
                          selected: _ticketFilter == 'open',
                          onTap: () => setState(() => _ticketFilter = 'open'),
                        ),
                        _FilterChip(
                          label: 'All',
                          selected: _ticketFilter == 'all',
                          onTap: () => setState(() => _ticketFilter = 'all'),
                        ),
                        _FilterChip(
                          label: 'Closed',
                          selected: _ticketFilter == 'closed',
                          onTap: () => setState(() => _ticketFilter = 'closed'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (visibleTickets.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
                  child: _EmptyCard(
                    icon: Icons.support_agent_rounded,
                    title: appState.tickets.isEmpty
                        ? 'No tickets yet'
                        : 'No tickets in this filter',
                    subtitle: appState.tickets.isEmpty
                        ? 'Create a ticket for billing, internet or account issues.'
                        : 'Try another filter to view open or older tickets.',
                    actionLabel: 'Create ticket',
                    onTap: () => _showCreateTicketSheet(context, appState),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) {
                      final item = visibleTickets[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _ItemCard(
                          icon: _statusIcon(item.status),
                          title: item.subject,
                          ref: item.ticketNumber,
                          meta: item.category,
                          createdAt: item.createdAt,
                          status: item.status,
                          statusColor: _statusColor(item.status),
                          onTap: () => _showTicketDetails(context, item),
                        ),
                      );
                    },
                    childCount: visibleTickets.length,
                  ),
                ),
              ),

            // ── Requests ──────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 22, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('SERVICE REQUESTS'),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _FilterChip(
                          label: 'Open',
                          selected: _requestFilter == 'open',
                          onTap: () => setState(() => _requestFilter = 'open'),
                        ),
                        _FilterChip(
                          label: 'All',
                          selected: _requestFilter == 'all',
                          onTap: () => setState(() => _requestFilter = 'all'),
                        ),
                        _FilterChip(
                          label: 'Closed',
                          selected: _requestFilter == 'closed',
                          onTap: () => setState(() => _requestFilter = 'closed'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            if (visibleRequests.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
                  child: _EmptyCard(
                    icon: Icons.build_circle_rounded,
                    title: appState.requests.isEmpty
                        ? 'No requests yet'
                        : 'No requests in this filter',
                    subtitle: appState.requests.isEmpty
                        ? 'Need a shift, disconnect or service change? Create a request.'
                        : 'Try another filter to view open or completed requests.',
                    actionLabel: 'Create request',
                    onTap: () => _showCreateRequestSheet(context, appState),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) {
                      final item = visibleRequests[i];
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _ItemCard(
                          icon: _statusIcon(item.status),
                          title: item.title,
                          ref: item.referenceNumber,
                          meta: item.type,
                          createdAt: item.createdAt,
                          status: item.status,
                          statusColor: _statusColor(item.status),
                          onTap: () => _showRequestDetails(context, item),
                        ),
                      );
                    },
                    childCount: visibleRequests.length,
                  ),
                ),
              ),

            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  Widget _sectionLabel(String text) => Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: kMuted,
          letterSpacing: 1.6,
        ),
      );

  Color _statusColor(String status) {
    final s = status.toLowerCase();
    if (s.contains('closed') || s.contains('resolved') ||
        s.contains('completed') || s.contains('done')) {
      return const Color(0xFF22C55E);
    }
    if (s.contains('pending') || s.contains('open') ||
        s.contains('progress')) {
      return const Color(0xFFF59E0B);
    }
    return const Color(0xFFEF4444);
  }

  IconData _statusIcon(String status) {
    final s = status.toLowerCase();
    if (s.contains('closed') || s.contains('resolved') ||
        s.contains('completed')) {
      return Icons.check_circle_rounded;
    }
    if (s.contains('pending') || s.contains('progress')) {
      return Icons.pending_rounded;
    }
    return Icons.support_agent_rounded;
  }

  SupportTicketItem? _findLatestTicket(AppState appState, String ticketNumber) {
    for (final item in appState.tickets) {
      if (item.ticketNumber == ticketNumber) return item;
    }
    return appState.tickets.isNotEmpty ? appState.tickets.first : null;
  }

  RequestItem? _findLatestRequest(AppState appState, String requestNumber) {
    for (final item in appState.requests) {
      if (item.referenceNumber == requestNumber) return item;
    }
    return appState.requests.isNotEmpty ? appState.requests.first : null;
  }

  Future<void> _openTracking(BuildContext context, AppState appState) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
    );
    if (context.mounted) await appState.refreshBookingTracking();
  }

  // ── Sheets ────────────────────────────────────────────────────────────────────

  Future<void> _showTicketDetails(
      BuildContext context, SupportTicketItem item) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DetailSheet(
        title: item.subject,
        subtitle: '${item.ticketNumber} · ${item.category}',
        reference: item.ticketNumber,
        status: item.status,
        statusColor: _statusColor(item.status),
        nextStep: _nextStepText(item.status),
        rows: [
          ('Priority', item.priority.isEmpty ? '—' : item.priority),
          ('Created', item.createdAt.isEmpty ? '—' : item.createdAt),
          ('Description', item.description.isEmpty ? '—' : item.description),
          ('Latest update', item.latestUpdateNote.isEmpty ? '—' : item.latestUpdateNote),
          ('Updated at', item.latestUpdateAt.isEmpty ? '—' : item.latestUpdateAt),
        ],
      ),
    );
  }

  Future<void> _showRequestDetails(
      BuildContext context, RequestItem item) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DetailSheet(
        title: item.title,
        subtitle: '${item.referenceNumber} · ${item.type}',
        reference: item.referenceNumber,
        status: item.status,
        statusColor: _statusColor(item.status),
        nextStep: _nextStepText(item.status),
        rows: [
          ('Type', item.type.isEmpty ? '—' : item.type),
          ('Created', item.createdAt.isEmpty ? '—' : item.createdAt),
          ('Note', item.note.isEmpty ? '—' : item.note),
          ('Latest update', item.latestUpdateNote.isEmpty ? '—' : item.latestUpdateNote),
          ('Updated at', item.latestUpdateAt.isEmpty ? '—' : item.latestUpdateAt),
        ],
      ),
    );
  }

  Future<void> _showCreateTicketSheet(
      BuildContext context, AppState appState) async {
    final subjectCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    String category = 'technical';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (ctx, setLocal) {
          bool submitting = false;
          return Padding(
            padding: EdgeInsets.fromLTRB(
                12, 16, 12, 12 + MediaQuery.of(ctx).viewInsets.bottom),
            child: _Sheet(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SheetHandle(),
                  const SizedBox(height: 16),
                  Text('Create ticket',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                          color: Colors.white)),
                  const SizedBox(height: 4),
                  Text('Open a support case for billing, internet or account issues.',
                      style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.4)),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ['technical', 'billing', 'account', 'service']
                        .map((item) {
                      final sel = category == item;
                      return GestureDetector(
                        onTap: submitting
                            ? null
                            : () => setLocal(() => category = item),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: sel
                                ? kPrimary.withValues(alpha: 0.15)
                                : kSurface2,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                                color: sel
                                    ? kPrimary.withValues(alpha: 0.5)
                                    : kBorder),
                          ),
                          child: Text(item,
                              style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: sel ? kPrimaryLight : kMuted)),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: subjectCtrl,
                    enabled: !submitting,
                    style: GoogleFonts.inter(color: Colors.white),
                    decoration: const InputDecoration(labelText: 'Subject'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: descCtrl,
                    enabled: !submitting,
                    style: GoogleFonts.inter(color: Colors.white),
                    minLines: 3,
                    maxLines: 5,
                    decoration:
                        const InputDecoration(labelText: 'Describe the issue'),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: submitting
                          ? null // ignore: dead_code
                          : () async {
                              final subject = subjectCtrl.text.trim();
                              final desc = descCtrl.text.trim();
                              if (subject.isEmpty || desc.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text(
                                            'Enter subject and description.')));
                                return;
                              }
                              setLocal(() => submitting = true);
                              final num = await appState.raiseComplaint(
                                  category: category,
                                  subject: subject,
                                  description: desc);
                              if (!context.mounted) return;
                              if (num != null) {
                                Navigator.pop(sheetCtx);
                                await appState.refresh();
                                final t = _findLatestTicket(appState, num);
                                if (!context.mounted) return;
                                ScaffoldMessenger.of(context)
                                    .showSnackBar(SnackBar(
                                  content: Text('Ticket created: $num'),
                                  action: t == null
                                      ? null
                                      : SnackBarAction(
                                          label: 'View',
                                          onPressed: () =>
                                              _showTicketDetails(context, t)),
                                ));
                                return;
                              }
                              setLocal(() => submitting = false);
                              ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                      content: Text(appState.error ??
                                          'Unable to create ticket')));
                            },
                      child: Text(
                          submitting ? 'Submitting…' : 'Submit ticket'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    subjectCtrl.dispose();
    descCtrl.dispose();
  }

  Future<void> _showCreateRequestSheet(
      BuildContext context, AppState appState) async {
    final noteCtrl = TextEditingController();
    String requestType = 'complaint';

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) => StatefulBuilder(
        builder: (ctx, setLocal) {
          bool submitting = false;
          return Padding(
            padding: EdgeInsets.fromLTRB(
                12, 16, 12, 12 + MediaQuery.of(ctx).viewInsets.bottom),
            child: _Sheet(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SheetHandle(),
                  const SizedBox(height: 16),
                  Text('Create request',
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                          color: Colors.white)),
                  const SizedBox(height: 4),
                  Text('Use for shift, disconnect, link service or other changes.',
                      style: GoogleFonts.inter(
                          color: kMuted, fontSize: 13, height: 1.4)),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ['complaint', 'shift', 'disconnect', 'link_service']
                        .map((item) {
                      final sel = requestType == item;
                      return GestureDetector(
                        onTap: submitting
                            ? null
                            : () => setLocal(() => requestType = item),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: sel
                                ? kPrimary.withValues(alpha: 0.15)
                                : kSurface2,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                                color: sel
                                    ? kPrimary.withValues(alpha: 0.5)
                                    : kBorder),
                          ),
                          child: Text(item,
                              style: GoogleFonts.inter(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: sel ? kPrimaryLight : kMuted)),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: noteCtrl,
                    enabled: !submitting,
                    style: GoogleFonts.inter(color: Colors.white),
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(labelText: 'Request note'),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: submitting
                          ? null // ignore: dead_code
                          : () async {
                              final note = noteCtrl.text.trim();
                              if (note.isEmpty) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text(
                                            'Enter a request note first.')));
                                return;
                              }
                              setLocal(() => submitting = true);
                              final num = await appState.submitServiceRequest(
                                  type: requestType, note: note);
                              if (!context.mounted) return;
                              if (num != null) {
                                Navigator.pop(sheetCtx);
                                await appState.refresh();
                                final r = _findLatestRequest(appState, num);
                                if (!context.mounted) return;
                                ScaffoldMessenger.of(context)
                                    .showSnackBar(SnackBar(
                                  content: Text('Request created: $num'),
                                  action: r == null
                                      ? null
                                      : SnackBarAction(
                                          label: 'View',
                                          onPressed: () =>
                                              _showRequestDetails(context, r)),
                                ));
                                return;
                              }
                              setLocal(() => submitting = false);
                              ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                      content: Text(appState.error ??
                                          'Unable to create request')));
                            },
                      child: Text(
                          submitting ? 'Submitting…' : 'Submit request'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
    noteCtrl.dispose();
  }
}

// ── Hero Card ─────────────────────────────────────────────────────────────────

class _SupportHeroCard extends StatelessWidget {
  const _SupportHeroCard({
    required this.totalTickets,
    required this.openTickets,
    required this.totalRequests,
    required this.openRequests,
    required this.onChat,
    required this.onTicket,
    required this.onRequest,
  });

  final int totalTickets, openTickets, totalRequests, openRequests;
  final VoidCallback onChat, onTicket, onRequest;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF8224E3),
        border: Border.all(color: const Color(0x55A855F7)),
        borderRadius: BorderRadius.circular(26),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -55,
            right: -45,
            child: Container(
              width: 180,
              height: 180,
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
                // Title row
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
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.4)),
                        Text('Get help fast',
                            style: GoogleFonts.inter(
                                color: Colors.white60, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                // Stats row
                Row(
                  children: [
                    _stat('Tickets', '$totalTickets'),
                    _statDiv(),
                    _stat('Open', '$openTickets'),
                    _statDiv(),
                    _stat('Requests', '$totalRequests'),
                    _statDiv(),
                    _stat('Pending', '$openRequests'),
                  ],
                ),
                const SizedBox(height: 20),
                // Action buttons
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: PressableScale(
                        onTap: onChat,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.chat_rounded,
                                  color: Colors.white, size: 16),
                              const SizedBox(width: 6),
                              Text('Open chat',
                                  style: GoogleFonts.inter(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: PressableScale(
                        onTap: onTicket,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.15)),
                          ),
                          child: Column(
                            children: [
                              const Icon(Icons.confirmation_number_rounded,
                                  color: Colors.white70, size: 16),
                              const SizedBox(height: 3),
                              Text('Ticket',
                                  style: GoogleFonts.inter(
                                      color: Colors.white70,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: PressableScale(
                        onTap: onRequest,
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.15)),
                          ),
                          child: Column(
                            children: [
                              const Icon(Icons.build_circle_rounded,
                                  color: Colors.white70, size: 16),
                              const SizedBox(height: 3),
                              Text('Request',
                                  style: GoogleFonts.inter(
                                      color: Colors.white70,
                                      fontWeight: FontWeight.w600,
                                      fontSize: 11)),
                            ],
                          ),
                        ),
                      ),
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

  Widget _stat(String label, String value) => Expanded(
        child: Column(
          children: [
            Text(value,
                style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(label,
                style: GoogleFonts.inter(
                    color: Colors.white54,
                    fontSize: 10,
                    fontWeight: FontWeight.w500)),
          ],
        ),
      );

  Widget _statDiv() => Container(
        width: 1, height: 26, color: Colors.white.withValues(alpha: 0.18));
}

// ── Issue Chip ────────────────────────────────────────────────────────────────

class _IssueChip extends StatelessWidget {
  const _IssueChip({
    required this.label,
    required this.issueType,
    required this.context,
    required this.appState,
  });

  final String label, issueType;
  final BuildContext context;
  final AppState appState;

  @override
  Widget build(BuildContext _) {
    return PressableScale(
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) =>
                SupportAssistantScreen(issueType: issueType)));
        if (context.mounted) await appState.refresh();
      },
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: kBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.bolt_rounded,
                color: kPrimaryLight, size: 14),
            const SizedBox(width: 5),
            Text(label,
                style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Colors.white)),
          ],
        ),
      ),
    );
  }
}

// ── Item Card ─────────────────────────────────────────────────────────────────

class _TrackingChip extends StatelessWidget {
  const _TrackingChip({required this.context, required this.appState});

  final BuildContext context;
  final AppState appState;

  @override
  Widget build(BuildContext _) {
    return PressableScale(
      onTap: () async {
        await Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const ServiceTrackingScreen()),
        );
        if (context.mounted) await appState.refreshBookingTracking();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: kPrimary.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: kPrimaryLight.withValues(alpha: 0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.track_changes_rounded,
                color: kPrimaryLight, size: 14),
            const SizedBox(width: 5),
            Text('Tracking',
                style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Colors.white)),
          ],
        ),
      ),
    );
  }
}

class _TrackingEntryCard extends StatelessWidget {
  const _TrackingEntryCard({required this.openItems, required this.onTap});

  final int openItems;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: const Color(0xFF8224E3),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: const Color(0x55D8B4FE)),
          boxShadow: [
            BoxShadow(
              color: kPrimary.withValues(alpha: 0.18),
              blurRadius: 22,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18)),
              ),
              child: const Icon(Icons.track_changes_rounded,
                  color: Colors.white, size: 26),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Tracking',
                      style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text(
                    'Bookings, installer visits, requests and complaints now live inside Support.',
                    style: GoogleFonts.inter(
                        color: Colors.white70, fontSize: 12, height: 1.35),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              children: [
                Text('$openItems',
                    style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900)),
                Text('open',
                    style: GoogleFonts.inter(
                        color: Colors.white70,
                        fontSize: 10,
                        fontWeight: FontWeight.w700)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? kPrimary.withValues(alpha: 0.14) : kSurface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected
                ? kPrimaryLight.withValues(alpha: 0.35)
                : kBorder,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: selected ? kPrimaryLight : Colors.white,
          ),
        ),
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({
    required this.icon,
    required this.title,
    required this.ref,
    required this.meta,
    required this.createdAt,
    required this.status,
    required this.statusColor,
    required this.onTap,
  });

  final IconData icon;
  final String title, ref, meta, createdAt, status;
  final Color statusColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kBorder),
          boxShadow: [
            BoxShadow(
              color: statusColor.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(13),
                border:
                    Border.all(color: statusColor.withValues(alpha: 0.2)),
              ),
              child: Icon(icon, color: statusColor, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: GoogleFonts.inter(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: Colors.white),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 3),
                  Text('$ref · $meta',
                      style: GoogleFonts.inter(
                          fontSize: 11,
                          color: kMuted,
                          fontWeight: FontWeight.w600)),
                  if (createdAt.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(createdAt,
                        style: GoogleFonts.inter(
                            fontSize: 11, color: kMuted.withValues(alpha: 0.7))),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: statusColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(999),
                border:
                    Border.all(color: statusColor.withValues(alpha: 0.3)),
              ),
              child: Text(status,
                  style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: statusColor)),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Empty Card ────────────────────────────────────────────────────────────────

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onTap,
  });

  final IconData icon;
  final String title, subtitle, actionLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: kPrimaryLight, size: 20),
          ),
          const SizedBox(height: 12),
          Text(title,
              style: GoogleFonts.inter(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  color: Colors.white)),
          const SizedBox(height: 4),
          Text(subtitle,
              style: GoogleFonts.inter(
                  fontSize: 12, color: kMuted, height: 1.4)),
          const SizedBox(height: 14),
          PressableScale(
            onTap: onTap,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: kPrimary.withValues(alpha: 0.3)),
              ),
              child: Text(actionLabel,
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: kPrimaryLight)),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Detail Sheet ──────────────────────────────────────────────────────────────

class _DetailSheet extends StatelessWidget {
  const _DetailSheet({
    required this.title,
    required this.subtitle,
    required this.reference,
    required this.status,
    required this.statusColor,
    required this.nextStep,
    required this.rows,
  });

  final String title, subtitle, reference, status;
  final String nextStep;
  final Color statusColor;
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 20),
        child: _Sheet(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SheetHandle(),
              const SizedBox(height: 16),
              Text(title,
                  style: GoogleFonts.inter(
                      fontWeight: FontWeight.w800,
                      fontSize: 20,
                      color: Colors.white),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 4),
              Text(subtitle,
                  style: GoogleFonts.inter(
                      fontSize: 12,
                      color: kMuted,
                      fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 7),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                          color: statusColor.withValues(alpha: 0.35)),
                    ),
                    child: Text(status,
                        style: GoogleFonts.inter(
                            fontWeight: FontWeight.w800,
                            color: statusColor,
                            fontSize: 12)),
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(
                          ClipboardData(text: reference));
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Reference copied')));
                      }
                    },
                    icon: const Icon(Icons.copy_rounded, size: 16),
                    label: const Text('Copy ref'),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: kSurface2,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Next step',
                        style: GoogleFonts.inter(
                            fontSize: 12,
                            color: kMuted,
                            fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(nextStep,
                        style: GoogleFonts.inter(
                            fontSize: 12,
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                            height: 1.45)),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Container(
                decoration: BoxDecoration(
                  color: kSurface2,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: kBorder),
                ),
                child: Column(
                  children: rows.asMap().entries.map((e) {
                    final isLast = e.key == rows.length - 1;
                    final (label, value) = e.value;
                    return Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: isLast
                              ? BorderSide.none
                              : const BorderSide(color: kBorder),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 110,
                            child: Text(label,
                                style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: kMuted,
                                    fontWeight: FontWeight.w600)),
                          ),
                          Expanded(
                            child: Text(value,
                                style: GoogleFonts.inter(
                                    fontSize: 12,
                                    color: Colors.white,
                                    fontWeight: FontWeight.w600,
                                    height: 1.4)),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 4),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Sheet container ───────────────────────────────────────────────────────────

class _Sheet extends StatelessWidget {
  const _Sheet({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: kBorder),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: child,
    );
  }
}

class _SheetHandle extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 36,
        height: 4,
        decoration: BoxDecoration(
          color: kBorder,
          borderRadius: BorderRadius.circular(999),
        ),
      ),
    );
  }
}
