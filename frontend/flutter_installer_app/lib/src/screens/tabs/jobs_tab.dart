import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
    final activeJobs = filteredJobs.where((job) => job.status != 'completed' && job.status != 'deferred').toList();
    final deferredJobs = filteredJobs.where((job) => job.status == 'deferred').toList();
    final todayJobs = activeJobs.where(_isTodayJob).toList();
    final pendingJobs = activeJobs.where((job) => !_isTodayJob(job)).toList();
    final completedJobs = filteredJobs.where((job) => job.status == 'completed').toList();
    final completedTodayJobs = completedJobs.where(_isTodayJob).toList();
    final liveInstalls = activeJobs.where((job) => job.jobType != 'complaint').length;
    final liveComplaints = activeJobs.where((job) => job.jobType == 'complaint').length;
    final exceptionJobs = activeJobs.where((job) => job.configStatus == 'failed').length + deferredJobs.length;

    return RefreshIndicator(
      color: const Color(0xFF8224E3),
      backgroundColor: const Color(0xFFF7F8FC),
      onRefresh: appState.refresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
        children: [
          AppCard(
            color: const Color(0xFFFFFFFF),
            borderColor: const Color(0x140F172A),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: const Color(0x140F172A)),
                      ),
                      child: const Icon(Icons.assignment_rounded, color: Color(0xFF8224E3), size: 28),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: const Color(0x140F172A)),
                      ),
                      child: Text(
                        '${activeJobs.length} active',
                        style: const TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700, fontSize: 12),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  'FIELD JOBS',
                  style: theme.textTheme.labelSmall?.copyWith(
                        color: const Color(0xFF8224E3),
                        letterSpacing: 2.6,
                        fontWeight: FontWeight.w700,
                      ),
                ),
                const SizedBox(height: 10),
                Text('Dispatch queue', style: theme.textTheme.headlineSmall?.copyWith(color: const Color(0xFF131313))),
                const SizedBox(height: 8),
                Text(
                  'Open any job card to continue the full field workflow: accept, travel, onsite, router link, activation, proof, OTP, and completion.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF6E6A67),
                        height: 1.45,
                      ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _metricChip('Today', '${todayJobs.length}')),
                    const SizedBox(width: 8),
                    Expanded(child: _metricChip('Pending', '${pendingJobs.length}')),
                    const SizedBox(width: 8),
                    Expanded(child: _metricChip('Deferred', '${deferredJobs.length}')),
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
                    _quickFilterChip('Due today', 'today', todayJobs.length),
                    _quickFilterChip('Pending', 'pending', pendingJobs.length),
                    _quickFilterChip('Complaints', 'complaint', liveComplaints),
                    _quickFilterChip('Deferred', 'deferred', deferredJobs.length),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _filterChip('All', 'all'),
                    _filterChip('Install', 'install'),
                    _filterChip('Complaint', 'complaint'),
                    _filterChip('Deferred', 'deferred'),
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
                color: const Color(0xFFFFF5F5),
                borderColor: const Color(0x66EF4444),
                child: Text(
                  appState.error!,
                  style: const TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.w600),
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
                    style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
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
                    style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                  ),
                ],
              ),
            )
          else ...[
            if (todayJobs.isNotEmpty) ...[
              _sectionLabel(context, 'TODAY FIELD VISITS'),
              ...todayJobs.map(
                (job) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _jobCard(context, appState, job),
                ),
              ),
            ],
            if (pendingJobs.isNotEmpty) ...[
              _sectionLabel(context, 'PENDING FOLLOW-UPS'),
              ...pendingJobs.map(
                (job) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _jobCard(context, appState, job),
                ),
              ),
            ],
            if (deferredJobs.isNotEmpty) ...[
              _sectionLabel(context, 'FOLLOW-UP REQUIRED'),
              ...deferredJobs.map(
                (job) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _jobCard(context, appState, job),
                ),
              ),
            ],
            if (completedJobs.isNotEmpty) ...[
              _sectionLabel(context, completedTodayJobs.isNotEmpty ? 'COMPLETED TODAY' : 'RECENTLY CLOSED'),
              ...(completedTodayJobs.isNotEmpty ? completedTodayJobs : completedJobs).map(
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

  Future<void> _openJobWorkflow(BuildContext context, InstallerAppState appState, InstallerJob job) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => JobDetailScreen(job: job)),
    );
    if (!mounted) return;
    await appState.refresh();
  }

  Widget _sectionLabel(BuildContext context, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: const Color(0xFF6E6A67),
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
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x140F172A)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 20,
              color: Color(0xFF131313),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w700),
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

  Widget _quickFilterChip(String label, String value, int count) {
    return FilterChip(
      label: Text('$label ($count)'),
      selected: _queueFilter == value,
      onSelected: (_) => setState(() => _queueFilter = value),
      avatar: count > 0 ? const Icon(Icons.bolt_rounded, size: 16) : null,
    );
  }

  Widget _jobCard(BuildContext context, InstallerAppState appState, InstallerJob job) {
    final isComplaint = job.jobType == 'complaint';
    final stageLabel = _stageLabel(job);
    final primaryAction = _primaryActionLabel(job);
    final hasConfigFailure = job.configStatus == 'failed';
    final isDeferred = job.status == 'deferred';
    final hasPinnedLocation = job.latitude != null && job.longitude != null;
    final hasLinkedRouter = job.finalSerialNumber.isNotEmpty;
    final nextVisitLabel = _nextVisitLabel(job);
    final exceptionTone = hasConfigFailure || isDeferred ? const Color(0xFFB45309) : const Color(0xFF6E6A67);
    final deferReason = _deferReasonLabel(job.subStatus);

    return InkWell(
      borderRadius: BorderRadius.circular(28),
      onTap: () => _openJobWorkflow(context, appState, job),
      child: AppCard(
        color: const Color(0xFFFFFFFF),
        borderColor: const Color(0x140F172A),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0x140F172A)),
                  ),
                  child: Icon(
                    isComplaint ? Icons.build_circle_outlined : Icons.router_rounded,
                    color: const Color(0xFF8224E3),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(job.jobNumber, style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 4),
                      Text(
                        job.customerName,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: const Color(0xFF131313),
                            ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (job.customerPhone.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          job.customerPhone,
                          style: const TextStyle(
                            color: Color(0xFF6E6A67),
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
                    color: isDeferred ? const Color(0xFFFFF7ED) : const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: isDeferred ? const Color(0xFFFCD34D) : const Color(0xFFD8B4FE)),
                  ),
                  child: Text(
                    isDeferred ? 'Follow-up required' : primaryAction,
                    style: TextStyle(
                      color: isDeferred ? Color(0xFFB45309) : Color(0xFF8224E3),
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
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4),
            ),
            if (job.planName.isNotEmpty || job.scheduledAt.isNotEmpty || nextVisitLabel != '-') ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  if (job.planName.isNotEmpty)
                    Expanded(child: _infoBox('Plan', job.planName, icon: Icons.inventory_2_outlined)),
                  if (job.planName.isNotEmpty && (job.scheduledAt.isNotEmpty || nextVisitLabel != '-')) const SizedBox(width: 10),
                  if (job.scheduledAt.isNotEmpty)
                    Expanded(child: _infoBox('Scheduled', _shortDate(job.scheduledAt), icon: Icons.schedule_rounded))
                  else if (nextVisitLabel != '-')
                    Expanded(child: _infoBox('Next step', nextVisitLabel, icon: Icons.arrow_circle_right_outlined)),
                ],
              ),
              if (job.scheduledAt.isNotEmpty && nextVisitLabel != '-') ...[
                const SizedBox(height: 10),
                _infoBox('Next step', nextVisitLabel, icon: Icons.arrow_circle_right_outlined),
              ],
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _pill(isComplaint ? 'complaint' : 'installation'),
                _pill(stageLabel),
                if (isDeferred) _pill('Deferred'),
                _pill(job.priority),
                _pill(_urgencyLabel(job)),
                if (hasPinnedLocation) _pill('Pinned location'),
                if (hasLinkedRouter) _pill('Router linked'),
              ],
            ),
            if (hasConfigFailure || isDeferred || job.latestEventCode.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF8E8),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: hasConfigFailure ? const Color(0x66F59E0B) : const Color(0x140F172A),
                  ),
                ),
                child: Text(
                  isDeferred
                      ? 'This visit is marked for follow-up. Open the job to review the defer note and next steps.'
                      : hasConfigFailure
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
            if (isDeferred && (deferReason != '-' || job.deferNote.isNotEmpty)) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFFCD34D)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Follow-up summary',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: const Color(0xFF92400E),
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 8),
                    if (deferReason != '-')
                      Text(
                        'Reason: $deferReason',
                        style: const TextStyle(color: Color(0xFF92400E), fontWeight: FontWeight.w700),
                      ),
                    if (job.deferNote.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(
                        job.deferNote,
                        style: const TextStyle(color: Color(0xFF78350F), height: 1.35),
                      ),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                if (hasPinnedLocation)
                  OutlinedButton.icon(
                    onPressed: () => _openMap(context, job),
                    icon: const Icon(Icons.map_outlined, size: 18),
                    label: const Text('Open map'),
                  ),
                if (job.customerPhone.isNotEmpty)
                  OutlinedButton.icon(
                    onPressed: () => _openCall(context, job.customerPhone),
                    icon: const Icon(Icons.call_outlined, size: 18),
                    label: const Text('Call customer'),
                  ),
                OutlinedButton.icon(
                  onPressed: () => _copyCustomerPack(context, job),
                  icon: const Icon(Icons.copy_all_rounded, size: 18),
                  label: const Text('Copy customer'),
                ),
                OutlinedButton.icon(
                  onPressed: () => _copyJobRefs(context, job),
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: const Text('Copy refs'),
                ),
                if (isDeferred)
                  OutlinedButton.icon(
                    onPressed: appState.busy
                        ? null
                        : () => _runAction(
                              context,
                              appState,
                              successMessage: 'Follow-up resumed',
                              action: () async {
                                await appState.api.resumeFollowUp(appState.session!, job.id);
                                await appState.refresh();
                                return true;
                              },
                            ),
                    icon: const Icon(Icons.restart_alt_rounded, size: 18),
                    label: const Text('Resume revisit'),
                  ),
                OutlinedButton.icon(
                  onPressed: appState.busy || !_canAccept(job)
                      ? null
                      : () => _runAction(
                            context,
                            appState,
                            successMessage: 'Job accepted',
                            action: () => appState.acceptJob(job.id),
                          ),
                  icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                  label: const Text('Accept'),
                ),
                OutlinedButton.icon(
                  onPressed: appState.busy || !_canStartTravel(job)
                      ? null
                      : () => _runAction(
                            context,
                            appState,
                            successMessage: 'Travel started',
                            action: () => appState.startTravel(job.id),
                          ),
                  icon: const Icon(Icons.directions_car_outlined, size: 18),
                  label: const Text('Start travel'),
                ),
                OutlinedButton.icon(
                  onPressed: appState.busy || !_canQuickPreview(job)
                      ? null
                      : () => _runAction(
                            context,
                            appState,
                            successMessage: 'Preview loaded',
                            action: () => appState.loadPreview(job.id),
                          ),
                  icon: const Icon(Icons.remove_red_eye_outlined, size: 18),
                  label: const Text('Quick preview'),
                ),
                FilledButton.icon(
                  onPressed: () => _openJobWorkflow(context, appState, job),
                  icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                  label: const Text('Open workflow'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoBox(String label, String value, {required IconData icon}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x140F172A)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: const Color(0xFF8224E3)),
              const SizedBox(width: 6),
              Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontSize: 12)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _pill(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x140F172A)),
      ),
      child: Text(
        label[0].toUpperCase() + label.substring(1),
        style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700, fontSize: 12),
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

  Future<void> _copyCustomerPack(BuildContext context, InstallerJob job) async {
    final customerPack = <String>[
      'Customer: ${job.customerName.isEmpty ? '-' : job.customerName}',
      'Phone: ${job.customerPhone.isEmpty ? '-' : job.customerPhone}',
      'Address: ${job.customerAddress.isEmpty ? '-' : job.customerAddress}',
      'Job number: ${job.jobNumber}',
      'Plan: ${job.planName.isEmpty ? '-' : job.planName}',
    ].join('\n');
    await Clipboard.setData(ClipboardData(text: customerPack));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Customer pack copied')),
    );
  }

  Future<void> _copyJobRefs(BuildContext context, InstallerJob job) async {
    final refsPack = <String>[
      'Job ID: ${job.id}',
      'Job number: ${job.jobNumber}',
      'Status: ${job.status}',
      'Priority: ${job.priority.isEmpty ? '-' : job.priority}',
      'Plan code: ${job.planCode.isEmpty ? '-' : job.planCode}',
      'ONT serial: ${job.finalSerialNumber.isEmpty ? '-' : job.finalSerialNumber}',
    ].join('\n');
    await Clipboard.setData(ClipboardData(text: refsPack));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Job references copied')),
    );
  }

  bool _canAccept(InstallerJob job) => job.status == 'assigned';

  bool _canStartTravel(InstallerJob job) => job.status == 'accepted';

  bool _canQuickPreview(InstallerJob job) => job.status != 'completed';

  bool _isTodayJob(InstallerJob job) {
    if (job.scheduledAt.isEmpty) return false;
    final parsed = DateTime.tryParse(job.scheduledAt)?.toLocal();
    if (parsed == null) return false;
    final now = DateTime.now();
    return parsed.year == now.year && parsed.month == now.month && parsed.day == now.day;
  }

  List<InstallerJob> _filterJobs(List<InstallerJob> jobs, String search) {
    final filtered = jobs.where((job) {
      final matchesFilter = switch (_queueFilter) {
        'today' => _isTodayJob(job) && job.status != 'completed' && job.status != 'deferred',
        'pending' => !_isTodayJob(job) && job.status != 'completed' && job.status != 'deferred',
        'install' => job.jobType != 'complaint' && job.status != 'completed',
        'complaint' => job.jobType == 'complaint' && job.status != 'completed',
        'deferred' => job.status == 'deferred',
        'exceptions' => (job.configStatus == 'failed' || job.status == 'deferred') && job.status != 'completed',
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

  String _deferReasonLabel(String value) {
    switch (value) {
      case 'customer_unavailable':
        return 'Customer unavailable';
      case 'revisit_required':
        return 'Revisit required';
      case 'material_pending':
        return 'Material pending';
      case 'escalated':
        return 'Escalated to backend/admin';
      case 'other':
        return 'Other follow-up';
      default:
        return '-';
    }
  }

  String _nextVisitLabel(InstallerJob job) {
    switch (job.status) {
      case 'deferred':
        return 'Revisit pending';
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
    if (job.status == 'deferred') return 'Revisit';
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
      case 'deferred':
        return 'follow-up required';
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
