import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../job_detail_screen.dart';
import '../../widgets/app_card.dart';

class JobsTab extends StatefulWidget {
  const JobsTab({super.key});

  @override
  State<JobsTab> createState() => _JobsTabState();
}

class _JobsTabState extends State<JobsTab> {
  final Map<String, TextEditingController> _serialControllers = {};
  final Map<String, TextEditingController> _otpControllers = {};

  TextEditingController _serialControllerFor(String jobId) {
    return _serialControllers.putIfAbsent(jobId, () => TextEditingController());
  }

  TextEditingController _otpControllerFor(String jobId) {
    return _otpControllers.putIfAbsent(jobId, () => TextEditingController());
  }

  @override
  void dispose() {
    for (final controller in _serialControllers.values) {
      controller.dispose();
    }
    for (final controller in _otpControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final theme = Theme.of(context);

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
                Text('Assigned jobs', style: theme.textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text(
                  'Run the actual field sequence from acceptance to installation completion with diagnostics and OTP handover.',
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
                    Expanded(child: _metricChip('Completed', '${appState.dashboard.completedJobs}')),
                    const SizedBox(width: 8),
                    Expanded(child: _metricChip('Queue', '${appState.jobs.length}')),
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
          else
            ...appState.jobs.map(
              (job) => Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: _jobCard(context, appState, job),
              ),
            ),
        ],
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

  Widget _jobCard(BuildContext context, InstallerAppState appState, InstallerJob job) {
    final preview = appState.selectedJobId == job.id ? appState.preview : null;
    final diagnostics = appState.selectedJobId == job.id ? appState.diagnostics : null;
    final serialController = _serialControllerFor(job.id);
    final otpController = _otpControllerFor(job.id);

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
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(job.jobNumber, style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 4),
                      Text(
                        job.customerName,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(color: const Color(0xFFEFEEE8)),
                      ),
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
                  child: const Text(
                    'Open',
                    style: TextStyle(
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
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _pill(job.jobType.replaceAll('_', ' ')),
                _pill(job.status.replaceAll('_', ' ')),
                if (job.latitude != null && job.longitude != null) _pill('Pinned location'),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                if (job.latitude != null && job.longitude != null)
                  OutlinedButton(
                    onPressed: () => _openMap(context, job),
                    child: const Text('Open map'),
                  ),
                OutlinedButton(
                  onPressed: appState.busy
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
                  onPressed: appState.busy
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
                  onPressed: appState.busy
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
            if (preview != null || diagnostics != null) ...[
              const SizedBox(height: 14),
              Text(
                'Tap card to open full workflow',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: const Color(0xFF9CA3AF),
                    ),
              ),
            ],
          ],
        ),
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

  Widget _previewRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 90,
            child: Text(
              label,
              style: const TextStyle(color: Color(0xFF9CA3AF), fontWeight: FontWeight.w700),
            ),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: const TextStyle(color: Color(0xFFEFEEE8), fontWeight: FontWeight.w600),
            ),
          ),
        ],
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
}
