import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/app_state.dart';
import '../../core/models.dart';
import '../../widgets/app_card.dart';

class JobsTab extends StatefulWidget {
  const JobsTab({super.key});

  @override
  State<JobsTab> createState() => _JobsTabState();
}

class _JobsTabState extends State<JobsTab> {
  final serialController = TextEditingController(text: 'ALCLB3DCCB87');

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
      children: [
        Text('Assigned Jobs', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 18),
        ...(appState.jobs.isEmpty
            ? [const AppCard(child: Text('No jobs available right now.'))]
            : appState.jobs.map((job) => Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: _jobCard(context, appState, job),
                ))),
      ],
    );
  }

  Widget _jobCard(BuildContext context, InstallerAppState appState, InstallerJob job) {
    final preview = appState.selectedJobId == job.id ? appState.preview : null;
    return AppCard(
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
                    Text(job.customerName, style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(job.customerAddress, style: Theme.of(context).textTheme.bodyMedium),
                    if (job.latitude != null && job.longitude != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Pinned: ${job.latitude!.toStringAsFixed(6)}, ${job.longitude!.toStringAsFixed(6)}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ],
                ),
              ),
              Text(job.status, style: const TextStyle(color: Color(0xFF79F1D3), fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 14),
          TextField(
            controller: serialController,
            decoration: const InputDecoration(labelText: 'ONT Serial'),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              if (job.latitude != null && job.longitude != null)
                OutlinedButton(
                  onPressed: () => _openMap(job),
                  child: const Text('Open Map'),
                ),
              FilledButton(
                onPressed: appState.busy ? null : () => appState.loadPreview(job.id),
                child: const Text('Preview'),
              ),
              FilledButton.tonal(
                onPressed: appState.busy ? null : () => appState.runActivationFlow(job.id, serialController.text),
                child: Text(appState.busy ? 'Running...' : 'Activate'),
              ),
            ],
          ),
          if (preview != null) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF162434),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Preview · ${preview.brand}', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 10),
                  Text('PPPoE: ${preview.pppoeUsername} / ${preview.pppoePassword}'),
                  const SizedBox(height: 6),
                  Text('Wi-Fi: ${preview.ssid24} / ${preview.ssid5}'),
                  const SizedBox(height: 6),
                  Text('Password: ${preview.wifiPassword}'),
                  const SizedBox(height: 6),
                  Text('VLAN: ${preview.vlanId}'),
                ],
              ),
            ),
          ],
          if ((appState.error ?? '').isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(appState.error!, style: const TextStyle(color: Colors.redAccent)),
          ],
        ],
      ),
    );
  }

  Future<void> _openMap(InstallerJob job) async {
    final url = job.mapUrl.isNotEmpty
        ? job.mapUrl
        : 'https://maps.google.com/?q=${job.latitude},${job.longitude}';
    final uri = Uri.parse(url);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }
}
