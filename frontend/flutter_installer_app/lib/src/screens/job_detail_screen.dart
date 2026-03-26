import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../widgets/app_card.dart';
import '../widgets/field_background.dart';
import 'serial_scan_screen.dart';

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
  final _imagePicker = ImagePicker();
  final _workflowController = PageController();
  String _complaintResolutionCode = 'ont_replace';
  bool _busy = false;
  bool _routerPhotoReady = false;
  bool _cablePhotoReady = false;
  int _activationCountdown = 0;
  Timer? _activationTimer;
  Timer? _detailRefreshTimer;
  DateTime? _routerPhotoCapturedAt;
  DateTime? _cablePhotoCapturedAt;
  String? _routerPhotoPath;
  String? _cablePhotoPath;
  Map<String, dynamic>? _detail;
  Map<String, dynamic>? _diagnostics;
  Map<String, dynamic>? _preview;
  int _workflowPage = 0;
  bool _showAdvancedPanels = false;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _activationTimer?.cancel();
    _detailRefreshTimer?.cancel();
    _serialController.dispose();
    _otpController.dispose();
    _replaceSerialController.dispose();
    _complaintNoteController.dispose();
    _workflowController.dispose();
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

  void _scheduleDetailRefreshIfNeeded() {
    _detailRefreshTimer?.cancel();
    final status = (_detail?['status'] ?? '').toString();
    final configStatus = (_detail?['activation']?['configStatus'] ?? '').toString();
    final shouldPoll =
        status == 'activation_in_progress' ||
        configStatus == 'pending' ||
        configStatus == 'retried';
    if (!shouldPoll) return;
    _detailRefreshTimer = Timer(const Duration(seconds: 3), () {
      if (!mounted || _busy) return;
      _loadAll();
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
                'planCode': previewModel.planCode,
                'planName': previewModel.planName,
                'planCategory': previewModel.planCategory,
                'monthlyPrice': previewModel.monthlyPrice,
                'otcCharge': previewModel.otcCharge,
                'installationCharge': previewModel.installationCharge,
                'tags': previewModel.tags,
                'staticBenefits': previewModel.staticBenefits,
                'features': previewModel.features,
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
      _scheduleDetailRefreshIfNeeded();
    } catch (e) {
      _show('${e.toString()}');
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<bool> _run(Future<dynamic> Function() action, String success) async {
    setState(() => _busy = true);
    try {
      await action();
      await _appState.refresh();
      await _loadAll();
      _show(success);
      return true;
    } catch (e) {
      _show(e.toString());
      return false;
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<bool> _runAndClose(Future<dynamic> Function() action, String success) async {
    final ok = await _run(action, success);
    if (!mounted || !ok) return ok;
    Navigator.of(context).pop(true);
    return ok;
  }

  Future<void> _refreshPreviewAndDiagnostics({String successMessage = 'ONT details refreshed'}) async {
    final session = _appState.session;
    if (session == null) return;
    setState(() => _busy = true);
    try {
      final serial = _serialController.text.trim();
      final savedSerial =
          (_detail?['deviceContext']?['finalSerialNumber'] ?? _detail?['deviceContext']?['manualSerialNumber'] ?? '')
              .toString()
              .trim();
      if (serial.isNotEmpty && serial != savedSerial) {
        await _appState.api.setManualSerial(session, widget.job.id, serial);
      }
      await _loadAll();
      if (!mounted) return;
      _show(successMessage);
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

  Future<void> _scanSerial({
    required TextEditingController controller,
    required String title,
    required String subtitle,
  }) async {
    final scanned = await Navigator.of(context).push<String>(
      MaterialPageRoute(
        builder: (_) => SerialScanScreen(
          title: title,
          subtitle: subtitle,
        ),
      ),
    );
    if (!mounted || scanned == null || scanned.trim().isEmpty) return;
    setState(() {
      controller.text = scanned.trim();
    });
    _show('Serial scanned: ${scanned.trim()}');
  }

  Future<void> _captureProofPhoto({required bool routerPhoto}) async {
    try {
      final file = await _imagePicker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
      );
      if (!mounted || file == null) return;
      setState(() {
        if (routerPhoto) {
          _routerPhotoReady = true;
          _routerPhotoCapturedAt = DateTime.now();
          _routerPhotoPath = file.path;
        } else {
          _cablePhotoReady = true;
          _cablePhotoCapturedAt = DateTime.now();
          _cablePhotoPath = file.path;
        }
      });
      _show(routerPhoto ? 'Router photo captured' : 'Cable photo captured');
    } catch (e) {
      _show('Unable to open camera right now');
    }
  }

  Future<void> _copyText(String successMessage, String value) async {
    await Clipboard.setData(ClipboardData(text: value));
    _show(successMessage);
  }

  String _firstNonBlankText(List<dynamic> values, {String fallback = '-'}) {
    for (final value in values) {
      if (value == null) continue;
      final text = value.toString().trim();
      if (text.isNotEmpty) return text;
    }
    return fallback;
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
    final timeline = (detail?['timeline'] as List?)?.whereType<Map>().map((item) => item.cast<String, dynamic>()).toList() ?? const <Map<String, dynamic>>[];
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
    final prepared = (activation['preparedCredentials'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final preparedWifi = (prepared['wifi'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final preparedPppoe = (prepared['pppoe'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};
    final wifiSsid24 = _firstNonBlankText([
      wifi['ssid24'],
      activation['credentials']?['wifi']?['ssid24'],
      preparedWifi['ssid24'],
    ]);
    final wifiSsid5 = _firstNonBlankText([
      wifi['ssid5'],
      activation['credentials']?['wifi']?['ssid5'],
      preparedWifi['ssid5'],
    ]);
    final wifiPassword = _firstNonBlankText([
      wifi['password'],
      activation['credentials']?['wifi']?['password'],
      preparedWifi['password'],
    ]);
    final pppoeUsername = _firstNonBlankText([
      pppoe['username'],
      activation['credentials']?['pppoeUsername'],
      preparedPppoe['username'],
    ]);
    final pppoePassword = _firstNonBlankText([
      pppoe['password'],
      activation['credentials']?['pppoePassword'],
      preparedPppoe['password'],
    ]);
    final singleWifiName = wifiSsid24 != '-' && wifiSsid24 == wifiSsid5;
    final planCode = widget.job.planCode.isEmpty ? (preview['planCode'] ?? '').toString() : widget.job.planCode;
    final planCategory = widget.job.planCategory.isEmpty ? (preview['planCategory'] ?? 'home').toString() : widget.job.planCategory;
    final planPrice = widget.job.monthlyPrice > 0 ? widget.job.monthlyPrice : double.tryParse('${preview['monthlyPrice'] ?? 0}') ?? 0;
    final planDownload = widget.job.downloadSpeedMbps > 0 ? widget.job.downloadSpeedMbps : double.tryParse('${preview['speedMbps'] ?? 0}') ?? 0;
    final planUpload = widget.job.uploadSpeedMbps > 0 ? widget.job.uploadSpeedMbps : double.tryParse('${preview['uploadSpeedMbps'] ?? 0}') ?? 0;
    final planDataLimit = widget.job.dataLimitGb > 0 ? widget.job.dataLimitGb : double.tryParse('${preview['dataLimitGb'] ?? 0}') ?? 0;
    final planFupSpeed = widget.job.fupSpeedMbps > 0 ? widget.job.fupSpeedMbps : double.tryParse('${preview['fupSpeedMbps'] ?? 0}') ?? 0;
    final planDataPolicy = widget.job.dataPolicy.isNotEmpty ? widget.job.dataPolicy : (preview['dataPolicy'] ?? 'unlimited').toString();
    final planOtc = widget.job.otcCharge > 0 ? widget.job.otcCharge : double.tryParse('${preview['otcCharge'] ?? 0}') ?? 0;
    final planInstall = widget.job.installationCharge > 0 ? widget.job.installationCharge : double.tryParse('${preview['installationCharge'] ?? 0}') ?? 0;
    final planTags = widget.job.tags.isNotEmpty
        ? widget.job.tags
        : ((preview['tags'] as List?)?.map((item) => item.toString()).where((item) => item.isNotEmpty).toList() ?? const <String>[]);
    final planBenefits = widget.job.staticBenefits.isNotEmpty
        ? widget.job.staticBenefits
        : ((preview['staticBenefits'] as List?)?.map((item) => item.toString()).where((item) => item.isNotEmpty).toList() ?? const <String>[]);
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
    final nextStepNumber = _nextStepNumber(
      status: status,
      isComplaint: isComplaint,
      activationLive: activationLive,
      proofUploaded: proofUploaded,
      otpReady: _otpController.text.trim().length == 6,
    );
    final totalSteps = isComplaint ? 7 : 8;

    return Scaffold(
      appBar: AppBar(title: Text(widget.job.jobNumber)),
      body: FieldBackground(
        child: SafeArea(
          child: RefreshIndicator(
            color: const Color(0xFF8224E3),
            backgroundColor: const Color(0xFFF7F8FC),
            onRefresh: _loadAll,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 120),
              children: [
                AppCard(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF8224E3), Color(0xFF9B51E0)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 54,
                            height: 54,
                            decoration: BoxDecoration(
                              color: const Color(0x26FFFFFF),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: const Color(0x36FFFFFF)),
                            ),
                            child: Icon(
                              isComplaint ? Icons.build_circle_outlined : Icons.router_rounded,
                              color: Colors.white,
                              size: 28,
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0x1FFFFFFF),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: const Color(0x2CFFFFFF)),
                            ),
                            child: Text(
                              status.replaceAll('_', ' '),
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        isComplaint ? 'COMPLAINT JOB' : 'INSTALLATION JOB',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: const Color(0xFFE9D5FF),
                          letterSpacing: 3.2,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(snapshot['fullName']?.toString() ?? widget.job.customerName, style: theme.textTheme.headlineSmall),
                      const SizedBox(height: 8),
                      Text(
                        snapshot['address']?.toString() ?? widget.job.customerAddress,
                        style: const TextStyle(color: Color(0xFFF3E8FF), height: 1.45),
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
                          Expanded(child: _chip('Phone', phone.isEmpty ? '-' : phone)),
                          const SizedBox(width: 10),
                          Expanded(child: _chip('Priority', (detail?['priority'] ?? 'medium').toString())),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _chip('Plan code', planCode.isEmpty ? '-' : planCode)),
                          const SizedBox(width: 10),
                          Expanded(child: _chip('Price', planPrice > 0 ? 'Rs ${planPrice.toStringAsFixed(0)}' : '-')),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(child: _chip('Down', planDownload > 0 ? '${planDownload.toStringAsFixed(0)} Mbps' : '-')),
                          const SizedBox(width: 10),
                          Expanded(child: _chip('Up', planUpload > 0 ? '${planUpload.toStringAsFixed(0)} Mbps' : '-')),
                        ],
                      ),
                      const SizedBox(height: 14),
                      if (planTags.isNotEmpty || planBenefits.isNotEmpty) ...[
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            ...planTags.take(3).map((tag) => _miniPill(tag)),
                            ...planBenefits.take(2).map((item) => _miniPill(item)),
                          ],
                        ),
                        const SizedBox(height: 14),
                      ],
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          if (widget.job.mapUrl.isNotEmpty || (widget.job.latitude != null && widget.job.longitude != null))
                            OutlinedButton.icon(
                              onPressed: () => _openUri(
                                widget.job.mapUrl.isNotEmpty
                                    ? widget.job.mapUrl
                                    : 'https://maps.google.com/?q=${widget.job.latitude},${widget.job.longitude}',
                                fallback: 'Map not available',
                              ),
                              icon: const Icon(Icons.map_outlined, size: 18),
                              label: const Text('Open map'),
                            ),
                          if (phone.isNotEmpty)
                            OutlinedButton.icon(
                              onPressed: () => _openUri('tel:$phone', fallback: 'Call action not available'),
                              icon: const Icon(Icons.call_outlined, size: 18),
                              label: const Text('Call customer'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _workflowPager(
                  context,
                  status: status,
                  isComplaint: isComplaint,
                  phone: phone,
                  planName: planName,
                  configStatus: configStatus,
                  optical: optical,
                  diagnostics: diagnostics,
                  device: device,
                  preview: preview,
                  activation: activation,
                  pppoeUsername: pppoeUsername,
                  wifiSsid24: wifiSsid24,
                  wifiSsid5: wifiSsid5,
                  wifiPassword: wifiPassword,
                  canAccept: canAccept,
                  canStartTravel: canStartTravel,
                  canStartOnsite: canStartOnsite,
                  canActivate: canActivate,
                  canRetry: canRetry,
                  canStartComplaint: canStartComplaint,
                  canReplaceOnt: canReplaceOnt,
                  canSendComplaintOtp: canSendComplaintOtp,
                  canResolveComplaint: canResolveComplaint,
                  canSubmitProof: canSubmitProof,
                  canSendInstallOtp: canSendInstallOtp,
                  canCompleteInstall: canCompleteInstall,
                  activationLive: activationLive,
                  proofUploaded: proofUploaded,
                ),
                const SizedBox(height: 16),
                AppCard(
                  color: const Color(0xFFFFFFFF),
                  borderColor: const Color(0x228224E3),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Advanced panels', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 8),
                      const Text(
                        'Use this only when you need deeper diagnostics, timeline, or full raw workflow panels.',
                        style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: () => setState(() => _showAdvancedPanels = !_showAdvancedPanels),
                        child: Text(_showAdvancedPanels ? 'Hide advanced panels' : 'Show advanced panels'),
                      ),
                    ],
                  ),
                ),
                if (_showAdvancedPanels) ...[
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
                            color: const Color(0xFFF8F4FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x558224E3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.router_rounded, color: Color(0xFF8224E3)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Router linked: $linkedSerial',
                                  style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
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
                          color: const Color(0xFFFFFFFF),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0x228224E3)),
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
                              style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      _nextActionCard(
                        context,
                        status: status,
                        configStatus: configStatus,
                        isComplaint: isComplaint,
                        canAccept: canAccept,
                        canStartTravel: canStartTravel,
                        canStartOnsite: canStartOnsite,
                        canActivate: canActivate,
                        canRetry: canRetry,
                        canStartComplaint: canStartComplaint,
                        canReplaceOnt: canReplaceOnt,
                        canSendComplaintOtp: canSendComplaintOtp,
                        canResolveComplaint: canResolveComplaint,
                        canSubmitProof: canSubmitProof,
                        canSendInstallOtp: canSendInstallOtp,
                        canCompleteInstall: canCompleteInstall,
                        proofUploaded: proofUploaded,
                        nextStepNumber: nextStepNumber,
                        totalSteps: totalSteps,
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
                            onPressed: _busy
                                ? null
                                : () => _scanSerial(
                                      controller: _serialController,
                                      title: 'Scan ONT serial',
                                      subtitle: 'Scan the router barcode or QR code to auto-fill the ONT serial before activation.',
                                    ),
                            child: const Text('Scan barcode'),
                          ),
                          OutlinedButton(
                            onPressed: _busy ? null : () => _run(() async {}, 'Preview refreshed'),
                            child: const Text('Load preview'),
                          ),
                          OutlinedButton(
                            onPressed: _busy ? null : () => _run(() async {}, 'Diagnostics refreshed'),
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
                          if (canRetry)
                            OutlinedButton(
                              onPressed: _busy || !canRetry
                                  ? null
                                  : () => _run(
                                        () => _appState.api.retryActivation(
                                          _appState.session!,
                                          widget.job.id,
                                          note: 'Retry from installer app after partial or failed activation',
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
                            color: const Color(0xFFF8F4FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x338224E3)),
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
                                style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                              ),
                              const SizedBox(height: 12),
                              LinearProgressIndicator(
                                value: (90 - _activationCountdown) / 90,
                                minHeight: 8,
                                backgroundColor: const Color(0xFFF7F8FC),
                                valueColor: const AlwaysStoppedAnimation(Color(0xFF8224E3)),
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
                            color: const Color(0xFFF8F4FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x558224E3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_rounded, color: Color(0xFF8224E3)),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Internet is active. Customer notification should be triggered from backend activation flow.',
                                  style: const TextStyle(color: Color(0xFF131313), height: 1.4, fontWeight: FontWeight.w700),
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
                      Text('Plan and commercial summary', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 12),
                      _row('Plan lane', planCategory),
                      _row('Plan code', planCode.isEmpty ? '-' : planCode),
                      _row('Download', planDownload > 0 ? '${planDownload.toStringAsFixed(0)} Mbps' : '-'),
                      _row('Upload', planUpload > 0 ? '${planUpload.toStringAsFixed(0)} Mbps' : '-'),
                      _row('Monthly price', planPrice > 0 ? 'Rs ${planPrice.toStringAsFixed(0)}' : '-'),
                      _row('Data policy', _dataPolicyLabel(planDataPolicy)),
                      _row('Data cap', planDataPolicy == 'unlimited' ? 'Unlimited' : (planDataLimit > 0 ? '${planDataLimit.toStringAsFixed(0)} GB' : '-')),
                      _row('FUP speed', planFupSpeed > 0 ? '${planFupSpeed.toStringAsFixed(0)} Mbps' : '-'),
                      _row('OTC', planOtc > 0 ? 'Rs ${planOtc.toStringAsFixed(0)}' : '-'),
                      _row('Installation', planInstall > 0 ? 'Rs ${planInstall.toStringAsFixed(0)}' : '-'),
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
                      _row('PPPoE user', pppoeUsername),
                      _row('PPPoE password', pppoePassword),
                      _row('VLAN', (preview['vlanId'] ?? activation['credentials']?['vlanId'] ?? '-').toString()),
                      _row('NAT', ((preview['natEnabled'] ?? activation['credentials']?['natEnabled']) == true) ? 'Enabled' : 'Pending'),
                      _row(singleWifiName ? 'Wi-Fi SSID' : 'SSID 2.4G', wifiSsid24),
                      if (!singleWifiName) _row('SSID 5G', wifiSsid5),
                      _row('Wi-Fi password', wifiPassword),
                      _row('Config status', configStatus),
                      _row('Internet', status == 'active' ? 'Active' : 'Pending'),
                      if (activationLive) ...[
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Text(
                              'Customer handover',
                              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8F4FF),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: const Color(0x228224E3)),
                              ),
                              child: const Text(
                                'Live',
                                style: TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8F4FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x228224E3)),
                          ),
                          child: const Text(
                            'Share Wi-Fi names, Wi-Fi password, and PPPoE details with the customer before closing the visit.',
                            style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                              OutlinedButton(
                                onPressed: wifiSsid24 == '-' && wifiSsid5 == '-' ? null : () => _copyText(
                                  'Wi-Fi details copied',
                                  singleWifiName
                                      ? 'SSID: $wifiSsid24\nPassword: $wifiPassword'
                                      : '2.4G: $wifiSsid24\n5G: $wifiSsid5\nPassword: $wifiPassword',
                                ),
                                child: const Text('Copy Wi-Fi'),
                              ),
                            OutlinedButton(
                              onPressed: wifiPassword == '-' ? null : () => _copyText(
                                'Wi-Fi password copied',
                                wifiPassword,
                              ),
                              child: const Text('Copy Wi-Fi password'),
                            ),
                            OutlinedButton(
                              onPressed: pppoeUsername == '-' && pppoePassword == '-' ? null : () => _copyText(
                                'PPPoE credentials copied',
                                'Username: $pppoeUsername\nPassword: $pppoePassword',
                              ),
                              child: const Text('Copy PPPoE'),
                            ),
                          ],
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
                      Text('Optical and device', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 12),
                      _row('RX power', '${optical['rxPower'] ?? diagnostics['optical']?['rxPower'] ?? '-'}'),
                      _row('TX power', '${optical['txPower'] ?? diagnostics['optical']?['txPower'] ?? '-'}'),
                      _row('Health', '${optical['healthStatus'] ?? diagnostics['optical']?['healthStatus'] ?? 'unknown'}'),
                      _row('Router serial', '${device['serialNumber'] ?? deviceContext['finalSerialNumber'] ?? '-'}'),
                      _row('Router online', '${device['onlineStatus'] ?? 'unknown'}'),
                      _row('Provisioning state', '${device['provisioningState'] ?? 'pending'}'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Field timeline', style: theme.textTheme.titleLarge),
                      const SizedBox(height: 12),
                      if (timeline.isEmpty)
                        const Text(
                          'No field updates recorded yet.',
                          style: TextStyle(color: Color(0xFF6E6A67)),
                        )
                      else
                        ...timeline.reversed.take(8).map(_timelineRow),
                    ],
                  ),
                ),
                if (isComplaint) ...[
                  const SizedBox(height: 16),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text('Complaint workflow', style: theme.textTheme.titleLarge),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8F4FF),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: const Color(0x228224E3)),
                              ),
                              child: const Text(
                                'Guided',
                                style: TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8F4FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x228224E3)),
                          ),
                          child: const Text(
                            'Choose the issue type, record the complaint note, replace ONT if needed, and verify customer OTP before resolution.',
                            style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (complaint.isNotEmpty || deviceContext['oldSerialNumber'] != null || deviceContext['finalSerialNumber'] != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFFFFF),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: const Color(0x228224E3)),
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
                              onPressed: _busy
                                  ? null
                                  : () => _scanSerial(
                                        controller: _replaceSerialController,
                                        title: 'Scan replacement ONT',
                                        subtitle: 'Scan the replacement router barcode or QR code to capture the new serial for complaint resolution.',
                                      ),
                              child: const Text('Scan barcode'),
                            ),
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
                                      _runAndClose(() async {
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
                            color: const Color(0xFFFFFFFF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x228224E3)),
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
                        Row(
                          children: [
                            Text('Installation completion', style: theme.textTheme.titleLarge),
                            const Spacer(),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8F4FF),
                                borderRadius: BorderRadius.circular(999),
                                border: Border.all(color: const Color(0x228224E3)),
                              ),
                              child: const Text(
                                'Final stage',
                                style: TextStyle(color: Color(0xFF8224E3), fontWeight: FontWeight.w700, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8F4FF),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x228224E3)),
                          ),
                          child: const Text(
                            'Capture router and cable proof, submit the proof payload, then verify customer OTP to complete installation cleanly.',
                            style: TextStyle(color: Color(0xFF6E6A67), height: 1.45),
                          ),
                        ),
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
                        if (_routerPhotoPath != null || _cablePhotoPath != null) ...[
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              if (_routerPhotoPath != null) _proofPreviewCard('Router photo', _routerPhotoPath!),
                              if (_cablePhotoPath != null) _proofPreviewCard('Cable photo', _cablePhotoPath!),
                            ],
                          ),
                          const SizedBox(height: 10),
                        ],
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () => _captureProofPhoto(routerPhoto: true),
                              child: Text(_routerPhotoReady ? 'Router photo ready' : 'Capture router photo'),
                            ),
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () => _captureProofPhoto(routerPhoto: false),
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
                                          routerPhotoUrl: _routerPhotoPath != null
                                              ? Uri.file(_routerPhotoPath!).toString()
                                              : 'https://justfiber.local/proof/${widget.job.id}/router.jpg',
                                          cablePhotoUrl: _cablePhotoPath != null
                                              ? Uri.file(_cablePhotoPath!).toString()
                                              : 'https://justfiber.local/proof/${widget.job.id}/cable.jpg',
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
                                    _runAndClose(() async {
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
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x338224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF6E6A67), fontSize: 12)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _miniPill(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x338224E3)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Color(0xFF131313),
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
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
            child: Text(label, style: const TextStyle(color: Color(0xFF6E6A67))),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _proofPreviewCard(String label, String path) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F4FF),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: AspectRatio(
              aspectRatio: 1,
              child: Image.file(
                File(path),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: const Color(0xFFF2ECE6),
                  alignment: Alignment.center,
                  child: const Icon(Icons.image_not_supported_rounded, color: Color(0xFF6E6A67)),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _workflowPager(
    BuildContext context, {
    required String status,
    required bool isComplaint,
    required String phone,
    required String planName,
    required String configStatus,
    required Map<String, dynamic> optical,
    required Map<String, dynamic> diagnostics,
    required Map<String, dynamic> device,
    required Map<String, dynamic> preview,
    required Map<String, dynamic> activation,
    required String pppoeUsername,
    required String wifiSsid24,
    required String wifiSsid5,
    required String wifiPassword,
    required bool canAccept,
    required bool canStartTravel,
    required bool canStartOnsite,
    required bool canActivate,
    required bool canRetry,
    required bool canStartComplaint,
    required bool canReplaceOnt,
    required bool canSendComplaintOtp,
    required bool canResolveComplaint,
    required bool canSubmitProof,
    required bool canSendInstallOtp,
    required bool canCompleteInstall,
    required bool activationLive,
    required bool proofUploaded,
  }) {
    final singleWifiName = wifiSsid24 != '-' && wifiSsid24 == wifiSsid5;
    final pages = isComplaint
        ? ['Brief', 'Onsite', 'Resolve', 'Close']
        : ['Details', 'ONT', 'Health', 'Activate', 'Proof', 'Close'];
    return AppCard(
      color: const Color(0xFFFFFFFF),
      borderColor: const Color(0x228224E3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'WORKFLOW PAGES',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: const Color(0xFF6E6A67),
              letterSpacing: 2.8,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text('Workflow steps', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          const Text(
            'Move one step at a time through the field install flow.',
            style: TextStyle(color: Color(0xFF6E6A67), height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(
            children: List.generate(
              pages.length,
              (index) => Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: index == pages.length - 1 ? 0 : 8),
                  child: Container(
                    height: 72,
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                    decoration: BoxDecoration(
                      color: _workflowPage == index ? const Color(0xFF8224E3) : const Color(0xFFF8F4FF),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _workflowPage == index ? const Color(0xFF8224E3) : const Color(0x228224E3)),
                    ),
                    child: Column(
                      children: [
                        Text(
                          '${index + 1}',
                          style: TextStyle(
                            color: _workflowPage == index ? const Color(0xFFFFFFFF) : const Color(0xFF8224E3),
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          pages[index],
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: _workflowPage == index ? const Color(0xFFFFFFFF) : const Color(0xFF6E6A67),
                            fontWeight: FontWeight.w700,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 280,
            child: PageView(
              controller: _workflowController,
              onPageChanged: (value) => setState(() => _workflowPage = value),
              children: isComplaint
                  ? [
                      _workflowStageCard(
                        title: 'Customer briefing',
                        subtitle: 'Review customer, address, map, and ticket type before moving.',
                        children: [
                          _row('Plan', planName),
                          _row('Customer', phone.isEmpty ? '-' : phone),
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
                              FilledButton(
                                onPressed: _busy || !canAccept
                                    ? null
                                    : () => _run(() => _appState.api.acceptJob(_appState.session!, widget.job.id), 'Complaint accepted'),
                                child: const Text('Accept complaint'),
                              ),
                            ],
                          ),
                        ],
                      ),
                      _workflowStageCard(
                        title: 'Reach and start complaint',
                        subtitle: 'Travel, reach site, and start the complaint workflow.',
                        children: [
                          _row('Current stage', status.replaceAll('_', ' ')),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
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
                                child: const Text('Mark onsite'),
                              ),
                              FilledButton(
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
                            ],
                          ),
                        ],
                      ),
                      _workflowStageCard(
                        title: 'Replace and test',
                        subtitle: 'Scan replacement ONT, replace it, and trigger customer OTP.',
                        children: [
                          TextField(
                            controller: _replaceSerialController,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(labelText: 'Replacement ONT serial'),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              OutlinedButton(
                                onPressed: _busy
                                    ? null
                                    : () => _scanSerial(
                                          controller: _replaceSerialController,
                                          title: 'Scan replacement ONT',
                                          subtitle: 'Scan the replacement router barcode or QR code to capture the new serial.',
                                        ),
                                child: const Text('Scan barcode'),
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
                              FilledButton(
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
                            ],
                          ),
                        ],
                      ),
                      _workflowStageCard(
                        title: 'OTP and closure',
                        subtitle: 'Take customer OTP and resolve the complaint.',
                        children: [
                          TextField(
                            controller: _otpController,
                            onChanged: (_) => setState(() {}),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Customer OTP'),
                          ),
                          const SizedBox(height: 10),
                          FilledButton(
                            onPressed: _busy || !canResolveComplaint
                                ? null
                                : () async {
                                      final otp = _otpController.text.trim();
                                      if (otp.length != 6) {
                                        _show('Enter 6-digit OTP');
                                        return;
                                      }
                                      await _runAndClose(() async {
                                        await _appState.api.verifyComplaintOtp(_appState.session!, widget.job.id, otp);
                                        await _appState.api.resolveComplaint(_appState.session!, widget.job.id);
                                      }, 'Complaint resolved');
                                    },
                            child: const Text('Resolve complaint'),
                          ),
                        ],
                      ),
                    ]
                  : [
                      _workflowStageCard(
                        title: '1. Job details',
                        subtitle: 'Review customer, address, map, and job scope before moving.',
                        children: [
                          _row('Plan', planName),
                          _row('Customer', phone.isEmpty ? '-' : phone),
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
                              FilledButton(
                                onPressed: _busy || !canAccept
                                    ? null
                                    : () => _run(() => _appState.api.acceptJob(_appState.session!, widget.job.id), 'Job accepted'),
                                child: const Text('Accept job'),
                              ),
                            ],
                          ),
                        ],
                      ),
                      _workflowStageCard(
                        title: '2. ONT scan',
                        subtitle: 'Reach site, mark onsite, then scan or type the ONT serial.',
                        children: [
                          _row('Current stage', status.replaceAll('_', ' ')),
                          TextField(
                            controller: _serialController,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(labelText: 'ONT serial number'),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
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
                                child: const Text('Mark onsite'),
                              ),
                              FilledButton(
                                onPressed: _busy
                                    ? null
                                    : () => _scanSerial(
                                          controller: _serialController,
                                          title: 'Scan ONT serial',
                                          subtitle: 'Scan the router barcode or QR code to auto-fill the ONT serial before activation.',
                                        ),
                                child: const Text('Scan barcode'),
                              ),
                            ],
                          ),
                        ],
                      ),
                      _workflowStageCard(
                        title: '3. ONT details',
                        subtitle: 'Verify optical levels, linked router state, and provisioning health before activation.',
                        children: [
                          _row('Scanned serial', _serialController.text.trim().isEmpty ? '-' : _serialController.text.trim()),
                          _row('RX power', '${optical['rxPower'] ?? diagnostics['optical']?['rxPower'] ?? '-'}'),
                          _row('TX power', '${optical['txPower'] ?? diagnostics['optical']?['txPower'] ?? '-'}'),
                          _row('Health', '${optical['healthStatus'] ?? diagnostics['optical']?['healthStatus'] ?? 'unknown'}'),
                          _row('Router online', '${device['onlineStatus'] ?? 'unknown'}'),
                          _row('Provisioning state', '${device['provisioningState'] ?? 'pending'}'),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              OutlinedButton(
                                onPressed: _busy
                                    ? null
                                    : () => _refreshPreviewAndDiagnostics(successMessage: 'Preview refreshed'),
                                child: const Text('Load preview'),
                              ),
                              OutlinedButton(
                                onPressed: _busy
                                    ? null
                                    : () => _refreshPreviewAndDiagnostics(successMessage: 'Diagnostics refreshed'),
                                child: const Text('Refresh ONT details'),
                              ),
                            ],
                          ),
                        ],
                      ),
                      _workflowStageCard(
                        title: '4. Activation',
                        subtitle: 'Push router config, watch provisioning, and retry if backend config fails.',
                        children: [
                          _row('Current stage', status.replaceAll('_', ' ')),
                          _row('Config status', configStatus),
                          _row('PPPoE', pppoeUsername),
                          _row('VLAN', (preview['vlanId'] ?? activation['credentials']?['vlanId'] ?? activation['preparedCredentials']?['vlanId'] ?? '-').toString()),
                          _row(singleWifiName ? 'Wi-Fi SSID' : 'Wi-Fi 2.4G', wifiSsid24),
                          if (!singleWifiName) _row('Wi-Fi 5G', wifiSsid5),
                          _row('Wi-Fi password', wifiPassword),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
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
                                child: const Text('Activate'),
                              ),
                              if (canRetry)
                                OutlinedButton(
                                  onPressed: _busy || !canRetry
                                      ? null
                                      : () => _run(
                                            () => _appState.api.retryActivation(
                                              _appState.session!,
                                              widget.job.id,
                                              note: 'Retry from installer app after partial or failed activation',
                                            ),
                                            'Retry requested',
                                          ),
                                  child: const Text('Retry config'),
                                ),
                            ],
                          ),
                          if (_activationCountdown > 0) ...[
                            const SizedBox(height: 12),
                            _row('Activation wait', '${_activationCountdown}s remaining'),
                          ],
                        ],
                      ),
                      _workflowStageCard(
                        title: '5. Proof',
                        subtitle: activationLive
                            ? 'Capture router and cable proof after internet becomes active.'
                            : 'Activation must be live before proof can be closed.',
                        children: [
                          if (_routerPhotoPath != null || _cablePhotoPath != null) ...[
                            Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: [
                                if (_routerPhotoPath != null) _proofPreviewCard('Router photo', _routerPhotoPath!),
                                if (_cablePhotoPath != null) _proofPreviewCard('Cable photo', _cablePhotoPath!),
                              ],
                            ),
                            const SizedBox(height: 10),
                          ],
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              OutlinedButton(
                                onPressed: _busy ? null : () => _captureProofPhoto(routerPhoto: true),
                                child: Text(_routerPhotoReady ? 'Router photo ready' : 'Capture router photo'),
                              ),
                              OutlinedButton(
                                onPressed: _busy ? null : () => _captureProofPhoto(routerPhoto: false),
                                child: Text(_cablePhotoReady ? 'Cable photo ready' : 'Capture cable photo'),
                              ),
                              OutlinedButton(
                                onPressed: _busy || !canSubmitProof
                                    ? null
                                    : () => _run(
                                          () => _appState.api.uploadProof(
                                            _appState.session!,
                                            widget.job.id,
                                            routerPhotoUrl: _routerPhotoPath != null
                                                ? Uri.file(_routerPhotoPath!).toString()
                                                : 'https://justfiber.local/proof/${widget.job.id}/router.jpg',
                                            cablePhotoUrl: _cablePhotoPath != null
                                                ? Uri.file(_cablePhotoPath!).toString()
                                                : 'https://justfiber.local/proof/${widget.job.id}/cable.jpg',
                                          ),
                                          'Installation proof submitted',
                                        ),
                                child: Text(proofUploaded ? 'Update proof' : 'Submit proof'),
                              ),
                            ],
                          ),
                        ],
                      ),
                      _workflowStageCard(
                        title: '6. OTP and completion',
                        subtitle: proofUploaded
                            ? 'Send OTP, take customer confirmation, and complete the job.'
                            : 'Proof submit hone ke baad OTP aur completion enabled hoga.',
                        children: [
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              FilledButton(
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
                          const SizedBox(height: 10),
                          TextField(
                            controller: _otpController,
                            onChanged: (_) => setState(() {}),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(labelText: 'Customer OTP'),
                          ),
                          const SizedBox(height: 10),
                          FilledButton(
                            onPressed: _busy || !canCompleteInstall
                                ? null
                                : () async {
                                      final otp = _otpController.text.trim();
                                      if (otp.length != 6) {
                                        _show('Enter 6-digit OTP');
                                        return;
                                      }
                                      await _runAndClose(() async {
                                        await _appState.api.verifyCompletionOtp(_appState.session!, widget.job.id, otp);
                                        await _appState.api.completeJob(_appState.session!, widget.job.id);
                                      }, 'Installation completed');
                                    },
                            child: const Text('Complete installation'),
                          ),
                        ],
                      ),
                    ],
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _workflowPage == 0
                      ? null
                      : () => _workflowController.previousPage(
                            duration: const Duration(milliseconds: 220),
                            curve: Curves.easeOut,
                          ),
                  child: const Text('Previous page'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  onPressed: _workflowPage == pages.length - 1
                      ? null
                      : () => _workflowController.nextPage(
                            duration: const Duration(milliseconds: 220),
                            curve: Curves.easeOut,
                          ),
                  child: const Text('Next page'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _workflowStageCard({
    required String title,
    required String subtitle,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x228224E3)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
            ),
            const SizedBox(height: 14),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _nextActionCard(
    BuildContext context, {
    required String status,
    required String configStatus,
    required bool isComplaint,
    required bool canAccept,
    required bool canStartTravel,
    required bool canStartOnsite,
    required bool canActivate,
    required bool canRetry,
    required bool canStartComplaint,
    required bool canReplaceOnt,
    required bool canSendComplaintOtp,
    required bool canResolveComplaint,
    required bool canSubmitProof,
    required bool canSendInstallOtp,
    required bool canCompleteInstall,
    required bool proofUploaded,
    required int nextStepNumber,
    required int totalSteps,
  }) {
    final theme = Theme.of(context);
    final nextLabel = isComplaint
        ? _nextComplaintActionLabel(
            status: status,
            canAccept: canAccept,
            canStartTravel: canStartTravel,
            canStartOnsite: canStartOnsite,
            canStartComplaint: canStartComplaint,
            canReplaceOnt: canReplaceOnt,
            canSendComplaintOtp: canSendComplaintOtp,
            canResolveComplaint: canResolveComplaint,
          )
        : _nextInstallActionLabel(
            status: status,
            canAccept: canAccept,
            canStartTravel: canStartTravel,
            canStartOnsite: canStartOnsite,
            canActivate: canActivate,
            canRetry: canRetry,
            canSubmitProof: canSubmitProof,
            canSendInstallOtp: canSendInstallOtp,
            canCompleteInstall: canCompleteInstall,
          );
    final nextSubtitle = isComplaint
        ? _nextComplaintActionSubtitle(status)
        : _nextInstallActionSubtitle(status);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x558224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isComplaint ? 'GUIDED COMPLAINT FLOW' : 'GUIDED INSTALL FLOW',
            style: theme.textTheme.labelSmall?.copyWith(
              color: const Color(0xFF6E6A67),
              letterSpacing: 2.8,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Step $nextStepNumber of $totalSteps',
            style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          Text(
            nextSubtitle,
            style: const TextStyle(color: Color(0xFF6E6A67), height: 1.45),
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: nextStepNumber / totalSteps,
            minHeight: 8,
            backgroundColor: const Color(0xFFF7F8FC),
            valueColor: const AlwaysStoppedAnimation(Color(0xFF8224E3)),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton(
                onPressed: _busy ? null : () => _handleNextPrimaryAction(status, configStatus, isComplaint, proofUploaded),
                child: Text(nextLabel),
              ),
              if (!isComplaint && (status == 'onsite' || status == 'ont_scanned' || status == 'failed'))
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _scanSerial(
                            controller: _serialController,
                            title: 'Scan ONT serial',
                            subtitle: 'Scan the router barcode or QR code to auto-fill the ONT serial before activation.',
                          ),
                  child: const Text('Scan serial'),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _timelineRow(Map<String, dynamic> item) {
    final note = (item['note'] ?? '').toString();
    final actor = (item['actorType'] ?? '').toString();
    final event = (item['event'] ?? '').toString().replaceAll('.', ' ');
    final at = (item['at'] ?? '').toString();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 10,
            height: 10,
            decoration: const BoxDecoration(
              color: Color(0xFF8224E3),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8F4FF),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0x228224E3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.isEmpty ? 'timeline update' : event,
                    style: const TextStyle(color: Color(0xFF131313), fontWeight: FontWeight.w800),
                  ),
                  if (note.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      note,
                      style: const TextStyle(color: Color(0xFF6E6A67), height: 1.4),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Text(
                    '${actor.isEmpty ? 'system' : actor} Ã¢â‚¬Â¢ ${at.isEmpty ? '-' : at}',
                    style: const TextStyle(color: Color(0xFF6E6A67), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
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
            color: done ? const Color(0xFF8224E3) : const Color(0xFF6E6A67),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Color(0xFF6E6A67), fontWeight: FontWeight.w600),
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
            color: done ? const Color(0xFFF1E8FF) : const Color(0xFFF8F4FF),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: done ? const Color(0x558224E3) : const Color(0x221F2937),
            ),
          ),
          child: Text(
            stages[index].$2,
            style: TextStyle(
              color: done ? const Color(0xFF8224E3) : const Color(0xFF6E6A67),
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

  bool _canRetry(String status, String configStatus) {
    if (status == 'failed') return true;
    return ['failed', 'pushed', 'retried'].contains(configStatus);
  }

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

  int _nextStepNumber({
    required String status,
    required bool isComplaint,
    required bool activationLive,
    required bool proofUploaded,
    required bool otpReady,
  }) {
    if (isComplaint) {
      switch (status) {
        case 'assigned':
          return 1;
        case 'accepted':
          return 2;
        case 'enroute':
          return 3;
        case 'onsite':
          return 4;
        case 'complaint_in_progress':
          return otpReady ? 7 : 6;
        case 'completed':
          return 7;
        default:
          return 4;
      }
    }

    switch (status) {
      case 'assigned':
        return 1;
      case 'accepted':
        return 2;
      case 'enroute':
        return 3;
      case 'onsite':
      case 'ont_scanned':
      case 'failed':
        return 4;
      case 'activation_in_progress':
        return 5;
      case 'active':
        if (!proofUploaded) return 6;
        return otpReady ? 8 : 7;
      case 'completed':
        return 8;
      default:
        return activationLive ? 6 : 4;
    }
  }

  String _nextInstallActionLabel({
    required String status,
    required bool canAccept,
    required bool canStartTravel,
    required bool canStartOnsite,
    required bool canActivate,
    required bool canRetry,
    required bool canSubmitProof,
    required bool canSendInstallOtp,
    required bool canCompleteInstall,
  }) {
    if (canAccept) return 'Accept job';
    if (canStartTravel) return 'Start travel';
    if (canStartOnsite) return 'Mark onsite';
    if (canRetry) return 'Retry config';
    if (canActivate) return 'Run activation';
    if (canSubmitProof) return 'Submit proof';
    if (canSendInstallOtp) return 'Send OTP';
    if (canCompleteInstall) return 'Complete installation';
    if (status == 'completed') return 'Installation closed';
    return 'Wait for next update';
  }

  String _nextComplaintActionLabel({
    required String status,
    required bool canAccept,
    required bool canStartTravel,
    required bool canStartOnsite,
    required bool canStartComplaint,
    required bool canReplaceOnt,
    required bool canSendComplaintOtp,
    required bool canResolveComplaint,
  }) {
    if (canAccept && status == 'assigned') return 'Accept complaint';
    if (canStartTravel && status == 'accepted') return 'Start travel';
    if (canStartOnsite && status == 'enroute') return 'Mark onsite';
    if (canStartComplaint && status == 'onsite') return 'Start complaint';
    if (canReplaceOnt) return 'Replace ONT';
    if (canSendComplaintOtp) return 'Send OTP';
    if (canResolveComplaint) return 'Resolve complaint';
    if (status == 'completed') return 'Complaint closed';
    return 'Wait for next update';
  }

  String _nextInstallActionSubtitle(String status) {
    switch (status) {
      case 'assigned':
        return 'Take ownership from dispatch before moving toward the customer site.';
      case 'accepted':
        return 'Start travel so dispatch and customer both see movement toward the site.';
      case 'enroute':
        return 'Reach the customer location and mark the visit onsite before provisioning.';
      case 'onsite':
      case 'ont_scanned':
      case 'failed':
        return 'Link the ONT serial, preview config, check diagnostics, and push activation.';
      case 'activation_in_progress':
        return 'Backend is pushing PPPoE, VLAN, NAT, and Wi-Fi config to the router.';
      case 'active':
        return 'Capture proof, submit it, send OTP, and complete customer handover.';
      case 'completed':
        return 'Installation is closed. Review the proof, timeline, and final router details.';
      default:
        return 'Continue the installation sequence from the next guided action.';
    }
  }

  String _nextComplaintActionSubtitle(String status) {
    switch (status) {
      case 'assigned':
        return 'Take ownership of the complaint ticket before moving to site.';
      case 'accepted':
        return 'Start travel so the complaint visit is active in the field queue.';
      case 'enroute':
        return 'Reach customer site and mark the visit onsite before starting complaint work.';
      case 'onsite':
        return 'Select issue type, add complaint note, and start the complaint workflow.';
      case 'complaint_in_progress':
        return 'Replace ONT if needed, verify the fix, send customer OTP, and close the complaint.';
      case 'completed':
        return 'Complaint is closed. Review replacement summary and final timeline.';
      default:
        return 'Continue the complaint workflow from the next guided action.';
    }
  }

  String _dataPolicyLabel(String policy) {
    switch (policy) {
      case 'fup':
        return 'FUP';
      case 'hard_cap':
        return 'Hard cap';
      default:
        return 'Unlimited';
    }
  }

  Future<void> _handleNextPrimaryAction(String status, String configStatus, bool isComplaint, bool proofUploaded) async {
    if (_busy) return;
    if (isComplaint) {
      if (_canAccept(status)) {
        await _run(() => _appState.api.acceptJob(_appState.session!, widget.job.id), 'Complaint accepted');
        return;
      }
      if (_canStartTravel(status)) {
        await _run(() => _appState.api.startTravel(_appState.session!, widget.job.id), 'Travel started');
        return;
      }
      if (_canStartOnsite(status)) {
        await _run(() async {
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
        }, 'Onsite started');
        return;
      }
      if (_canStartComplaint(status)) {
        await _run(
          () => _appState.api.startComplaint(
            _appState.session!,
            widget.job.id,
            resolutionCode: _complaintResolutionCode,
            note: _complaintNoteController.text.trim().isEmpty
                ? 'Installer started complaint work'
                : _complaintNoteController.text.trim(),
          ),
          'Complaint workflow started',
        );
        return;
      }
      if (_canReplaceOnt(status)) {
        final serial = _replaceSerialController.text.trim();
        if (serial.isEmpty) {
          _show('Enter replacement ONT serial');
          return;
        }
        await _run(
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
        return;
      }
      if (_canSendComplaintOtp(status)) {
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
        return;
      }
      if (_canResolveComplaint(status, _otpController.text.trim())) {
        final otp = _otpController.text.trim();
        await _runAndClose(() async {
          await _appState.api.verifyComplaintOtp(_appState.session!, widget.job.id, otp);
          await _appState.api.resolveComplaint(_appState.session!, widget.job.id);
        }, 'Complaint resolved');
        return;
      }
      _show('No complaint action available right now');
      return;
    }

    if (_canAccept(status)) {
      await _run(() => _appState.api.acceptJob(_appState.session!, widget.job.id), 'Job accepted');
      return;
    }
    if (_canStartTravel(status)) {
      await _run(() => _appState.api.startTravel(_appState.session!, widget.job.id), 'Travel started');
      return;
    }
    if (_canStartOnsite(status)) {
      await _run(() async {
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
      }, 'Onsite started');
      return;
    }
    if (_canRetry(status, configStatus)) {
      await _run(
        () => _appState.api.retryActivation(
          _appState.session!,
          widget.job.id,
          note: 'Retry from installer app after partial or failed activation',
        ),
        'Retry requested',
      );
      return;
    }
    if (_canActivate(status)) {
      final serial = _serialController.text.trim();
      if (serial.isEmpty) {
        _show('Enter ONT serial first');
        return;
      }
      _startActivationCountdown();
      await _run(() => _appState.runActivationFlow(widget.job.id, serial), 'Activation requested');
      return;
    }
    if (_canSubmitProof(status, _routerPhotoReady, _cablePhotoReady)) {
      await _run(
        () => _appState.api.uploadProof(
          _appState.session!,
          widget.job.id,
          routerPhotoUrl: _routerPhotoPath != null
              ? Uri.file(_routerPhotoPath!).toString()
              : 'https://justfiber.local/proof/${widget.job.id}/router.jpg',
          cablePhotoUrl: _cablePhotoPath != null
              ? Uri.file(_cablePhotoPath!).toString()
              : 'https://justfiber.local/proof/${widget.job.id}/cable.jpg',
        ),
        'Installation proof submitted',
      );
      return;
    }
    if (_canSendInstallOtp(status, proofUploaded, _routerPhotoReady, _cablePhotoReady)) {
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
      return;
    }
    if (_canCompleteInstall(status, _otpController.text.trim())) {
      final otp = _otpController.text.trim();
      await _runAndClose(() async {
        await _appState.api.verifyCompletionOtp(_appState.session!, widget.job.id, otp);
        await _appState.api.completeJob(_appState.session!, widget.job.id);
      }, 'Installation completed');
      return;
    }
    _show('No installer action available right now');
  }

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
