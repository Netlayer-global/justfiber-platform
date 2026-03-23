import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
import '../widgets/field_background.dart';

class JobDetailScreen extends StatefulWidget {
  const JobDetailScreen({super.key, required this.job});

  final InstallerJob job;

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  final _serialController = TextEditingController();
  final _otpController = TextEditingController();
  final _replaceSerialController = TextEditingController();
  final _complaintNoteController = TextEditingController(text: 'Visited site and started complaint handling.');
  bool _busy = false;
  bool _routerPhotoReady = false;
  bool _cablePhotoReady = false;
  Map<String, dynamic>? _detail;
  Map<String, dynamic>? _diagnostics;
  Map<String, dynamic>? _preview;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _serialController.dispose();
    _otpController.dispose();
    _replaceSerialController.dispose();
    _complaintNoteController.dispose();
    super.dispose();
  }

  InstallerAppState get _appState => InstallerStateScope.of(context);

  Future<void> _loadAll() async {
    final session = _appState.session;
    if (session == null) return;
    setState(() => _busy = true);
    try {
      final detail = await _appState.api.fetchJobDetail(session, widget.job.id);
      final diagnostics = await _appState.api.fetchDiagnostics(session, widget.job.id).catchError((_) => <String, dynamic>{});
      final previewModel = await _appState.api.fetchProvisioningPreview(session, widget.job.id).catchError((_) => null);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _diagnostics = diagnostics;
        _preview = previewModel == null
            ? <String, dynamic>{}
            : {
                'brand': previewModel.brand,
                'vlanId': previewModel.vlanId,
                'natEnabled': true,
                'pppoe': {
                  'username': previewModel.pppoeUsername,
                  'password': previewModel.pppoePassword,
                },
                'wifi': {
                  'ssid24': previewModel.ssid24,
                  'ssid5': previewModel.ssid5,
                  'password': previewModel.wifiPassword,
                },
              };
      });
    } catch (e) {
      _show('${e.toString()}');
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _run(Future<dynamic> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      await _appState.refresh();
      await _loadAll();
      _show(success);
    } catch (e) {
      _show(e.toString());
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  void _show(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _openUri(String url, {String? fallback}) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      _show(fallback ?? 'Link not available');
      return;
    }
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened) {
      _show(fallback ?? 'Unable to open right now');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final detail = _detail;
    final snapshot = (detail?['customerSnapshot'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final activation = (detail?['activation'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final deviceContext = (detail?['deviceContext'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final proof = (detail?['proof'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final optical = (detail?['opticalReadings'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final preview = _preview ?? const <String, dynamic>{};
    final diagnostics = _diagnostics ?? const <String, dynamic>{};
    final phone = (snapshot['phone'] ?? '').toString();
    final planName = (snapshot['planName'] ?? '-').toString();
    final status = (detail?['status'] ?? widget.job.status).toString();
    final isComplaint = (detail?['type'] ?? widget.job.jobType).toString() == 'complaint';
    final configStatus = (activation['configStatus'] ?? '-').toString();
    final wifi = (preview['wifi'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final pppoe = (preview['pppoe'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final device = (diagnostics['device'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};

    return Scaffold(
      appBar: AppBar(title: Text(widget.job.jobNumber)),
      body: FieldBackground(
        child: SafeArea(
          child: RefreshIndicator(
            color: const Color(0xFFE6FF3C),
            backgroundColor: const Color(0xFF0C1018),
            onRefresh: _loadAll,
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
                        isComplaint ? 'COMPLAINT JOB' : 'INSTALLATION JOB',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: const Color(0xFF9CA3AF),
                          letterSpacing: 3.2,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(snapshot['fullName']?.toString() ?? widget.job.customerName, style: theme.textTheme.headlineSmall),
                      const SizedBox(height: 8),
                      Text(
                        snapshot['address']?.toString() ?? widget.job.customerAddress,
                        style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(child: _chip('Plan', planName)),
                          const SizedBox(width: 10),
                          Expanded(child: _chip('Status', status.replaceAll('_', ' '))),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _chip('Customer', phone.isEmpty ? '-' : phone)),
                          const SizedBox(width: 10),
                          Expanded(child: _chip('Priority', (detail?['priority'] ?? 'medium').toString())),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          if (widget.job.mapUrl.isNotEmpty || (widget.job.latitude != null && widget.job.longitude != null))
                            OutlinedButton(
                              onPressed: () => _openUri(
                                widget.job.mapUrl.isNotEmpty
                                    ? widget.job.mapUrl
                                    : 'https://maps.google.com/?q=${widget.job.latitude},${widget.job.longitude}',
                                fallback: 'Map not available',
                              ),
                              child: const Text('Open map'),
                            ),
                          if (phone.isNotEmpty)
                            OutlinedButton(
                              onPressed: () => _openUri('tel:$phone', fallback: 'Call action not available'),
                              child: const Text('Call customer'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Field actions', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          OutlinedButton(
                            onPressed: _busy ? null : () => _run(() => _appState.api.acceptJob(_appState.session!, widget.job.id), 'Job accepted'),
                            child: const Text('Accept'),
                          ),
                          OutlinedButton(
                            onPressed: _busy ? null : () => _run(() => _appState.api.startTravel(_appState.session!, widget.job.id), 'Travel started'),
                            child: const Text('Start travel'),
                          ),
                          OutlinedButton(
                            onPressed: _busy
                                ? null
                                : () => _run(() async {
                                      await _appState.api.startOnsite(_appState.session!, widget.job.id);
                                      if (widget.job.latitude != null && widget.job.longitude != null) {
                                        await _appState.api.checkinLocation(
                                          _appState.session!,
                                          widget.job.id,
                                          lat: widget.job.latitude!,
                                          lng: widget.job.longitude!,
                                          address: widget.job.customerAddress,
                                        );
                                      }
                                    }, 'Onsite started'),
                            child: const Text('Start onsite'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: _serialController,
                        decoration: const InputDecoration(labelText: 'ONT serial number'),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          OutlinedButton(
                            onPressed: _busy ? null : () => _run(() => _appState.api.fetchProvisioningPreview(_appState.session!, widget.job.id), 'Preview refreshed'),
                            child: const Text('Load preview'),
                          ),
                          OutlinedButton(
                            onPressed: _busy ? null : () => _run(() => _appState.api.fetchDiagnostics(_appState.session!, widget.job.id), 'Diagnostics refreshed'),
                            child: const Text('Diagnostics'),
                          ),
                          FilledButton(
                            onPressed: _busy
                                ? null
                                : () {
                                    final serial = _serialController.text.trim();
                                    if (serial.isEmpty) {
                                      _show('Enter ONT serial first');
                                      return;
                                    }
                                    _run(() => _appState.runActivationFlow(widget.job.id, serial), 'Activation requested');
                                  },
                            child: Text(_busy ? 'Working...' : 'Activate'),
                          ),
                          if (configStatus == 'failed' || status == 'failed')
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () => _run(
                                        () => _appState.api.retryActivation(
                                          _appState.session!,
                                          widget.job.id,
                                          note: 'Retry from installer app after config failure',
                                        ),
                                        'Retry requested',
                                      ),
                              child: const Text('Retry config'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(device.isNotEmpty ? 'Router linked' : 'Provisioning details', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 12),
                      _row('Brand', (preview['brand'] ?? '-').toString()),
                      _row('PPPoE user', (pppoe['username'] ?? activation['credentials']?['pppoeUsername'] ?? '-').toString()),
                      _row('PPPoE password', (pppoe['password'] ?? activation['credentials']?['pppoePassword'] ?? '-').toString()),
                      _row('VLAN', (preview['vlanId'] ?? activation['credentials']?['vlanId'] ?? '-').toString()),
                      _row('NAT', ((preview['natEnabled'] ?? activation['credentials']?['natEnabled']) == true) ? 'Enabled' : 'Pending'),
                      _row('SSID 2.4G', (wifi['ssid24'] ?? activation['credentials']?['wifi']?['ssid24'] ?? '-').toString()),
                      _row('SSID 5G', (wifi['ssid5'] ?? activation['credentials']?['wifi']?['ssid5'] ?? '-').toString()),
                      _row('Wi-Fi password', (wifi['password'] ?? activation['credentials']?['wifi']?['password'] ?? '-').toString()),
                      _row('Config status', configStatus),
                      _row('Internet', status == 'active' ? 'Active' : 'Pending'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Optical and device', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 12),
                      _row('RX power', '${optical['rxPower'] ?? '-'}'),
                      _row('TX power', '${optical['txPower'] ?? '-'}'),
                      _row('Health', '${optical['healthStatus'] ?? diagnostics['optical']?['healthStatus'] ?? 'unknown'}'),
                      _row('Router serial', '${device['serialNumber'] ?? deviceContext['finalSerialNumber'] ?? '-'}'),
                      _row('Router online', '${device['onlineStatus'] ?? 'unknown'}'),
                      _row('Provisioning state', '${device['provisioningState'] ?? 'pending'}'),
                    ],
                  ),
                ),
                if (isComplaint) ...[
                  const SizedBox(height: 16),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Complaint workflow', style: theme.textTheme.titleLarge),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _complaintNoteController,
                          decoration: const InputDecoration(labelText: 'Complaint note'),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _replaceSerialController,
                          decoration: const InputDecoration(labelText: 'Replacement ONT serial'),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () => _run(
                                        () => _appState.api.startComplaint(
                                          _appState.session!,
                                          widget.job.id,
                                          note: _complaintNoteController.text.trim().isEmpty
                                              ? 'Installer started complaint work'
                                              : _complaintNoteController.text.trim(),
                                        ),
                                        'Complaint workflow started',
                                      ),
                              child: const Text('Start complaint'),
                            ),
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () {
                                      final serial = _replaceSerialController.text.trim();
                                      if (serial.isEmpty) {
                                        _show('Enter replacement ONT serial');
                                        return;
                                      }
                                      _run(
                                        () => _appState.api.replaceDevice(
                                          _appState.session!,
                                          widget.job.id,
                                          newSerialNumber: serial,
                                          reason: _complaintNoteController.text.trim().isEmpty
                                              ? 'ONT replaced from installer app'
                                              : _complaintNoteController.text.trim(),
                                        ),
                                        'ONT replacement saved',
                                      );
                                    },
                              child: const Text('Replace ONT'),
                            ),
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () async {
                                      setState(() => _busy = true);
                                      try {
                                        final otp = await _appState.api.sendComplaintOtp(_appState.session!, widget.job.id);
                                        _show(otp == null ? 'Complaint OTP sent' : 'Complaint OTP: $otp');
                                        await _loadAll();
                                      } catch (e) {
                                        _show(e.toString());
                                      } finally {
                                        if (mounted) setState(() => _busy = false);
                                      }
                                    },
                              child: const Text('Send OTP'),
                            ),
                            FilledButton(
                              onPressed: _busy
                                  ? null
                                  : () {
                                      final otp = _otpController.text.trim();
                                      if (otp.length != 6) {
                                        _show('Enter 6-digit OTP');
                                        return;
                                      }
                                      _run(() async {
                                        await _appState.api.verifyComplaintOtp(_appState.session!, widget.job.id, otp);
                                        await _appState.api.resolveComplaint(_appState.session!, widget.job.id);
                                      }, 'Complaint resolved');
                                    },
                              child: const Text('Resolve complaint'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  const SizedBox(height: 16),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Installation completion', style: theme.textTheme.titleLarge),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: CheckboxListTile(
                                contentPadding: EdgeInsets.zero,
                                value: _routerPhotoReady,
                                onChanged: _busy ? null : (value) => setState(() => _routerPhotoReady = value ?? false),
                                title: const Text('Router photo captured'),
                                controlAffinity: ListTileControlAffinity.leading,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            Expanded(
                              child: CheckboxListTile(
                                contentPadding: EdgeInsets.zero,
                                value: _cablePhotoReady,
                                onChanged: _busy ? null : (value) => setState(() => _cablePhotoReady = value ?? false),
                                title: const Text('Cable photo captured'),
                                controlAffinity: ListTileControlAffinity.leading,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () {
                                      if (!_routerPhotoReady || !_cablePhotoReady) {
                                        _show('Mark both router and cable photos as captured first');
                                        return;
                                      }
                                      _run(
                                        () => _appState.api.uploadProof(
                                          _appState.session!,
                                          widget.job.id,
                                          routerPhotoUrl: 'https://justfiber.local/proof/${widget.job.id}/router.jpg',
                                          cablePhotoUrl: 'https://justfiber.local/proof/${widget.job.id}/cable.jpg',
                                        ),
                                        'Installation proof submitted',
                                      );
                                    },
                              child: Text(proof.isNotEmpty ? 'Update proof' : 'Submit proof'),
                            ),
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () async {
                                      setState(() => _busy = true);
                                      try {
                                        final otp = await _appState.api.sendCompletionOtp(_appState.session!, widget.job.id);
                                        _show(otp == null ? 'Completion OTP sent' : 'Completion OTP: $otp');
                                        await _loadAll();
                                      } catch (e) {
                                        _show(e.toString());
                                      } finally {
                                        if (mounted) setState(() => _busy = false);
                                      }
                                    },
                              child: const Text('Send OTP'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _otpController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Customer OTP'),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _busy
                                ? null
                                : () {
                                    final otp = _otpController.text.trim();
                                    if (otp.length != 6) {
                                      _show('Enter 6-digit OTP');
                                      return;
                                    }
                                    _run(() async {
                                      await _appState.api.verifyCompletionOtp(_appState.session!, widget.job.id, otp);
                                      await _appState.api.completeJob(_appState.session!, widget.job.id);
                                    }, 'Installation completed');
                                  },
                            child: const Text('Complete installation'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF11161D),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x33E6FF3C)),
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

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(color: Color(0xFF9CA3AF))),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: const TextStyle(color: Color(0xFFEFEEE8), fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
