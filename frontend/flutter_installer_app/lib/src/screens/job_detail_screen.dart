import 'dart:async';

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
  static const List<String> _complaintResolutionCodes = [
    'ont_replace',
    'fiber_patch',
    'low_power_fix',
    'wifi_reconfig',
    'port_reprovision',
  ];

  final _serialController = TextEditingController();
  final _otpController = TextEditingController();
  final _replaceSerialController = TextEditingController();
  final _complaintNoteController = TextEditingController(text: 'Visited site and started complaint handling.');
  String _complaintResolutionCode = 'ont_replace';
  bool _busy = false;
  bool _routerPhotoReady = false;
  bool _cablePhotoReady = false;
  int _activationCountdown = 0;
  Timer? _activationTimer;
  DateTime? _routerPhotoCapturedAt;
  DateTime? _cablePhotoCapturedAt;
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
    _activationTimer?.cancel();
    _serialController.dispose();
    _otpController.dispose();
    _replaceSerialController.dispose();
    _complaintNoteController.dispose();
    super.dispose();
  }

  InstallerAppState get _appState => InstallerStateScope.of(context);

  void _startActivationCountdown([int seconds = 90]) {
    _activationTimer?.cancel();
    setState(() => _activationCountdown = seconds);
    _activationTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _activationCountdown <= 1) {
        timer.cancel();
        if (mounted) {
          setState(() => _activationCountdown = 0);
        }
        return;
      }
      setState(() => _activationCountdown -= 1);
    });
  }

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
        final serial = (detail['deviceContext']?['finalSerialNumber'] ?? detail['deviceContext']?['manualSerialNumber'] ?? '')
            .toString();
        if (serial.isNotEmpty && _serialController.text.trim().isEmpty) {
          _serialController.text = serial;
        }
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
    final complaint = (detail?['complaint'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
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
    final linkedSerial = (device['serialNumber'] ?? deviceContext['finalSerialNumber'] ?? '').toString();
    final activationLive = status == 'active' || configStatus == 'verified' || configStatus == 'pushed';
    final complaintResolution = (complaint['resolutionCode'] ?? _complaintResolutionCode).toString();
    final proofUploaded = proof.isNotEmpty;
    final canAccept = _canAccept(status);
    final canStartTravel = _canStartTravel(status);
    final canStartOnsite = _canStartOnsite(status);
    final canActivate = _canActivate(status);
    final canRetry = _canRetry(status, configStatus);
    final canStartComplaint = _canStartComplaint(status);
    final canReplaceOnt = _canReplaceOnt(status);
    final canSendComplaintOtp = _canSendComplaintOtp(status);
    final canResolveComplaint = _canResolveComplaint(status, _otpController.text.trim());
    final canSubmitProof = _canSubmitProof(status, _routerPhotoReady, _cablePhotoReady);
    final canSendInstallOtp = _canSendInstallOtp(status, proofUploaded, _routerPhotoReady, _cablePhotoReady);
    final canCompleteInstall = _canCompleteInstall(status, _otpController.text.trim());

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
                      if (linkedSerial.isNotEmpty) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF141A22),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x55E6FF3C)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.router_rounded, color: Color(0xFFE6FF3C)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Router linked: $linkedSerial',
                                  style: const TextStyle(color: Color(0xFFEFEEE8), fontWeight: FontWeight.w800),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],
                      Text('Field actions', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 14),
                      _stageTimeline(status, isComplaint: isComplaint),
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10151A),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0x22E6FF3C)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isComplaint ? 'Current complaint stage' : 'Current install stage',
                              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _nextActionText(
                                status: status,
                                isComplaint: isComplaint,
                                linkedSerial: linkedSerial,
                                activationLive: activationLive,
                                proofUploaded: proofUploaded,
                              ),
                              style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          OutlinedButton(
                            onPressed: _busy || !canAccept
                                ? null
                                : () => _run(() => _appState.api.acceptJob(_appState.session!, widget.job.id), 'Job accepted'),
                            child: const Text('Accept'),
                          ),
                          OutlinedButton(
                            onPressed: _busy || !canStartTravel
                                ? null
                                : () => _run(() => _appState.api.startTravel(_appState.session!, widget.job.id), 'Travel started'),
                            child: const Text('Start travel'),
                          ),
                          OutlinedButton(
                            onPressed: _busy || !canStartOnsite
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
                        onChanged: (_) => setState(() {}),
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
                            onPressed: _busy || !canActivate
                                ? null
                                : () {
                                    final serial = _serialController.text.trim();
                                    if (serial.isEmpty) {
                                      _show('Enter ONT serial first');
                                      return;
                                    }
                                    _startActivationCountdown();
                                    _run(() => _appState.runActivationFlow(widget.job.id, serial), 'Activation requested');
                                  },
                            child: Text(_busy ? 'Working...' : 'Activate'),
                          ),
                          if (configStatus == 'failed' || status == 'failed')
                            OutlinedButton(
                              onPressed: _busy || !canRetry
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
                      if (_activationCountdown > 0) ...[
                        const SizedBox(height: 14),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF141A22),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x33E6FF3C)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Configuring router',
                                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Waiting for backend config push and ONT read-back. Approx time left: ${_activationCountdown}s',
                                style: const TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                              ),
                              const SizedBox(height: 12),
                              LinearProgressIndicator(
                                value: (90 - _activationCountdown) / 90,
                                minHeight: 8,
                                backgroundColor: const Color(0xFF0C1018),
                                valueColor: const AlwaysStoppedAnimation(Color(0xFFE6FF3C)),
                              ),
                            ],
                          ),
                        ),
                      ],
                      if (activationLive) ...[
                        const SizedBox(height: 14),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF141A22),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x55E6FF3C)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_rounded, color: Color(0xFFE6FF3C)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Internet is active. Customer notification should be triggered from backend activation flow.',
                                  style: const TextStyle(color: Color(0xFFEFEEE8), height: 1.4, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
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
                        if (complaint.isNotEmpty || deviceContext['oldSerialNumber'] != null || deviceContext['finalSerialNumber'] != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10151A),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: const Color(0x22E6FF3C)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Replacement summary',
                                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 10),
                                _row('Resolution code', complaintResolution.replaceAll('_', ' ')),
                                _row('Old serial', '${deviceContext['oldSerialNumber'] ?? '-'}'),
                                _row('New serial', '${deviceContext['finalSerialNumber'] ?? '-'}'),
                                _row('Complaint note', '${complaint['note'] ?? _complaintNoteController.text.trim()}'),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                        Text(
                          'Issue type',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _complaintResolutionCodes
                              .map(
                                (code) => ChoiceChip(
                                  label: Text(code.replaceAll('_', ' ')),
                                  selected: _complaintResolutionCode == code,
                                  onSelected: _busy
                                      ? null
                                      : (selected) {
                                          if (!selected) return;
                                          setState(() => _complaintResolutionCode = code);
                                        },
                                ),
                              )
                              .toList(),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _complaintNoteController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(labelText: 'Complaint note'),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _replaceSerialController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(labelText: 'Replacement ONT serial'),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            OutlinedButton(
                              onPressed: _busy || !canStartComplaint
                                  ? null
                                  : () => _run(
                                        () => _appState.api.startComplaint(
                                          _appState.session!,
                                          widget.job.id,
                                          resolutionCode: _complaintResolutionCode,
                                          note: _complaintNoteController.text.trim().isEmpty
                                              ? 'Installer started complaint work'
                                              : _complaintNoteController.text.trim(),
                                        ),
                                        'Complaint workflow started',
                                      ),
                              child: const Text('Start complaint'),
                            ),
                            OutlinedButton(
                              onPressed: _busy || !canReplaceOnt
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
                              onPressed: _busy || !canSendComplaintOtp
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
                              onPressed: _busy || !canResolveComplaint
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
                        const SizedBox(height: 12),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10151A),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x22E6FF3C)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Complaint closure checklist',
                                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 10),
                              _checkRow('Issue identified', complaint['note'] != null || _complaintNoteController.text.trim().isNotEmpty),
                              _checkRow('Resolution selected', _complaintResolutionCode.isNotEmpty),
                              _checkRow('ONT replaced if needed', deviceContext['finalSerialNumber'] != null || !canReplaceOnt),
                              _checkRow('Customer OTP entered', _otpController.text.trim().length == 6),
                            ],
                          ),
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
                                      setState(() {
                                        _routerPhotoReady = true;
                                        _routerPhotoCapturedAt = DateTime.now();
                                      });
                                      _show('Router photo captured');
                                    },
                              child: Text(_routerPhotoReady ? 'Router photo ready' : 'Capture router photo'),
                            ),
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () async {
                                      setState(() {
                                        _cablePhotoReady = true;
                                        _cablePhotoCapturedAt = DateTime.now();
                                      });
                                      _show('Cable photo captured');
                                    },
                              child: Text(_cablePhotoReady ? 'Cable photo ready' : 'Capture cable photo'),
                            ),
                            OutlinedButton(
                              onPressed: _busy || !canSubmitProof
                                  ? null
                                  : () {
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
                              onPressed: _busy || !canSendInstallOtp
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
                        if (_routerPhotoCapturedAt != null || _cablePhotoCapturedAt != null) ...[
                          const SizedBox(height: 10),
                          if (_routerPhotoCapturedAt != null)
                            _row('Router photo', _routerPhotoCapturedAt.toString()),
                          if (_cablePhotoCapturedAt != null)
                            _row('Cable photo', _cablePhotoCapturedAt.toString()),
                        ],
                        const SizedBox(height: 12),
                        TextField(
                          controller: _otpController,
                          onChanged: (_) => setState(() {}),
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Customer OTP'),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _busy || !canCompleteInstall
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

  Widget _checkRow(String label, bool done) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            size: 18,
            color: done ? const Color(0xFFE6FF3C) : const Color(0xFF9CA3AF),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Color(0xFFD1D5DB), fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stageTimeline(String status, {required bool isComplaint}) {
    final stages = isComplaint
        ? const [
            ('accept', 'Accept'),
            ('travel', 'Travel'),
            ('onsite', 'Onsite'),
            ('replace', 'Replace ONT'),
            ('otp', 'OTP verify'),
            ('done', 'Resolved'),
          ]
        : const [
            ('accept', 'Accept'),
            ('travel', 'Travel'),
            ('onsite', 'Onsite'),
            ('serial', 'Link router'),
            ('activate', 'Activate'),
            ('proof', 'Proof'),
            ('otp', 'OTP verify'),
            ('done', 'Complete'),
          ];

    int activeIndex;
    switch (status) {
      case 'accepted':
        activeIndex = 1;
        break;
      case 'enroute':
        activeIndex = 2;
        break;
      case 'onsite':
        activeIndex = 3;
        break;
      case 'ont_scanned':
        activeIndex = 4;
        break;
      case 'activation_in_progress':
      case 'active':
        activeIndex = isComplaint ? 4 : 5;
        break;
      case 'completed':
        activeIndex = stages.length;
        break;
      case 'complaint_in_progress':
        activeIndex = 4;
        break;
      default:
        activeIndex = 0;
    }

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: List.generate(stages.length, (index) {
        final done = index < activeIndex;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: done ? const Color(0xFF1B2311) : const Color(0xFF141A22),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: done ? const Color(0x55E6FF3C) : const Color(0x221F2937),
            ),
          ),
          child: Text(
            stages[index].$2,
            style: TextStyle(
              color: done ? const Color(0xFFE6FF3C) : const Color(0xFF9CA3AF),
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        );
      }),
    );
  }

  bool _canAccept(String status) => status == 'assigned';

  bool _canStartTravel(String status) => status == 'accepted';

  bool _canStartOnsite(String status) => status == 'enroute';

  bool _canActivate(String status) => ['onsite', 'ont_scanned', 'failed'].contains(status);

  bool _canRetry(String status, String configStatus) => status == 'failed' || configStatus == 'failed';

  bool _canStartComplaint(String status) => ['assigned', 'accepted', 'enroute', 'onsite'].contains(status);

  bool _canReplaceOnt(String status) => ['onsite', 'complaint_in_progress', 'ont_scanned'].contains(status);

  bool _canSendComplaintOtp(String status) => ['complaint_in_progress', 'onsite', 'active'].contains(status);

  bool _canResolveComplaint(String status, String otp) =>
      ['complaint_in_progress', 'active', 'onsite'].contains(status) && otp.length == 6;

  bool _canSubmitProof(String status, bool routerReady, bool cableReady) =>
      ['active', 'activation_in_progress', 'onsite', 'ont_scanned'].contains(status) && routerReady && cableReady;

  bool _canSendInstallOtp(String status, bool proofUploaded, bool routerReady, bool cableReady) =>
      ['active', 'activation_in_progress'].contains(status) && (proofUploaded || (routerReady && cableReady));

  bool _canCompleteInstall(String status, String otp) =>
      ['active', 'activation_in_progress'].contains(status) && otp.length == 6;

  String _nextActionText({
    required String status,
    required bool isComplaint,
    required String linkedSerial,
    required bool activationLive,
    required bool proofUploaded,
  }) {
    if (isComplaint) {
      if (status == 'assigned') return 'Accept the complaint visit first, then start travel to customer location.';
      if (status == 'accepted') return 'Start travel and head to the customer site.';
      if (status == 'enroute') return 'Mark onsite after you reach customer location and begin complaint work.';
      if (status == 'onsite') return 'Start complaint workflow, replace ONT if needed, then send OTP for resolution.';
      if (status == 'complaint_in_progress') return 'Finish replacement/config checks, send OTP, verify it, then resolve the complaint.';
      if (status == 'completed') return 'Complaint is closed. Review the final device and timeline details.';
      return 'Open the complaint flow and continue the next field action.';
    }

    if (status == 'assigned') return 'Accept the installation job to take ownership from dispatch.';
    if (status == 'accepted') return 'Start travel and proceed to the customer location.';
    if (status == 'enroute') return 'Mark onsite once you reach the site and are ready to start installation.';
    if (status == 'onsite' && linkedSerial.isEmpty) return 'Scan or enter the ONT serial, then load diagnostics and run activation.';
    if (status == 'onsite' && linkedSerial.isNotEmpty) return 'Router is linked. Run activation and wait for backend config push.';
    if (status == 'ont_scanned') return 'Router linked. Run activation and monitor the provisioning countdown.';
    if (status == 'activation_in_progress') return 'Wait for config push. If config fails, use retry. If internet comes up, move to proof and OTP.';
    if (activationLive && !proofUploaded) return 'Internet is active. Capture router/cable proof, submit it, then send customer OTP.';
    if (activationLive && proofUploaded) return 'Proof is uploaded. Send completion OTP, verify it with customer, then complete installation.';
    if (status == 'completed') return 'Installation is closed. Review PPPoE, Wi-Fi, proof, and completion timestamps.';
    return 'Continue the next installer step from this job workflow.';
  }
}
