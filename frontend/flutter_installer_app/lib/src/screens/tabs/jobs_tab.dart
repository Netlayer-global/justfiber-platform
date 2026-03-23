import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';
import '../job_detail_screen.dart';

class JobsTab extends StatefulWidget {
  const JobsTab({super.key});

  @override
  State<JobsTab> createState() => _JobsTabState();
}

class _JobsTabState extends State<JobsTab> {
  final _searchController = TextEditingController();
  String _queueFilter = 'all';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final theme = Theme.of(context);
    final search = _searchController.text.trim().toLowerCase();
    final filteredJobs = _filterJobs(appState.jobs, search);
    final activeJobs = filteredJobs.where((job) => job.status != 'completed').toList();
    final completedJobs = filteredJobs.where((job) => job.status == 'completed').toList();
    final liveInstalls = activeJobs.where((job) => job.jobType != 'complaint').length;
    final liveComplaints = activeJobs.where((job) => job.jobType == 'complaint').length;
    final exceptionJobs = activeJobs.where((job) => job.configStatus == 'failed').length;

    return RefreshIndicator(
      color: const Color(0xFFE6FF3C),
      backgroundColor: const Color(0xFF0C1018),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          AppCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF090D15), Color(0xFF111827)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'FIELD JOBS',
                  style: theme.textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF9CA3AF),
                        letterSpacing: 3.2,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text('Dispatch queue', style: theme.textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text(
                  'Open any job card to continue the full field workflow: accept, travel, onsite, router link, activation, proof, OTP, and completion.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFFD1D5DB),
                        height: 1.45,
                      ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _metricChip('Pending', '${appState.dashboard.pendingJobs}')),
                    const SizedBox(width: 8),
                    Expanded(child: _metricChip('Active', '${activeJobs.length}')),
                    const SizedBox(width: 8),
                    Expanded(child: _metricChip('Closed', '${completedJobs.length}')),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _metricChip('Installs', '$liveInstalls')),
                    const SizedBox(width: 8),
                    Expanded(child: _metricChip('Complaints', '$liveComplaints')),
                    const SizedBox(width: 8),
                    Expanded(child: _metricChip('Exceptions', '$exceptionJobs')),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _searchController,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Search jobs, phone, plan, address',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _filterChip('All', 'all'),
                    _filterChip('Install', 'install'),
                    _filterChip('Complaint', 'complaint'),
                    _filterChip('Exceptions', 'exceptions'),
                    _filterChip('Closed', 'closed'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          if ((appState.error ?? '').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: AppCard(
                color: const Color(0xFF211113),
                borderColor: const Color(0x66EF4444),
                child: Text(
                  appState.error!,
                  style: const TextStyle(color: Color(0xFFFCA5A5), fontWeight: FontWeight.w600),
                ),
              ),
            ),
          if (appState.jobs.isEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('No jobs available right now.', style: theme.textTheme.titleLarge),
                  const SizedBox(height: 8),
                  const Text(
                    'Pull to refresh when dispatch assigns the next installation or complaint visit.',
                    style: TextStyle(color: Color(0xFF9CA3AF), height: 1.45),
                  ),
                ],
              ),
            )
          else if (filteredJobs.isEmpty)
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('No jobs matched this queue.', style: theme.textTheme.titleLarge),
                  const SizedBox(height: 8),
                  const Text(
                    'Try clearing the search or switching to another queue filter.',
                    style: TextStyle(color: Color(0xFF9CA3AF), height: 1.45),
                  ),
                ],
              ),
            )
          else ...[
            if (activeJobs.isNotEmpty) ...[
              _sectionLabel(context, 'LIVE FIELD QUEUE'),
              ...activeJobs.map(
                (job) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _jobCard(context, appState, job),
                ),
              ),
            ],
            if (completedJobs.isNotEmpty) ...[
              _sectionLabel(context, 'RECENTLY CLOSED'),
              ...completedJobs.map(
                (job) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _jobCard(context, appState, job),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _sectionLabel(BuildContext context, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: const Color(0xFF9CA3AF),
              letterSpacing: 2.8,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }

  Widget _metricChip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF10151A),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x55E6FF3C)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 20,
              color: Color(0xFFEFEEE8),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(color: Color(0xFF9CA3AF), fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String value) {
    return ChoiceChip(
      label: Text(label),
      selected: _queueFilter == value,
      onSelected: (_) => setState(() => _queueFilter = value),
    );
  }

  Widget _jobCard(BuildContext context, InstallerAppState appState, InstallerJob job) {
    final isComplaint = job.jobType == 'complaint';
    final stageLabel = _stageLabel(job);
    final primaryAction = _primaryActionLabel(job);
    final hasConfigFailure = job.configStatus == 'failed';
    final hasPinnedLocation = job.latitude != null && job.longitude != null;
    final hasLinkedRouter = job.finalSerialNumber.isNotEmpty;
    final nextVisitLabel = _nextVisitLabel(job);
    final exceptionTone = hasConfigFailure ? const Color(0xFFFCD34D) : const Color(0xFFD1D5DB);

    return InkWell(
      borderRadius: BorderRadius.circular(28),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => JobDetailScreen(job: job)),
      ),
      child: AppCard(
        color: const Color(0xFF0C1018),
        borderColor: const Color(0x22E6FF3C),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(job.jobNumber, style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 4),
                      Text(
                        job.customerName,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: const Color(0xFFEFEEE8),
                            ),
                      ),
                      if (job.customerPhone.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          job.customerPhone,
                          style: const TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF141A22),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0x55E6FF3C)),
                  ),
                  child: Text(
                    primaryAction,
                    style: const TextStyle(
                      color: Color(0xFFE6FF3C),
                      fontWeight: FontWeight.w800,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              job.customerAddress,
              style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.4),
            ),
            if (job.planName.isNotEmpty || job.scheduledAt.isNotEmpty || nextVisitLabel != '-') ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  if (job.planName.isNotEmpty)
                    Expanded(child: _infoBox('Plan', job.planName)),
                  if (job.planName.isNotEmpty && (job.scheduledAt.isNotEmpty || nextVisitLabel != '-')) const SizedBox(width: 10),
                  if (job.scheduledAt.isNotEmpty)
                    Expanded(child: _infoBox('Scheduled', _shortDate(job.scheduledAt)))
                  else if (nextVisitLabel != '-')
                    Expanded(child: _infoBox('Next step', nextVisitLabel)),
                ],
              ),
              if (job.scheduledAt.isNotEmpty && nextVisitLabel != '-') ...[
                const SizedBox(height: 10),
                _infoBox('Next step', nextVisitLabel),
              ],
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _pill(isComplaint ? 'complaint' : 'installation'),
                _pill(stageLabel),
                _pill(job.priority),
                _pill(_urgencyLabel(job)),
                if (hasPinnedLocation) _pill('Pinned location'),
                if (hasLinkedRouter) _pill('Router linked'),
              ],
            ),
            if (hasConfigFailure || job.latestEventCode.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF10151A),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: hasConfigFailure ? const Color(0x66F59E0B) : const Color(0x22E6FF3C),
                  ),
                ),
                child: Text(
                  hasConfigFailure
                      ? 'Router config failed. Open the job and retry activation.'
                      : 'Latest event: ${job.latestEventCode.replaceAll('.', ' ')}',
                  style: TextStyle(
                    color: exceptionTone,
                    fontWeight: FontWeight.w700,
                    height: 1.35,
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                if (hasPinnedLocation)
                  OutlinedButton(
                    onPressed: () => _openMap(context, job),
                    child: const Text('Open map'),
                  ),
                if (job.customerPhone.isNotEmpty)
                  OutlinedButton(
                    onPressed: () => _openCall(context, job.customerPhone),
                    child: const Text('Call customer'),
                  ),
                OutlinedButton(
                  onPressed: appState.busy || !_canAccept(job)
                      ? null
                      : () => _runAction(
                            context,
                            appState,
                            successMessage: 'Job accepted',
                            action: () => appState.acceptJob(job.id),
                          ),
                  child: const Text('Accept'),
                ),
                OutlinedButton(
                  onPressed: appState.busy || !_canStartTravel(job)
                      ? null
                      : () => _runAction(
                            context,
                            appState,
                            successMessage: 'Travel started',
                            action: () => appState.startTravel(job.id),
                          ),
                  child: const Text('Start travel'),
                ),
                OutlinedButton(
                  onPressed: appState.busy || !_canQuickPreview(job)
                      ? null
                      : () => _runAction(
                            context,
                            appState,
                            successMessage: 'Preview loaded',
                            action: () => appState.loadPreview(job.id),
                          ),
                  child: const Text('Quick preview'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              'Tap card to open full workflow',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: const Color(0xFF9CA3AF),
                  ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF10151A),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x22E6FF3C)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Color(0xFFEFEEE8), fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _pill(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFF10151A),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x55E6FF3C)),
      ),
      child: Text(
        label,
        style: const TextStyle(color: Color(0xFFEFEEE8), fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }

  Future<void> _runAction(
    BuildContext context,
    InstallerAppState appState, {
    required String successMessage,
    required Future<bool> Function() action,
  }) async {
    final ok = await action();
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(ok ? successMessage : (appState.error ?? 'Action failed')),
      ),
    );
  }

  Future<void> _openMap(BuildContext context, InstallerJob job) async {
    final url = job.mapUrl.isNotEmpty
        ? job.mapUrl
        : 'https://maps.google.com/?q=${job.latitude},${job.longitude}';
    final uri = Uri.tryParse(url);
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location link is not available right now.')),
      );
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open job location right now.')),
      );
    }
  }

  Future<void> _openCall(BuildContext context, String phone) async {
    final uri = Uri.tryParse('tel:$phone');
    if (uri == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer phone is not available right now.')),
      );
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open dialer right now.')),
      );
    }
  }

  bool _canAccept(InstallerJob job) => job.status == 'assigned';

  bool _canStartTravel(InstallerJob job) => job.status == 'accepted';

  bool _canQuickPreview(InstallerJob job) => job.status != 'completed';

  List<InstallerJob> _filterJobs(List<InstallerJob> jobs, String search) {
    final filtered = jobs.where((job) {
      final matchesFilter = switch (_queueFilter) {
        'install' => job.jobType != 'complaint' && job.status != 'completed',
        'complaint' => job.jobType == 'complaint' && job.status != 'completed',
        'exceptions' => job.configStatus == 'failed' && job.status != 'completed',
        'closed' => job.status == 'completed',
        _ => true,
      };
      if (!matchesFilter) return false;
      if (search.isEmpty) return true;
      final haystack = [
        job.jobNumber,
        job.customerName,
        job.customerPhone,
        job.customerAddress,
        job.planName,
        job.status,
        job.priority,
        job.latestEventCode,
      ].join(' ').toLowerCase();
      return haystack.contains(search);
    }).toList();
    filtered.sort(_compareJobs);
    return filtered;
  }

  int _compareJobs(InstallerJob a, InstallerJob b) {
    final aClosed = a.status == 'completed';
    final bClosed = b.status == 'completed';
    if (aClosed != bClosed) {
      return aClosed ? 1 : -1;
    }
    final priorityCompare = _priorityRank(a.priority).compareTo(_priorityRank(b.priority));
    if (priorityCompare != 0) return priorityCompare;
    final dateA = DateTime.tryParse(a.scheduledAt);
    final dateB = DateTime.tryParse(b.scheduledAt);
    if (dateA != null && dateB != null) {
      return dateA.compareTo(dateB);
    }
    if (dateA != null) return -1;
    if (dateB != null) return 1;
    return a.jobNumber.compareTo(b.jobNumber);
  }

  int _priorityRank(String value) {
    switch (value.toLowerCase()) {
      case 'critical':
        return 0;
      case 'high':
        return 1;
      case 'medium':
        return 2;
      default:
        return 3;
    }
  }

  String _urgencyLabel(InstallerJob job) {
    if (job.priority.toLowerCase() == 'critical') return 'Immediate';
    if (job.priority.toLowerCase() == 'high') return 'Priority';
    if (job.scheduledAt.isEmpty) return 'Queue ready';
    final scheduled = DateTime.tryParse(job.scheduledAt)?.toLocal();
    if (scheduled == null) return 'Queue ready';
    final minutes = scheduled.difference(DateTime.now()).inMinutes;
    if (minutes <= 0) return 'Due now';
    if (minutes <= 30) return 'Due soon';
    return 'Planned';
  }

  String _nextVisitLabel(InstallerJob job) {
    switch (job.status) {
      case 'assigned':
        return 'Accept dispatch';
      case 'accepted':
        return 'Start travel';
      case 'enroute':
        return 'Reach customer site';
      case 'onsite':
        return 'Scan ONT serial';
      case 'ont_scanned':
        return 'Push activation';
      case 'activation_in_progress':
        return 'Wait for config';
      case 'active':
        return 'Capture proof';
      case 'complaint_in_progress':
        return 'Resolve complaint';
      case 'completed':
        return 'Closed';
      default:
        return '-';
    }
  }

  String _primaryActionLabel(InstallerJob job) {
    if (job.status == 'completed') return 'Review';
    if (job.status == 'assigned') return 'Accept';
    if (job.status == 'accepted') return 'Travel';
    if (job.status == 'enroute') return 'Onsite';
    if (job.status == 'ont_scanned') return 'Activate';
    if (job.status == 'activation_in_progress') return 'Watch';
    return 'Continue';
  }

  String _stageLabel(InstallerJob job) {
    switch (job.status) {
      case 'assigned':
        return 'assigned';
      case 'accepted':
        return 'accepted';
      case 'enroute':
        return 'travelling';
      case 'onsite':
        return 'onsite';
      case 'ont_scanned':
        return 'router linked';
      case 'activation_in_progress':
        return 'activating';
      case 'complaint_in_progress':
        return 'complaint live';
      case 'active':
        return 'internet live';
      case 'completed':
        return 'completed';
      default:
        return job.status.replaceAll('_', ' ');
    }
  }

  String _shortDate(String value) {
    if (value.isEmpty) return '-';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    final local = parsed.toLocal();
    final month = <int, String>{
      1: 'Jan',
      2: 'Feb',
      3: 'Mar',
      4: 'Apr',
      5: 'May',
      6: 'Jun',
      7: 'Jul',
      8: 'Aug',
      9: 'Sep',
      10: 'Oct',
      11: 'Nov',
      12: 'Dec',
    }[local.month]!;
    final hour = local.hour == 0 ? 12 : (local.hour > 12 ? local.hour - 12 : local.hour);
    final minute = local.minute.toString().padLeft(2, '0');
    final suffix = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day} $month, $hour:$minute $suffix';
  }
}
