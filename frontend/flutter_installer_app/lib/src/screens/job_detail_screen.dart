import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/app_state.dart';
import '../core/models.dart';
import '../core/theme.dart';
import '../widgets/app_card.dart';
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
  static const List<String> _deferReasons = [
    'customer_unavailable',
    'revisit_required',
    'material_pending',
    'escalated',
    'other',
  ];
  static const List<String> _cancelReasons = [
    'customer_cancelled',
    'technical_feasibility_failed',
    'payment_issue',
    'material_unavailable',
    'duplicate_booking',
    'other',
  ];

  final _serialController = TextEditingController();
  final _otpController = TextEditingController();
  final _replaceSerialController = TextEditingController();
  final _complaintNoteController = TextEditingController();
  final _deferNoteController = TextEditingController(
      text: 'Customer unavailable. Follow-up required from field team.');
  final _cancelNoteController = TextEditingController(
      text:
          'Installation could not be completed. Cancelled after field review.');
  final _imagePicker = ImagePicker();
  String _complaintResolutionCode = 'ont_replace';
  String _deferReason = 'customer_unavailable';
  String _cancelReason = 'technical_feasibility_failed';
  bool _busy = false;
  int _activationCountdown = 0;
  int _rebootCountdown = 0;
  Timer? _activationTimer;
  Timer? _rebootTimer;
  Timer? _detailRefreshTimer;
  DateTime? _routerPhotoCapturedAt;
  DateTime? _cablePhotoCapturedAt;
  String? _routerPhotoPath;
  String? _cablePhotoPath;
  Map<String, dynamic>? _detail;
  Map<String, dynamic>? _diagnostics;
  Map<String, dynamic>? _preview;
  bool _showAdvancedPanels = true;
  int? _wizardStep; // null = auto-derive from status
  String? _serialConflictError;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  @override
  void dispose() {
    _activationTimer?.cancel();
    _rebootTimer?.cancel();
    _detailRefreshTimer?.cancel();
    _serialController.dispose();
    _otpController.dispose();
    _replaceSerialController.dispose();
    _complaintNoteController.dispose();
    _deferNoteController.dispose();
    _cancelNoteController.dispose();
    super.dispose();
  }

  InstallerAppState get _appState => InstallerStateScope.of(context);

  void _clearActivationCountdown() {
    _activationTimer?.cancel();
    if (!mounted) return;
    setState(() => _activationCountdown = 0);
  }

  void _startActivationCountdown([int seconds = 180]) {
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

  void _startRebootCountdown() {
    _rebootTimer?.cancel();
    setState(() => _rebootCountdown = 60);
    _rebootTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _rebootCountdown <= 1) {
        timer.cancel();
        if (mounted) {
          setState(() => _rebootCountdown = 0);
          _loadAll();
        }
        return;
      }
      setState(() => _rebootCountdown -= 1);
    });
  }

  void _scheduleDetailRefreshIfNeeded() {
    _detailRefreshTimer?.cancel();
    final status = (_detail?['status'] ?? '').toString();
    final configStatus =
        (_detail?['activation']?['configStatus'] ?? '').toString();
    final shouldPoll = status == 'activation_in_progress' ||
        configStatus == 'pending' ||
        configStatus == 'retried' ||
        configStatus == 'pushed';
    if (!shouldPoll) return;
    _detailRefreshTimer = Timer(const Duration(seconds: 3), () {
      if (!mounted || _busy) return;
      _loadAll(quiet: true);
    });
  }

  bool _isActivationLiveStatus(String status, String configStatus) {
    return status == 'active' || configStatus == 'verified';
  }

  bool _isConfigSuccessStatus(String configStatus) {
    return configStatus == 'pushed' || configStatus == 'verified';
  }

  bool _shouldShowActivationWait(String status, String configStatus) {
    return status == 'activation_in_progress' ||
        configStatus == 'pending' ||
        configStatus == 'retried';
  }

  void _syncActivationIndicators(Map<String, dynamic> detail) {
    final status = (detail['status'] ?? '').toString();
    final activation =
        (detail['activation'] as Map?)?.cast<String, dynamic>() ?? const {};
    final configStatus = (activation['configStatus'] ?? '').toString();
    if (_shouldShowActivationWait(status, configStatus)) {
      if (_activationCountdown <= 0) {
        _startActivationCountdown(180);
      }
      return;
    }
    if (_activationCountdown > 0) {
      _clearActivationCountdown();
    }
  }

  Future<void> _loadAll({bool quiet = false}) async {
    final session = _appState.session;
    if (session == null) return;
    if (!quiet) setState(() => _busy = true);
    try {
      final detail = await _appState.api.fetchJobDetail(session, widget.job.id);
      final diagnostics = await _appState.api
          .fetchDiagnostics(session, widget.job.id)
          .catchError((_) => <String, dynamic>{});
      ProvisioningPreview? previewModel;
      try {
        previewModel = await _appState.api
            .fetchProvisioningPreview(session, widget.job.id);
      } catch (_) {
        previewModel = null;
      }
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _diagnostics = diagnostics;
        _preview = previewModel == null
            ? null
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
        final serial = (detail['deviceContext']?['finalSerialNumber'] ??
                detail['deviceContext']?['manualSerialNumber'] ??
                '')
            .toString();
        if (serial.isNotEmpty && _serialController.text.trim().isEmpty) {
          _serialController.text = serial;
        }
        // Auto-suggest resolution code for complaints that haven't started yet
        final existingCode =
            (detail['complaint']?['resolutionCode'] ?? '').toString();
        if (existingCode.isEmpty &&
            widget.job.jobType.toLowerCase().contains('complaint')) {
          final health = widget.job.opticalHealth.toLowerCase();
          final rxNum = double.tryParse(widget.job.rxPowerText
                  .replaceAll(RegExp(r'[^0-9.\-]'), '')) ??
              0.0;
          if (health == 'critical' || rxNum < -27) {
            _complaintResolutionCode = 'low_power_fix';
          } else if (health == 'good' || health == 'warning') {
            _complaintResolutionCode = 'wifi_reconfig';
          } else {
            _complaintResolutionCode = 'port_reprovision';
          }
        }
      });
      _syncActivationIndicators(detail);
      _scheduleDetailRefreshIfNeeded();
    } catch (e) {
      if (!quiet) _show(e.toString());
    } finally {
      if (mounted && !quiet) {
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

  Future<void> _completeInstallationFlow() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      _show('Enter 6-digit OTP');
      return;
    }
    setState(() => _busy = true);
    try {
      await _appState.api
          .verifyCompletionOtp(_appState.session!, widget.job.id, otp);
      final result =
          await _appState.api.completeJob(_appState.session!, widget.job.id);
      await _appState.refresh();
      await _loadAll();
      if (!mounted) return;
      _show('Installation completed');
      await _showInstallCompletionSheet(result);
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _show(e.toString());
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _resolveComplaintFlow() async {
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      _show('Enter 6-digit OTP');
      return;
    }
    setState(() => _busy = true);
    try {
      await _appState.api
          .verifyComplaintOtp(_appState.session!, widget.job.id, otp);
      final result = await _appState.api
          .resolveComplaint(_appState.session!, widget.job.id);
      await _appState.refresh();
      await _loadAll();
      if (!mounted) return;
      _show('Complaint resolved');
      await _showComplaintResolutionSheet(result);
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      _show(e.toString());
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _showInstallCompletionSheet(Map<String, dynamic> result) async {
    final activationInvoice =
        (result['activationInvoice'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final customer = (result['customer'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final subscriberService =
        (result['subscriberService'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};

    // Pull credentials from preview/activation state
    final preview = _preview ?? const <String, dynamic>{};
    final activation =
        (_detail?['activation'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final prepared =
        (activation['preparedCredentials'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final preparedWifi =
        (prepared['wifi'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final preparedPppoe =
        (prepared['pppoe'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final wifiSsid24 = _firstNonBlankText([
      preview['wifi']?['ssid24'],
      activation['credentials']?['wifi']?['ssid24'],
      preparedWifi['ssid24'],
    ]);
    final wifiSsid5 = _firstNonBlankText([
      preview['wifi']?['ssid5'],
      activation['credentials']?['wifi']?['ssid5'],
      preparedWifi['ssid5'],
    ]);
    final wifiPassword = _firstNonBlankText([
      preview['wifi']?['password'],
      activation['credentials']?['wifi']?['password'],
      preparedWifi['password'],
    ]);
    final pppoeUsername = _firstNonBlankText([
      preview['pppoe']?['username'],
      activation['credentials']?['pppoeUsername'],
      preparedPppoe['username'],
      subscriberService['radiusUsername'],
    ]);
    final pppoePassword = _firstNonBlankText([
      preview['pppoe']?['password'],
      activation['credentials']?['pppoePassword'],
      preparedPppoe['password'],
    ]);
    final planName = _firstNonBlankText([
      preview['planName'],
      widget.job.planCode,
    ]);
    final planSpeed = widget.job.downloadSpeedMbps > 0
        ? '${widget.job.downloadSpeedMbps.toStringAsFixed(0)} Mbps'
        : (preview['speedMbps'] != null ? '${preview['speedMbps']} Mbps' : '-');
    final planPrice = widget.job.monthlyPrice > 0
        ? 'Rs ${widget.job.monthlyPrice.toStringAsFixed(0)}/mo'
        : (preview['monthlyPrice'] != null
            ? 'Rs ${preview['monthlyPrice']}/mo'
            : '-');
    final singleSsid = wifiSsid24 != '-' && wifiSsid24 == wifiSsid5;

    final handoverText = [
      if (singleSsid)
        'Wi-Fi: $wifiSsid24'
      else ...[
        'Wi-Fi 2.4G: $wifiSsid24',
        'Wi-Fi 5G: $wifiSsid5',
      ],
      'Wi-Fi password: $wifiPassword',
      'PPPoE user: $pppoeUsername',
      'PPPoE pass: $pppoePassword',
    ].join('\n');

    final fullSummary = [
      'Customer: ${customer['fullName'] ?? '-'}',
      'Customer ID: ${customer['customerId'] ?? '-'}',
      'Service ID: ${subscriberService['serviceId'] ?? customer['serviceId'] ?? '-'}',
      'ONT serial: ${subscriberService['ontSerialNumber'] ?? '-'}',
      if (singleSsid) 'Wi-Fi SSID: $wifiSsid24' else ...[
        'Wi-Fi 2.4G: $wifiSsid24',
        'Wi-Fi 5G: $wifiSsid5',
      ],
      'Wi-Fi password: $wifiPassword',
      'PPPoE user: $pppoeUsername',
      'PPPoE pass: $pppoePassword',
      'Plan: $planName',
      'Speed: $planSpeed',
      'Monthly: $planPrice',
      'Invoice: ${activationInvoice['invoiceNumber'] ?? activationInvoice['invoiceId'] ?? '-'}',
      'Invoice total: ${activationInvoice['totalAmount'] == null ? '-' : 'Rs ${activationInvoice['totalAmount']}'}',
    ].join('\n');

    final sheetPhone = (customer['phone']?.toString().isNotEmpty == true
            ? customer['phone']
            : widget.job.customerPhone)
        .toString();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: kSurface2,
      useSafeArea: true,
      builder: (context) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.92,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Handle
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: kBorder,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0x2210B981),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.check_circle_rounded,
                            color: Color(0xFF10B981), size: 26),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Installation complete',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(color: kText)),
                            const Text('Hand over credentials to customer',
                                style: TextStyle(color: kMuted, fontSize: 13)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Customer & Service
                  _checkoutSection('Customer & Service', [
                    _checkoutRow('Name', '${customer['fullName'] ?? '-'}'),
                    _checkoutRow('Customer ID',
                        '${customer['customerId'] ?? '-'}'),
                    _checkoutRow('Service ID',
                        '${subscriberService['serviceId'] ?? customer['serviceId'] ?? '-'}'),
                    _checkoutRow('ONT serial',
                        '${subscriberService['ontSerialNumber'] ?? '-'}'),
                    _checkoutRow('Radius user',
                        '${subscriberService['radiusUsername'] ?? pppoeUsername}'),
                  ]),
                  const SizedBox(height: 16),

                  // Wi-Fi credentials
                  _checkoutSection('Wi-Fi Credentials', [
                    if (singleSsid)
                      _checkoutRow('SSID', wifiSsid24)
                    else ...[
                      _checkoutRow('SSID 2.4G', wifiSsid24),
                      _checkoutRow('SSID 5G', wifiSsid5),
                    ],
                    _checkoutRow('Password', wifiPassword,
                        highlight: true),
                  ]),
                  const SizedBox(height: 16),

                  // PPPoE credentials
                  _checkoutSection('PPPoE Credentials', [
                    _checkoutRow('Username', pppoeUsername),
                    _checkoutRow('Password', pppoePassword, highlight: true),
                  ]),
                  const SizedBox(height: 16),

                  // Plan summary
                  _checkoutSection('Plan Summary', [
                    _checkoutRow('Plan', planName),
                    _checkoutRow('Speed', planSpeed),
                    _checkoutRow('Monthly', planPrice),
                  ]),
                  const SizedBox(height: 16),

                  // Invoice
                  _checkoutSection('Invoice', [
                    _checkoutRow('Status',
                        '${activationInvoice['status'] ?? '-'}'),
                    _checkoutRow('Number',
                        '${activationInvoice['invoiceNumber'] ?? activationInvoice['invoiceId'] ?? '-'}'),
                    _checkoutRow('Total',
                        activationInvoice['totalAmount'] == null
                            ? '-'
                            : 'Rs ${activationInvoice['totalAmount']}'),
                  ]),
                  const SizedBox(height: 24),

                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      FilledButton(
                        onPressed: () =>
                            _copyText('Handover pack copied', handoverText),
                        child: const Text('Copy handover'),
                      ),
                      if (sheetPhone.isNotEmpty)
                        FilledButton.icon(
                          style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF25D366)),
                          onPressed: () => _openUri(
                              'https://wa.me/91$sheetPhone?text=${Uri.encodeComponent(handoverText)}'),
                          icon: const Icon(Icons.chat_rounded, size: 16),
                          label: const Text('Send on WhatsApp'),
                        ),
                      OutlinedButton(
                        onPressed: () =>
                            _copyText('Full summary copied', fullSummary),
                        child: const Text('Copy full summary'),
                      ),
                      if ((activationInvoice['pdfUrl'] ?? '')
                          .toString()
                          .isNotEmpty)
                        OutlinedButton(
                          onPressed: () => _copyText(
                            'Invoice PDF link copied',
                            (activationInvoice['pdfUrl'] ?? '').toString(),
                          ),
                          child: const Text('Copy invoice link'),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981)),
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Done — job closed'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _checkoutSection(String title, List<Widget> rows) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  color: kMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2)),
          const SizedBox(height: 10),
          ...rows,
        ],
      ),
    );
  }

  Widget _checkoutRow(String label, String value, {bool highlight = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: const TextStyle(color: kMuted, fontSize: 13)),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: TextStyle(
                color: highlight ? kPrimaryLight : kText,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showComplaintResolutionSheet(
      Map<String, dynamic> result) async {
    final job = (result['job'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final complaint = (job['complaint'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final deviceContext =
        (job['deviceContext'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final subscriberService =
        (result['subscriberService'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final customerSnapshot =
        (job['customerSnapshot'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};

    final resolutionCode = (complaint['resolutionCode'] ?? '-').toString();
    final resolutionNote = (complaint['note'] ?? '-').toString();
    final replaced = complaint['replacedDevice'] == true;
    final oldSerial = (deviceContext['oldSerialNumber'] ?? '-').toString();
    final newSerial = (deviceContext['finalSerialNumber'] ?? '-').toString();
    final customerName =
        (customerSnapshot['fullName'] ?? widget.job.customerName).toString();
    final customerId = (job['customerId'] ?? '').toString();
    final serviceId = (job['serviceId'] ??
            subscriberService['serviceId'] ??
            '')
        .toString();
    final serviceStatus = (subscriberService['status'] ?? '-').toString();

    final complaintSummary = [
      'Customer: $customerName',
      if (customerId.isNotEmpty) 'Customer ID: $customerId',
      if (serviceId.isNotEmpty) 'Service ID: $serviceId',
      'Resolution: ${_complaintResolutionLabel(resolutionCode)}',
      'Note: $resolutionNote',
      'Device replaced: ${replaced ? 'Yes' : 'No'}',
      if (replaced) ...[
        'Old serial: $oldSerial',
        'New serial: $newSerial',
      ],
      'Service status: $serviceStatus',
    ].join('\n');

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: kSurface2,
      useSafeArea: true,
      builder: (context) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.7,
          minChildSize: 0.4,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 36,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: kBorder,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: kPrimary.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(Icons.build_circle_rounded,
                            color: kPrimaryLight, size: 26),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Complaint resolved',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleLarge
                                    ?.copyWith(color: kText)),
                            const Text('Confirm fix before leaving site',
                                style:
                                    TextStyle(color: kMuted, fontSize: 13)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  _checkoutSection('Customer & Service', [
                    _checkoutRow('Customer', customerName),
                    if (customerId.isNotEmpty)
                      _checkoutRow('Customer ID', customerId),
                    if (serviceId.isNotEmpty)
                      _checkoutRow('Service ID', serviceId),
                    _checkoutRow('Service status', serviceStatus),
                  ]),
                  const SizedBox(height: 16),

                  _checkoutSection('Resolution', [
                    _checkoutRow('Issue type',
                        _complaintResolutionLabel(resolutionCode)),
                    _checkoutRow('Field note', resolutionNote),
                    _checkoutRow(
                        'Device replaced', replaced ? 'Yes' : 'No'),
                  ]),

                  if (replaced) ...[
                    const SizedBox(height: 16),
                    _checkoutSection('Device Swap Audit', [
                      _checkoutRow('Old serial', oldSerial),
                      _checkoutRow('New serial', newSerial,
                          highlight: true),
                    ]),
                  ],
                  const SizedBox(height: 24),

                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      OutlinedButton(
                        onPressed: () => _copyText(
                            'Complaint summary copied', complaintSummary),
                        child: const Text('Copy summary'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                          backgroundColor: kPrimary),
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Done — complaint closed'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _showRequirementsSheet({
    required String title,
    required String subtitle,
    required List<String> items,
  }) async {
    if (items.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: kSurface2,
      builder: (context) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(color: kText),
              ),
              const SizedBox(height: 8),
              Text(
                subtitle,
                style: const TextStyle(color: kMuted, height: 1.45),
              ),
              const SizedBox(height: 16),
              ...items.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 2),
                        child: Icon(Icons.radio_button_checked_rounded,
                            size: 16, color: kPrimaryLight),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          item,
                          style: const TextStyle(color: kText, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Got it'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String _deferReasonLabel(String reason) {
    switch (reason) {
      case 'customer_unavailable':
        return 'Customer unavailable';
      case 'revisit_required':
        return 'Revisit required';
      case 'material_pending':
        return 'Material pending';
      case 'escalated':
        return 'Escalated to backend/admin';
      default:
        return 'Other follow-up';
    }
  }

  String _complaintResolutionLabel(String code) {
    switch (code) {
      case 'ont_replace':
        return 'ONT replacement';
      case 'fiber_patch':
        return 'Fiber patch';
      case 'low_power_fix':
        return 'Low power fix';
      case 'wifi_reconfig':
        return 'Wi-Fi reconfiguration';
      case 'port_reprovision':
        return 'Port reprovision';
      default:
        return code.isEmpty ? 'Pending selection' : code.replaceAll('_', ' ');
    }
  }

  String _shortDateTime(String value) {
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
    final hour =
        local.hour == 0 ? 12 : (local.hour > 12 ? local.hour - 12 : local.hour);
    final minute = local.minute.toString().padLeft(2, '0');
    final suffix = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day} $month, $hour:$minute $suffix';
  }

  String _visitUrgencyLabel(
      String status, String priority, String scheduledAt) {
    if (priority.toLowerCase() == 'critical') return 'Immediate';
    if (priority.toLowerCase() == 'high') return 'Priority';
    if (status == 'deferred') return 'Revisit pending';
    if (scheduledAt.isEmpty) return 'Queue ready';
    final scheduled = DateTime.tryParse(scheduledAt)?.toLocal();
    if (scheduled == null) return 'Queue ready';
    final minutes = scheduled.difference(DateTime.now()).inMinutes;
    if (minutes <= 0) return 'Due now';
    if (minutes <= 30) return 'Due soon';
    return 'Planned';
  }

  String _timeWindowLabel(String scheduledAt) {
    if (scheduledAt.isEmpty) return '-';
    final scheduled = DateTime.tryParse(scheduledAt)?.toLocal();
    if (scheduled == null) return '-';
    final minutes = scheduled.difference(DateTime.now()).inMinutes;
    if (minutes.abs() < 1) return 'Now';
    if (minutes < 0) return '${minutes.abs()} min late';
    return 'In $minutes min';
  }

  String _otpPurposeLabel(String purpose) {
    switch (purpose) {
      case 'complaint_complete':
        return 'Complaint closure';
      case 'installation_complete':
        return 'Installation completion';
      default:
        return purpose.isEmpty ? '-' : purpose.replaceAll('_', ' ');
    }
  }

  Future<void> _showDeferJobSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: kSurface2,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                  20, 20, 20, 24 + MediaQuery.of(context).viewInsets.bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Mark follow-up required',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(color: kText),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use this when the visit cannot be completed right now. The job will stay open for follow-up and your availability will be released.',
                    style: TextStyle(color: kMuted, height: 1.45),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: _deferReason,
                    items: _deferReasons
                        .map((reason) => DropdownMenuItem<String>(
                              value: reason,
                              child: Text(_deferReasonLabel(reason)),
                            ))
                        .toList(),
                    onChanged: _busy
                        ? null
                        : (value) {
                            if (value == null) return;
                            setSheetState(() => _deferReason = value);
                            setState(() => _deferReason = value);
                          },
                    decoration:
                        const InputDecoration(labelText: 'Follow-up reason'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _deferNoteController,
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Field note',
                      hintText:
                          'Explain what blocked completion and what should happen next.',
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _busy
                          ? null
                          : () async {
                              final note = _deferNoteController.text.trim();
                              if (note.length < 3) {
                                _show('Add a short field note');
                                return;
                              }
                              Navigator.of(context).pop();
                              final ok = await _run(
                                () => _appState.api.deferJob(
                                  _appState.session!,
                                  widget.job.id,
                                  reason: _deferReason,
                                  note: note,
                                ),
                                '${widget.job.jobType == 'complaint' ? 'Complaint' : 'Installation'} marked for follow-up',
                              );
                              if (ok && mounted) {
                                Navigator.of(this.context).pop(true);
                              }
                            },
                      child: const Text('Save follow-up'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  String _cancelReasonLabel(String reason) {
    switch (reason) {
      case 'customer_cancelled':
        return 'Customer cancelled';
      case 'technical_feasibility_failed':
        return 'Technical feasibility failed';
      case 'payment_issue':
        return 'Payment issue';
      case 'material_unavailable':
        return 'Material unavailable';
      case 'duplicate_booking':
        return 'Duplicate booking';
      default:
        return 'Other cancellation';
    }
  }

  Future<void> _showCancelInstallationSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: kSurface2,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                  20, 20, 20, 24 + MediaQuery.of(context).viewInsets.bottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Cancel installation job',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(color: kText),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Use this only when the installation should not continue. Admin can review the cancelled booking and process refund handling separately.',
                    style: TextStyle(color: kMuted, height: 1.45),
                  ),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    initialValue: _cancelReason,
                    items: _cancelReasons
                        .map((reason) => DropdownMenuItem<String>(
                              value: reason,
                              child: Text(_cancelReasonLabel(reason)),
                            ))
                        .toList(),
                    onChanged: _busy
                        ? null
                        : (value) {
                            if (value == null) return;
                            setSheetState(() => _cancelReason = value);
                            setState(() => _cancelReason = value);
                          },
                    decoration:
                        const InputDecoration(labelText: 'Cancellation reason'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _cancelNoteController,
                    minLines: 3,
                    maxLines: 5,
                    decoration: const InputDecoration(
                      labelText: 'Cancellation note',
                      hintText:
                          'Explain why the installation was cancelled and what admin should review for refund.',
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _busy
                          ? null
                          : () async {
                              final note = _cancelNoteController.text.trim();
                              if (note.length < 3) {
                                _show('Add a short cancellation note');
                                return;
                              }
                              Navigator.of(context).pop();
                              final ok = await _run(
                                () => _appState.api.cancelInstallation(
                                  _appState.session!,
                                  widget.job.id,
                                  reason: _cancelReason,
                                  note: note,
                                ),
                                'Installation cancelled',
                              );
                              if (ok && mounted) {
                                Navigator.of(this.context).pop(true);
                              }
                            },
                      child: const Text('Cancel installation'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _refreshPreviewAndDiagnostics(
      {String successMessage = 'ONT details refreshed'}) async {
    final session = _appState.session;
    if (session == null) return;
    setState(() => _busy = true);
    try {
      final serial = _serialController.text.trim();
      final savedSerial = (_detail?['deviceContext']?['finalSerialNumber'] ??
              _detail?['deviceContext']?['manualSerialNumber'] ??
              '')
          .toString()
          .trim();
      if (serial.isNotEmpty && serial != savedSerial) {
        await _appState.api.setManualSerial(session, widget.job.id, serial);
      }
      await _loadAll();
      if (!mounted) return;
      _show(successMessage);
    } catch (e) {
      final conflict = _extractSerialConflictMessage(
        e.toString(),
        attemptedSerial: _serialController.text.trim(),
      );
      if (conflict != null) {
        setState(() => _serialConflictError = conflict);
        await _showSerialConflictDialog(conflict);
      } else {
        _show(e.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  String? _extractSerialConflictMessage(String raw,
      {required String attemptedSerial}) {
    final lower = raw.toLowerCase();
    final isConflict = lower.contains('409') ||
        lower.contains('bound') ||
        lower.contains('linked to') ||
        lower.contains('another customer') ||
        lower.contains('already');
    if (!isConflict) return null;

    var conflict =
        'Serial ${attemptedSerial.isEmpty ? 'selected router' : attemptedSerial} is already linked to another customer. Please use a different ONT router.';
    final nameMatch =
        RegExp(r'linked to (.+?)\. Use', caseSensitive: false).firstMatch(raw);
    if (nameMatch != null) {
      conflict =
          'This router is already linked to ${nameMatch.group(1)}. Please use a different ONT.';
    }
    return conflict;
  }

  Future<void> _showSerialConflictDialog(String conflict) async {
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Router Already Linked'),
        content: Text(conflict),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  void _show(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
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
    bool refreshOntDetails = false,
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
      _serialConflictError = null;
      controller.text = scanned.trim();
    });
    if (refreshOntDetails) {
      await _refreshPreviewAndDiagnostics(
          successMessage: 'ONT details refreshed');
      return;
    }
    _show('Serial scanned: ${scanned.trim()}');
  }

  Future<void> _captureProofPhoto({required bool routerPhoto}) async {
    try {
      final file = await _imagePicker.pickImage(
        source: ImageSource.camera,
        imageQuality: 50,
        maxWidth: 1280,
        maxHeight: 1280,
      );
      if (!mounted || file == null) return;
      setState(() {
        if (routerPhoto) {
          _routerPhotoCapturedAt = DateTime.now();
          _routerPhotoPath = file.path;
        } else {
          _cablePhotoCapturedAt = DateTime.now();
          _cablePhotoPath = file.path;
        }
      });
      _show(routerPhoto ? 'Router photo captured' : 'Cable photo captured');
    } catch (e) {
      _show('Unable to open camera right now');
    }
  }

  bool _hasCapturedProofPhotos() {
    final hasRouter = (_routerPhotoPath ?? '').trim().isNotEmpty;
    final hasCable = (_cablePhotoPath ?? '').trim().isNotEmpty;
    return hasRouter && hasCable;
  }

  Future<void> _submitCapturedProof() async {
    if (!_hasCapturedProofPhotos()) {
      await _showRequirementsSheet(
        title: 'Proof capture pending',
        subtitle:
            'Before proof submission, capture both required field photos.',
        items: const [
          'Capture the router photo from the customer site.',
          'Capture the cable/photo link proof from the customer site.',
        ],
      );
      return;
    }

    final routerBytes = await File(_routerPhotoPath!).readAsBytes();
    final cableBytes = await File(_cablePhotoPath!).readAsBytes();
    final routerB64 = 'data:image/jpeg;base64,${base64Encode(routerBytes)}';
    final cableB64 = 'data:image/jpeg;base64,${base64Encode(cableBytes)}';
    await _run(
      () => _appState.api.uploadProof(
        _appState.session!,
        widget.job.id,
        routerPhotoUrl: routerB64,
        cablePhotoUrl: cableB64,
      ),
      'Installation proof submitted',
    );
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

  String _resolveOpticalValue(
    Map<String, dynamic> optical,
    Map<String, dynamic> diagnostics,
    Map<String, dynamic> device,
    List<String> keys, {
    String fallback = '-',
  }) {
    final diagnosticOptical =
        (diagnostics['optical'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final deviceOptical =
        (device['opticalInfo'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};

    for (final key in keys) {
      // 1. job.opticalReadings (stored on job document)
      final direct = optical[key];
      if (direct != null && direct.toString().trim().isNotEmpty &&
          direct.toString().trim() != 'null') {
        return direct.toString();
      }
      // 2. diagnostics.optical (buildOpticalSnapshot result)
      final diagnosticValue = diagnosticOptical[key];
      if (diagnosticValue != null &&
          diagnosticValue.toString().trim().isNotEmpty &&
          diagnosticValue.toString().trim() != 'null') {
        return diagnosticValue.toString();
      }
      // 3. device.opticalInfo (raw cache opticalInfo sub-object)
      final deviceOpticalValue = deviceOptical[key];
      if (deviceOpticalValue != null &&
          deviceOpticalValue.toString().trim().isNotEmpty &&
          deviceOpticalValue.toString().trim() != 'null') {
        return deviceOpticalValue.toString();
      }
      // 4. device root (some brands expose rxPower directly on device object)
      final deviceRoot = device[key];
      if (deviceRoot != null &&
          deviceRoot.toString().trim().isNotEmpty &&
          deviceRoot.toString().trim() != 'null') {
        return deviceRoot.toString();
      }
    }

    return fallback;
  }

  @override
  Widget build(BuildContext context) {
    return _buildWizardNew();
    // ignore: dead_code
    final theme = Theme.of(context);
    final detail = _detail;
    final snapshot =
        (detail?['customerSnapshot'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final activation =
        (detail?['activation'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final complaint = (detail?['complaint'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final complaintRuntime =
        (complaint['runtime'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final deviceContext =
        (detail?['deviceContext'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final proof = (detail?['proof'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final otpState = (detail?['otp'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final optical =
        (detail?['opticalReadings'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final preview = _preview ?? const <String, dynamic>{};
    final diagnostics = _diagnostics ?? const <String, dynamic>{};
    final checklist =
        (diagnostics['checklist'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final recommendations = (diagnostics['recommendations'] as List?)
            ?.map((item) => item.toString())
            .where((item) => item.isNotEmpty)
            .toList() ??
        const <String>[];
    final customerName =
        (snapshot['fullName'] ?? widget.job.customerName).toString();
    final customerAddress =
        (snapshot['address'] ?? widget.job.customerAddress).toString();
    final customerId = (detail?['customerId'] ?? '').toString();
    final serviceId = (detail?['serviceId'] ?? '').toString();
    final phone = (snapshot['phone']?.toString().isNotEmpty == true
            ? snapshot['phone']
            : widget.job.customerPhone)
        .toString();
    final scheduledAt =
        (detail?['scheduledAt'] ?? widget.job.scheduledAt).toString();
    final priority = (detail?['priority'] ?? widget.job.priority).toString();
    final status = (detail?['status'] ?? widget.job.status).toString();
    final isComplaint =
        (detail?['type'] ?? widget.job.jobType).toString() == 'complaint';
    final configStatus = (activation['configStatus'] ?? '-').toString();
    final resumeStage = (activation['resumeStage'] ?? '').toString();
    final activationRuntime =
        (activation['runtime'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final effectiveResumeStage = _firstNonBlankText([
      activationRuntime['resumeStage'],
      resumeStage,
    ]);
    final wifi = (preview['wifi'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final pppoe = (preview['pppoe'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final prepared =
        (activation['preparedCredentials'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final preparedWifi = (prepared['wifi'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final preparedPppoe =
        (prepared['pppoe'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
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
    final planCode = widget.job.planCode.isEmpty
        ? (preview['planCode'] ?? '').toString()
        : widget.job.planCode;
    final planCategory = widget.job.planCategory.isEmpty
        ? (preview['planCategory'] ?? 'home').toString()
        : widget.job.planCategory;
    final planPrice = widget.job.monthlyPrice > 0
        ? widget.job.monthlyPrice
        : double.tryParse('${preview['monthlyPrice'] ?? 0}') ?? 0;
    final planDownload = widget.job.downloadSpeedMbps > 0
        ? widget.job.downloadSpeedMbps
        : double.tryParse('${preview['speedMbps'] ?? 0}') ?? 0;
    final planUpload = widget.job.uploadSpeedMbps > 0
        ? widget.job.uploadSpeedMbps
        : double.tryParse('${preview['uploadSpeedMbps'] ?? 0}') ?? 0;
    final planDataLimit = widget.job.dataLimitGb > 0
        ? widget.job.dataLimitGb
        : double.tryParse('${preview['dataLimitGb'] ?? 0}') ?? 0;
    final planFupSpeed = widget.job.fupSpeedMbps > 0
        ? widget.job.fupSpeedMbps
        : double.tryParse('${preview['fupSpeedMbps'] ?? 0}') ?? 0;
    final planDataPolicy = widget.job.dataPolicy.isNotEmpty
        ? widget.job.dataPolicy
        : (preview['dataPolicy'] ?? 'unlimited').toString();
    final planOtc = widget.job.otcCharge > 0
        ? widget.job.otcCharge
        : double.tryParse('${preview['otcCharge'] ?? 0}') ?? 0;
    final planInstall = widget.job.installationCharge > 0
        ? widget.job.installationCharge
        : double.tryParse('${preview['installationCharge'] ?? 0}') ?? 0;
    final device = (diagnostics['device'] as Map?)?.cast<String, dynamic>() ??
        const <String, dynamic>{};
    final rxPowerText = _resolveOpticalValue(
      optical,
      diagnostics,
      device,
      const [
        'rxPower',
        'opticalRxPower',
        'receivedPower',
        'ontRxPower',
        'oltRxPower',
        'rx',
      ],
    );
    final txPowerText = _resolveOpticalValue(
      optical,
      diagnostics,
      device,
      const [
        'txPower',
        'opticalTxPower',
        'transmitPower',
        'ontTxPower',
        'oltTxPower',
        'tx',
      ],
    );
    final opticalHealthText = _resolveOpticalValue(
      optical,
      diagnostics,
      device,
      const ['healthStatus', 'opticalHealth', 'status'],
      fallback: 'unknown',
    );
    final linkedSerial =
        (device['serialNumber'] ?? deviceContext['finalSerialNumber'] ?? '')
            .toString();
    final linkedDeviceId =
        (device['deviceId'] ?? deviceContext['finalDeviceId'] ?? '').toString();
    final linkedProductClass = (device['productClass'] ?? '').toString();
    final onsiteLocation =
        (deviceContext['onsiteLocation'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final onsiteAddress = (onsiteLocation['address'] ?? '').toString();
    final onsiteCheckedInAt = (onsiteLocation['checkedInAt'] ?? '').toString();
    final deferReason =
        (deviceContext['deferReason'] ?? detail?['subStatus'] ?? '').toString();
    final deferNote = (deviceContext['deferNote'] ?? '').toString();
    final cancelReason =
        (deviceContext['cancelReason'] ?? detail?['subStatus'] ?? '')
            .toString();
    final cancelNote = (deviceContext['cancelNote'] ?? '').toString();
    final activationLive = _isActivationLiveStatus(status, configStatus);
    final configSuccessful = _isConfigSuccessStatus(configStatus);
    final handoverPack = <String>[
      if (customerName.isNotEmpty) 'Customer: $customerName',
      if (singleWifiName)
        'Wi-Fi SSID: $wifiSsid24'
      else ...[
        'Wi-Fi 2.4G: $wifiSsid24',
        'Wi-Fi 5G: $wifiSsid5',
      ],
      'Wi-Fi password: $wifiPassword',
      'PPPoE user: $pppoeUsername',
      'PPPoE password: $pppoePassword',
      'Internet status: ${activationLive ? 'Active' : 'Pending'}',
    ].join('\n');
    final customerVisitPack = <String>[
      if (customerName.isNotEmpty) 'Customer: $customerName',
      if (phone.isNotEmpty) 'Phone: $phone',
      if (customerAddress.isNotEmpty) 'Address: $customerAddress',
    ].join('\n');
    final jobRefsPack = <String>[
      'Job number: ${widget.job.jobNumber}',
      if (customerId.isNotEmpty) 'Customer ID: $customerId',
      if (serviceId.isNotEmpty) 'Service ID: $serviceId',
    ].join('\n');
    final deviceRefsPack = <String>[
      if (linkedSerial.isNotEmpty) 'Serial: $linkedSerial',
      if (linkedDeviceId.isNotEmpty) 'Device ID: $linkedDeviceId',
      if (linkedProductClass.isNotEmpty) 'Model: $linkedProductClass',
    ].join('\n');
    final diagnosticsPack = <String>[
      'RX power: $rxPowerText',
      'TX power: $txPowerText',
      'Health: $opticalHealthText',
      'Router serial: ${device['serialNumber'] ?? deviceContext['finalSerialNumber'] ?? '-'}',
      'Device ID: ${linkedDeviceId.isEmpty ? '-' : linkedDeviceId}',
      'Model: ${linkedProductClass.isEmpty ? '-' : linkedProductClass}',
      'Router online: ${device['onlineStatus'] ?? 'unknown'}',
      'Provisioning state: ${device['provisioningState'] ?? 'pending'}',
    ].join('\n');
    final visitUrgency = _visitUrgencyLabel(status, priority, scheduledAt);
    final visitTimeWindow = _timeWindowLabel(scheduledAt);
    final complaintResolution =
        (complaint['resolutionCode'] ?? _complaintResolutionCode).toString();
    final complaintRuntimeStageLabel =
        (complaintRuntime['stageLabel'] ?? '').toString().trim();
    final complaintRuntimeOperatorMessage =
        (complaintRuntime['operatorMessage'] ?? '').toString().trim();
    final complaintRuntimeFailureCode =
        (complaintRuntime['failureCode'] ?? '').toString().trim();
    final complaintRuntimeRecommendedActions =
        (complaintRuntime['recommendedActions'] as List?)
                ?.map((item) => item.toString().trim())
                .where((item) => item.isNotEmpty)
                .toList() ??
            const <String>[];
    final lastRebootAt =
        (deviceContext['lastComplaintRebootAt'] ?? '').toString();
    final oldSerial = (deviceContext['oldSerialNumber'] ?? '').toString();
    final newSerial = (deviceContext['finalSerialNumber'] ?? '').toString();
    final proofUploadedAt = (proof['uploadedAt'] ?? '').toString();
    final proofSummaryPack = <String>[
      'Router photo: ${_routerPhotoPath == null ? 'Pending capture' : 'Captured'}',
      'Cable photo: ${_cablePhotoPath == null ? 'Pending capture' : 'Captured'}',
      'Proof uploaded: ${proofUploadedAt.isEmpty ? '-' : _shortDateTime(proofUploadedAt)}',
      if (_routerPhotoCapturedAt != null)
        'Router captured: ${_shortDateTime(_routerPhotoCapturedAt!.toIso8601String())}',
      if (_cablePhotoCapturedAt != null)
        'Cable captured: ${_shortDateTime(_cablePhotoCapturedAt!.toIso8601String())}',
    ].join('\n');
    final checklistSavedAt = (checklist['savedAt'] ?? '').toString();
    final checklistSaved = checklist.isNotEmpty;
    final otpPurpose = (otpState['purpose'] ?? '').toString();
    final otpExpiresAt = (otpState['expiresAt'] ?? '').toString();
    final otpVerifiedAt = (otpState['verifiedAt'] ?? '').toString();
    final complaintSummaryPack = <String>[
      'Resolution code: ${_complaintResolutionLabel(complaintResolution)}',
      'Complaint note: ${complaint['note'] ?? _complaintNoteController.text.trim()}',
      'Old serial: ${oldSerial.isEmpty ? '-' : oldSerial}',
      'New serial: ${newSerial.isEmpty ? '-' : newSerial}',
      'OTP purpose: ${_otpPurposeLabel(otpPurpose)}',
      'OTP verified: ${otpVerifiedAt.isEmpty ? '-' : _shortDateTime(otpVerifiedAt)}',
    ].join('\n');
    final proofUploaded = proof.isNotEmpty;
    final canAccept = _canAccept(status);
    final canStartTravel = _canStartTravel(status);
    final canStartOnsite = _canStartOnsite(status);
    final canActivate = _canActivate(status);
    final canRetry = _canRetry(status, configStatus);
    final canStartComplaint = _canStartComplaint(status);
    final canReplaceOnt = _canReplaceOnt(status);
    final canRebootComplaint = _canRebootComplaint(status, otpPurpose);
    final canSendComplaintOtp = _canSendComplaintOtp(status);
    final canResolveComplaint =
        _canResolveComplaint(status, _otpController.text.trim());
    final activationBlockers = _activationBlockers(
      status: status,
      serial: _serialController.text.trim(),
      pppoeUsername: pppoeUsername,
      wifiSsid24: wifiSsid24,
      wifiPassword: wifiPassword,
    );
    final canRunActivation = canActivate && activationBlockers.isEmpty;
    final canSubmitProof =
        _canSubmitProof(status, _hasCapturedProofPhotos(), activationLive);
    final canSendInstallOtp = _canSendInstallOtp(status, proofUploaded);
    final canCompleteInstall = _canCompleteInstall(
      status,
      _otpController.text.trim(),
      proofUploaded,
      activationLive,
    );
    return Scaffold(
      backgroundColor: kBg,
      body: RefreshIndicator(
        color: kPrimaryLight,
        backgroundColor: kSurface,
        onRefresh: _loadAll,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
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
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 8, 16, 0),
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                              onPressed: () => Navigator.of(context).pop(),
                            ),
                            Expanded(
                              child: Text(widget.job.jobNumber,
                                style: GoogleFonts.inter(color: Colors.white60, fontSize: 13, fontWeight: FontWeight.w600)),
                            ),
                            if (_busy)
                              const SizedBox(width: 18, height: 18,
                                child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white54)),
                            IconButton(
                              icon: const Icon(Icons.refresh_rounded, color: Colors.white54, size: 20),
                              onPressed: _busy ? null : _loadAll,
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                        child: Wrap(
                          spacing: 8,
                          children: [
                            _headerBadge(isComplaint ? 'COMPLAINT' : 'INSTALLATION', Colors.white.withValues(alpha: 0.18)),
                            _headerBadge(status.replaceAll('_', ' ').toUpperCase(), _statusBadgeColor(status)),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Text(customerName,
                          style: GoogleFonts.inter(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.4)),
                      ),
                      if (phone.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Text('+91 $phone',
                            style: GoogleFonts.inter(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
                        ),
                      ],
                      if (customerAddress.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Text(customerAddress, maxLines: 2, overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.inter(color: Colors.white60, fontSize: 12, height: 1.4)),
                        ),
                      ],
                      const SizedBox(height: 14),
                    ],
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 100),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  Row(
                    children: [
                      if (phone.isNotEmpty) ...[
                        Expanded(child: _quickActionBtn(icon: Icons.call_rounded, label: 'Call', color: const Color(0xFF10B981), onTap: () => _openUri('tel:$phone'))),
                        const SizedBox(width: 10),
                        Expanded(child: _quickActionBtn(
                          icon: Icons.chat_rounded, label: 'WhatsApp', color: const Color(0xFF25D366),
                          onTap: () => _openUri('https://wa.me/91$phone?text=${Uri.encodeComponent('Hello! I am from JustFiber and will be arriving for your ${isComplaint ? 'complaint resolution' : 'installation'} shortly.')}'),
                        )),
                        const SizedBox(width: 10),
                      ],
                      Expanded(child: _quickActionBtn(
                        icon: Icons.map_rounded, label: 'Map', color: const Color(0xFF0EA5E9),
                        onTap: () => _openUri(widget.job.mapUrl.isNotEmpty ? widget.job.mapUrl : 'https://maps.google.com/?q=${widget.job.latitude ?? 0},${widget.job.longitude ?? 0}'),
                      )),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _nextActionCard(
                    context,
                    status: status,
                    configStatus: configStatus,
                    resumeStage: effectiveResumeStage,
                    activationRuntime: activationRuntime,
                    complaintRuntime: complaintRuntime,
                    isComplaint: isComplaint,
                    activationLive: activationLive,
                    canAccept: canAccept,
                    canStartTravel: canStartTravel,
                    canStartOnsite: canStartOnsite,
                    canActivate: canRunActivation,
                    canRetry: canRetry,
                    canStartComplaint: canStartComplaint,
                    canReplaceOnt: canReplaceOnt,
                    canRebootComplaint: canRebootComplaint,
                    canSendComplaintOtp: canSendComplaintOtp,
                    canResolveComplaint: canResolveComplaint,
                    canSubmitProof: canSubmitProof,
                    canSendInstallOtp: canSendInstallOtp,
                    canCompleteInstall: canCompleteInstall,
                    proofUploaded: proofUploaded,
                  ),
                  const SizedBox(height: 16),
                  AppCard(
                    color: kSurface,
                    borderColor: kBorder,
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
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: kBorder),
                            ),
                            child: Icon(
                              isComplaint
                                  ? Icons.build_circle_outlined
                                  : Icons.router_rounded,
                              color: kPrimaryLight,
                              size: 28,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 8,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: kPrimary.withValues(alpha: 0.18),
                                        borderRadius:
                                            BorderRadius.circular(999),
                                      ),
                                      child: Text(
                                        isComplaint
                                            ? 'COMPLAINT JOB'
                                            : 'INSTALLATION JOB',
                                        style: theme.textTheme.labelSmall
                                            ?.copyWith(
                                          color: kPrimaryLight,
                                          letterSpacing: 1.8,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: kSurface2,
                                        borderRadius:
                                            BorderRadius.circular(999),
                                        border: Border.all(
                                            color: const Color(0x1F334155)),
                                      ),
                                      child: Text(
                                        status.replaceAll('_', ' '),
                                        style: const TextStyle(
                                          color: kText,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  customerName,
                                  style:
                                      theme.textTheme.headlineSmall?.copyWith(
                                    color: kText,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  customerAddress,
                                  style: const TextStyle(
                                      color: kMuted, height: 1.45),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          SizedBox(
                            width: 160,
                            child: _chip('Phone', phone.isEmpty ? '-' : phone),
                          ),
                          SizedBox(
                            width: 160,
                            child: _chip('Visit timing', visitUrgency),
                          ),
                          if (scheduledAt.isNotEmpty)
                            SizedBox(
                              width: 190,
                              child: _chip(
                                  'Scheduled', _shortDateTime(scheduledAt)),
                            ),
                        ],
                      ),
                      if (scheduledAt.isNotEmpty && visitTimeWindow != '-') ...[
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            SizedBox(
                              width: 160,
                              child: _chip('Window', visitTimeWindow),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          OutlinedButton.icon(
                            onPressed: () => _copyText(
                              'Job references copied',
                              jobRefsPack,
                            ),
                            icon: const Icon(Icons.tag_outlined, size: 18),
                            label: const Text('Copy refs'),
                          ),
                          OutlinedButton.icon(
                            onPressed: customerVisitPack.isEmpty
                                ? null
                                : () => _copyText(
                                      'Customer visit details copied',
                                      customerVisitPack,
                                    ),
                            icon: const Icon(Icons.badge_outlined, size: 18),
                            label: const Text('Copy customer'),
                          ),
                          if (widget.job.mapUrl.isNotEmpty ||
                              (widget.job.latitude != null &&
                                  widget.job.longitude != null))
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
                              onPressed: () => _openUri('tel:$phone',
                                  fallback: 'Call action not available'),
                              icon: const Icon(Icons.call_outlined, size: 18),
                              label: const Text('Call customer'),
                            ),
                          if (customerAddress.isNotEmpty)
                            OutlinedButton.icon(
                              onPressed: () => _copyText(
                                'Customer address copied',
                                customerAddress,
                              ),
                              icon: const Icon(Icons.content_copy_outlined,
                                  size: 18),
                              label: const Text('Copy address'),
                            ),
                          if (!isComplaint && _canCancelInstall(status))
                            OutlinedButton.icon(
                              onPressed:
                                  _busy ? null : _showCancelInstallationSheet,
                              icon: const Icon(Icons.cancel_outlined, size: 18),
                              label: const Text('Cancel installation'),
                            ),
                        ],
                      ),
                      if (onsiteAddress.isNotEmpty ||
                          onsiteCheckedInAt.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0x2210B981),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFBBF7D0)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Onsite check-in',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: const Color(0xFF166534),
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 10),
                              _row(
                                  'Checked in',
                                  onsiteCheckedInAt.isEmpty
                                      ? '-'
                                      : _shortDateTime(onsiteCheckedInAt)),
                              _row('Location',
                                  onsiteAddress.isEmpty ? '-' : onsiteAddress),
                            ],
                          ),
                        ),
                      ],
                      if (status == 'deferred' ||
                          deferReason.isNotEmpty ||
                          deferNote.isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0x22F59E0B),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0x66F59E0B)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Follow-up status',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: const Color(0xFF92400E),
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 10),
                              _row('Reason', _deferReasonLabel(deferReason)),
                              _row('Field note',
                                  deferNote.isEmpty ? '-' : deferNote),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: [
                                  if (status == 'deferred')
                                    FilledButton(
                                      onPressed: _busy
                                          ? null
                                          : () => _run(
                                                () => _appState.api
                                                    .resumeFollowUp(
                                                        _appState.session!,
                                                        widget.job.id),
                                                'Follow-up resumed',
                                              ),
                                      child: const Text('Resume revisit'),
                                    ),
                                  OutlinedButton(
                                    onPressed:
                                        _busy ? null : _showDeferJobSheet,
                                    child: const Text('Update follow-up note'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                      if (!isComplaint &&
                          (status == 'cancelled' ||
                              cancelReason.isNotEmpty ||
                              cancelNote.isNotEmpty)) ...[
                        const SizedBox(height: 16),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0x22EF4444),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0x66EF4444)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Cancellation status',
                                style: theme.textTheme.titleMedium?.copyWith(
                                  color: const Color(0xFFB91C1C),
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 10),
                              _row(
                                  'Reason',
                                  cancelReason.isEmpty
                                      ? '-'
                                      : _cancelReasonLabel(cancelReason)),
                              _row('Field note',
                                  cancelNote.isEmpty ? '-' : cancelNote),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                AppCard(
                  color: kSurface,
                  borderColor: const Color(0x228224E3),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Technical panels',
                          style: theme.textTheme.titleLarge),
                      const SizedBox(height: 8),
                      const Text(
                        'Open this only when you need diagnostics, raw timeline, or the full field control set.',
                        style: TextStyle(color: kMuted, height: 1.45),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton(
                        onPressed: () => setState(
                            () => _showAdvancedPanels = !_showAdvancedPanels),
                        child: Text(_showAdvancedPanels
                            ? 'Hide advanced panels'
                            : 'Show advanced panels'),
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
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border:
                                  Border.all(color: const Color(0x558224E3)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.router_rounded,
                                    color: kPrimaryLight),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Router linked: $linkedSerial',
                                    style: const TextStyle(
                                        color: kText,
                                        fontWeight: FontWeight.w800),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],
                        TextField(
                          controller: _serialController,
                          onChanged: (_) => setState(() {}),
                          decoration: const InputDecoration(
                              labelText: 'ONT serial number'),
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
                                        subtitle:
                                            'Scan the router barcode or QR code to auto-fill the ONT serial before activation.',
                                        refreshOntDetails: true,
                                      ),
                              child: const Text('Scan barcode'),
                            ),
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () => _refreshPreviewAndDiagnostics(
                                      successMessage: 'Preview refreshed'),
                              child: const Text('Load preview'),
                            ),
                            OutlinedButton(
                              onPressed: _busy
                                  ? null
                                  : () => _refreshPreviewAndDiagnostics(
                                      successMessage: 'Diagnostics refreshed'),
                              child: const Text('Diagnostics'),
                            ),
                            FilledButton(
                              onPressed: _busy || !canActivate
                                  ? null
                                  : () {
                                      final serial =
                                          _serialController.text.trim();
                                      if (serial.isEmpty) {
                                        _show('Enter ONT serial first');
                                        return;
                                      }
                                      _startActivationCountdown(180);
                                      _run(
                                          () => _appState.runActivationFlow(
                                              widget.job.id, serial),
                                          'Activation requested');
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
                                            note:
                                                'Retry from installer app after partial or failed activation',
                                          ),
                                          'Resume requested',
                                        ),
                                child: Text(_resumeActivationLabel(status)),
                              ),
                            if (_canRepushConfig(status))
                              OutlinedButton.icon(
                                onPressed: _busy
                                    ? null
                                    : () {
                                        final s = _serialController.text.trim();
                                        if (s.isEmpty) {
                                          _show('Enter ONT serial first');
                                          return;
                                        }
                                        _startActivationCountdown(180);
                                        _run(
                                            () => _appState.runActivationFlow(
                                                widget.job.id, s),
                                            'Config re-pushed');
                                      },
                                icon: const Icon(Icons.send_rounded, size: 14),
                                label: const Text('Re-push Config'),
                              ),
                          ],
                        ),
                        if (_activationCountdown > 0) ...[
                          const SizedBox(height: 14),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border:
                                  Border.all(color: const Color(0x338224E3)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Configuring router',
                                  style: theme.textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Applying Wi-Fi, waiting for router confirmation, and then pushing PPPoE. Approx time left: ${_activationCountdown}s',
                                  style: const TextStyle(
                                      color: kMuted, height: 1.45),
                                ),
                                const SizedBox(height: 12),
                                LinearProgressIndicator(
                                  value: (180 - _activationCountdown) / 180,
                                  minHeight: 8,
                                  backgroundColor: kBg,
                                  valueColor:
                                      const AlwaysStoppedAnimation(kPrimaryLight),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (configSuccessful && !activationLive) ...[
                          const SizedBox(height: 14),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border:
                                  Border.all(color: const Color(0x5560A5FA)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.router_rounded,
                                    color: Color(0xFF60A5FA)),
                                SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Config successful. Router config is pushed. Waiting for internet live confirmation.',
                                    style: TextStyle(
                                        color: kText,
                                        height: 1.4,
                                        fontWeight: FontWeight.w700),
                                  ),
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
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border:
                                  Border.all(color: const Color(0x558224E3)),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.check_circle_rounded,
                                    color: kPrimaryLight),
                                SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Internet live. Customer notification should be triggered from backend activation flow.',
                                    style: TextStyle(
                                        color: kText,
                                        height: 1.4,
                                        fontWeight: FontWeight.w700),
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
                        Text('Plan and commercial summary',
                            style: theme.textTheme.titleLarge),
                        const SizedBox(height: 12),
                        _row('Plan lane', planCategory),
                        _row('Plan code', planCode.isEmpty ? '-' : planCode),
                        _row(
                            'Download',
                            planDownload > 0
                                ? '${planDownload.toStringAsFixed(0)} Mbps'
                                : '-'),
                        _row(
                            'Upload',
                            planUpload > 0
                                ? '${planUpload.toStringAsFixed(0)} Mbps'
                                : '-'),
                        _row(
                            'Monthly price',
                            planPrice > 0
                                ? 'Rs ${planPrice.toStringAsFixed(0)}'
                                : '-'),
                        _row('Data policy', _dataPolicyLabel(planDataPolicy)),
                        _row(
                            'Data cap',
                            planDataPolicy == 'unlimited'
                                ? 'Unlimited'
                                : (planDataLimit > 0
                                    ? '${planDataLimit.toStringAsFixed(0)} GB'
                                    : '-')),
                        _row(
                            'FUP speed',
                            planFupSpeed > 0
                                ? '${planFupSpeed.toStringAsFixed(0)} Mbps'
                                : '-'),
                        _row(
                            'OTC',
                            planOtc > 0
                                ? 'Rs ${planOtc.toStringAsFixed(0)}'
                                : '-'),
                        _row(
                            'Installation',
                            planInstall > 0
                                ? 'Rs ${planInstall.toStringAsFixed(0)}'
                                : '-'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                            device.isNotEmpty
                                ? 'Router linked'
                                : 'Provisioning details',
                            style: theme.textTheme.titleLarge),
                        const SizedBox(height: 12),
                        _row('Brand', (preview['brand'] ?? '-').toString()),
                        _row('PPPoE user', pppoeUsername),
                        _row('PPPoE password', pppoePassword),
                        _row(
                            'VLAN',
                            (preview['vlanId'] ??
                                    activation['credentials']?['vlanId'] ??
                                    '-')
                                .toString()),
                        _row(
                            'NAT',
                            ((preview['natEnabled'] ??
                                        activation['credentials']
                                            ?['natEnabled']) ==
                                    true)
                                ? 'Enabled'
                                : 'Pending'),
                        _row(singleWifiName ? 'Wi-Fi SSID' : 'SSID 2.4G',
                            wifiSsid24),
                        if (!singleWifiName) _row('SSID 5G', wifiSsid5),
                        _row('Wi-Fi password', wifiPassword),
                        _row('Config status', configStatus),
                        _row('Internet',
                            status == 'active' ? 'Active' : 'Pending'),
                        if (activationLive) ...[
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Text(
                                'Customer handover',
                                style: theme.textTheme.titleMedium
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: kSurface2,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                      color: const Color(0x228224E3)),
                                ),
                                child: const Text(
                                  'Live',
                                  style: TextStyle(
                                      color: kPrimaryLight,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border:
                                  Border.all(color: const Color(0x228224E3)),
                            ),
                            child: const Text(
                              'Share Wi-Fi names, Wi-Fi password, and PPPoE details with the customer before closing the visit.',
                              style: TextStyle(color: kMuted, height: 1.45),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              FilledButton(
                                onPressed:
                                    (wifiSsid24 == '-' && wifiSsid5 == '-') &&
                                            (pppoeUsername == '-' &&
                                                pppoePassword == '-')
                                        ? null
                                        : () => _copyText(
                                              'Customer handover copied',
                                              handoverPack,
                                            ),
                                child: const Text('Copy handover pack'),
                              ),
                              OutlinedButton(
                                onPressed:
                                    pppoeUsername == '-' && pppoePassword == '-'
                                        ? null
                                        : () => _copyText(
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
                        Text('Optical and device',
                            style: theme.textTheme.titleLarge),
                        const SizedBox(height: 12),
                        _row('RX power', rxPowerText,
                            valueColor: _opticalPowerColor(rxPowerText)),
                        _row('TX power', txPowerText,
                            valueColor: _opticalPowerColor(txPowerText)),
                        _row('Health',
                            opticalHealthText),
                        _row('Router serial',
                            '${device['serialNumber'] ?? deviceContext['finalSerialNumber'] ?? '-'}'),
                        _row('Device ID',
                            linkedDeviceId.isEmpty ? '-' : linkedDeviceId),
                        _row(
                            'Model',
                            linkedProductClass.isEmpty
                                ? '-'
                                : linkedProductClass),
                        _row('Router online',
                            '${device['onlineStatus'] ?? 'unknown'}'),
                        _row('Provisioning state',
                            '${device['provisioningState'] ?? 'pending'}'),
                        if (deviceRefsPack.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              OutlinedButton(
                                onPressed: () => _copyText(
                                    'Device references copied', deviceRefsPack),
                                child: const Text('Copy device refs'),
                              ),
                              OutlinedButton(
                                onPressed: () => _copyText(
                                    'Diagnostics snapshot copied',
                                    diagnosticsPack),
                                child: const Text('Copy diagnostics'),
                              ),
                            ],
                          ),
                        ],
                        if (recommendations.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(
                            'Field recommendations',
                            style: theme.textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children:
                                recommendations.take(4).map(_miniPill).toList(),
                          ),
                        ],
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
                              Text('Complaint workflow',
                                  style: theme.textTheme.titleLarge),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: kSurface2,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                      color: const Color(0x228224E3)),
                                ),
                                child: const Text(
                                  'Guided',
                                  style: TextStyle(
                                      color: kPrimaryLight,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border:
                                  Border.all(color: const Color(0x228224E3)),
                            ),
                            child: const Text(
                              'Choose the issue type, record the complaint note, replace ONT if needed, and verify customer OTP before resolution.',
                              style: TextStyle(color: kMuted, height: 1.45),
                            ),
                          ),
                          const SizedBox(height: 12),
                          if (complaint.isNotEmpty ||
                              deviceContext['oldSerialNumber'] != null ||
                              deviceContext['finalSerialNumber'] != null) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: kSurface,
                                borderRadius: BorderRadius.circular(18),
                                border:
                                    Border.all(color: const Color(0x228224E3)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Replacement summary',
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 10),
                                  _row('Resolution code',
                                      complaintResolution.replaceAll('_', ' ')),
                                  _row('Old serial',
                                      '${deviceContext['oldSerialNumber'] ?? '-'}'),
                                  _row('New serial',
                                      '${deviceContext['finalSerialNumber'] ?? '-'}'),
                                  _row('Complaint note',
                                      '${complaint['note'] ?? _complaintNoteController.text.trim()}'),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],
                          if (complaintRuntimeStageLabel.isNotEmpty ||
                              complaintRuntimeOperatorMessage.isNotEmpty ||
                              complaintRuntimeFailureCode.isNotEmpty ||
                              complaintRuntimeRecommendedActions.isNotEmpty) ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: kSurface,
                                borderRadius: BorderRadius.circular(18),
                                border:
                                    Border.all(color: const Color(0x228224E3)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (complaintRuntimeStageLabel.isNotEmpty) ...[
                                    _row('Current stage',
                                        complaintRuntimeStageLabel),
                                    const SizedBox(height: 10),
                                  ],
                                  if (complaintRuntimeOperatorMessage
                                      .isNotEmpty) ...[
                                    _row('Operator message',
                                        complaintRuntimeOperatorMessage),
                                    const SizedBox(height: 10),
                                  ],
                                  if (complaintRuntimeFailureCode
                                      .isNotEmpty) ...[
                                    _row(
                                      'Hold point',
                                      _complaintFailureLabel(
                                          complaintRuntimeFailureCode),
                                    ),
                                    const SizedBox(height: 10),
                                  ],
                                  if (complaintRuntimeRecommendedActions
                                      .isNotEmpty) ...[
                                    _blockerPanel(
                                      title: 'Next field actions',
                                      items: complaintRuntimeRecommendedActions,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],
                          Text(
                            'Issue type',
                            style: theme.textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
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
                                            setState(() =>
                                                _complaintResolutionCode =
                                                    code);
                                          },
                                  ),
                                )
                                .toList(),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _complaintNoteController,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                                labelText: 'Complaint note'),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _replaceSerialController,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(
                                labelText: 'Replacement ONT serial'),
                          ),
                          const SizedBox(height: 12),
                          if (lastRebootAt.isNotEmpty) ...[
                            Text(
                              'Last reboot: ${_shortDateTime(lastRebootAt)}',
                              style: GoogleFonts.inter(
                                  color: kMuted, fontSize: 11),
                            ),
                            const SizedBox(height: 8),
                          ],
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
                                          subtitle:
                                              'Scan the replacement router barcode or QR code to capture the new serial for complaint resolution.',
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
                                            resolutionCode:
                                                _complaintResolutionCode,
                                            note: _complaintNoteController.text
                                                    .trim()
                                                    .isEmpty
                                                ? 'Installer started complaint work'
                                                : _complaintNoteController.text
                                                    .trim(),
                                          ),
                                          'Complaint workflow started',
                                        ),
                                child: const Text('Start complaint'),
                              ),
                              OutlinedButton(
                                onPressed: _busy || !canReplaceOnt
                                    ? null
                                    : () {
                                        final serial = _replaceSerialController
                                            .text
                                            .trim();
                                        if (serial.isEmpty) {
                                          _show('Enter replacement ONT serial');
                                          return;
                                        }
                                        _run(
                                          () => _appState.api.replaceDevice(
                                            _appState.session!,
                                            widget.job.id,
                                            newSerialNumber: serial,
                                            reason: _complaintNoteController
                                                    .text
                                                    .trim()
                                                    .isEmpty
                                                ? 'ONT replaced from installer app'
                                                : _complaintNoteController.text
                                                    .trim(),
                                          ),
                                          'ONT replacement saved',
                                        );
                                      },
                                child: const Text('Replace ONT'),
                              ),
                              OutlinedButton(
                                onPressed: _busy ||
                                        !canRebootComplaint ||
                                        _rebootCountdown > 0
                                    ? null
                                    : () async {
                                        setState(() => _busy = true);
                                        try {
                                          await _appState.api
                                              .rebootComplaintDevice(
                                                  _appState.session!,
                                                  widget.job.id);
                                          _startRebootCountdown();
                                        } catch (e) {
                                          _show(e.toString());
                                        } finally {
                                          if (mounted) {
                                            setState(() => _busy = false);
                                          }
                                        }
                                      },
                                child: Text(_rebootCountdown > 0
                                    ? 'Rebooting… ${_rebootCountdown}s'
                                    : 'Reboot ONT'),
                              ),
                              OutlinedButton(
                                onPressed: _busy || !canSendComplaintOtp
                                    ? null
                                    : () async {
                                        setState(() => _busy = true);
                                        try {
                                          final otp = await _appState.api
                                              .sendComplaintOtp(
                                                  _appState.session!,
                                                  widget.job.id);
                                          _show(otp == null
                                              ? 'Complaint OTP sent'
                                              : 'Complaint OTP: $otp');
                                          await _loadAll();
                                        } catch (e) {
                                          _show(e.toString());
                                        } finally {
                                          if (mounted) {
                                            setState(() => _busy = false);
                                          }
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
                                        _resolveComplaintFlow();
                                      },
                                child: const Text('Resolve complaint'),
                              ),
                              OutlinedButton(
                                onPressed: () => _copyText(
                                    'Complaint summary copied',
                                    complaintSummaryPack),
                                child: const Text('Copy complaint summary'),
                              ),
                            ],
                          ),
                          if (otpPurpose.isNotEmpty ||
                              otpVerifiedAt.isNotEmpty ||
                              otpExpiresAt.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: kSurface2,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: kBorder),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'OTP state',
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 10),
                                  _row('Purpose', _otpPurposeLabel(otpPurpose)),
                                  _row(
                                      'Expires',
                                      otpExpiresAt.isEmpty
                                          ? '-'
                                          : _shortDateTime(otpExpiresAt)),
                                  _row(
                                      'Verified',
                                      otpVerifiedAt.isEmpty
                                          ? '-'
                                          : _shortDateTime(otpVerifiedAt)),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),
                          TextField(
                            controller: _otpController,
                            onChanged: (_) => setState(() {}),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                                labelText: 'Customer OTP'),
                          ),
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: kSurface,
                              borderRadius: BorderRadius.circular(18),
                              border:
                                  Border.all(color: const Color(0x228224E3)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Complaint closure checklist',
                                  style: theme.textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 10),
                                _checkRow(
                                    'Issue identified',
                                    complaint['note'] != null ||
                                        _complaintNoteController.text
                                            .trim()
                                            .isNotEmpty),
                                _checkRow('Resolution selected',
                                    _complaintResolutionCode.isNotEmpty),
                                _checkRow(
                                    'ONT replaced if needed',
                                    deviceContext['finalSerialNumber'] !=
                                            null ||
                                        !canReplaceOnt),
                                _checkRow('Customer OTP entered',
                                    _otpController.text.trim().length == 6),
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
                              Text('Installation completion',
                                  style: theme.textTheme.titleLarge),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: kSurface2,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                      color: const Color(0x228224E3)),
                                ),
                                child: const Text(
                                  'Final stage',
                                  style: TextStyle(
                                      color: kPrimaryLight,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border:
                                  Border.all(color: const Color(0x228224E3)),
                            ),
                            child: const Text(
                              'Capture router and cable proof, submit the proof payload, then verify customer OTP to complete installation cleanly.',
                              style: TextStyle(color: kMuted, height: 1.45),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: kSurface2,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: kBorder),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Checklist state',
                                  style: theme.textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 10),
                                _row('Checklist saved',
                                    checklistSaved ? 'Yes' : 'Pending'),
                                _row(
                                    'Saved at',
                                    checklistSavedAt.isEmpty
                                        ? '-'
                                        : _shortDateTime(checklistSavedAt)),
                                if (recommendations.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: recommendations
                                        .take(3)
                                        .map(_miniPill)
                                        .toList(),
                                  ),
                                ],
                                const SizedBox(height: 12),
                                OutlinedButton(
                                  onPressed: _busy
                                      ? null
                                      : () => _run(
                                            () => _appState.api.saveChecklist(
                                                _appState.session!,
                                                widget.job.id),
                                            'Checklist saved',
                                          ),
                                  child: Text(checklistSaved
                                      ? 'Update checklist'
                                      : 'Save checklist'),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _miniPill(_routerPhotoPath == null
                                  ? 'Router photo pending'
                                  : 'Router photo captured'),
                              _miniPill(_cablePhotoPath == null
                                  ? 'Cable photo pending'
                                  : 'Cable photo captured'),
                              _miniPill(proofUploaded
                                  ? 'Proof uploaded'
                                  : 'Proof not uploaded'),
                            ],
                          ),
                          const SizedBox(height: 12),
                          _row(
                              'Router photo',
                              _routerPhotoPath == null
                                  ? 'Pending capture'
                                  : 'Captured'),
                          _row(
                              'Cable photo',
                              _cablePhotoPath == null
                                  ? 'Pending capture'
                                  : 'Captured'),
                          _row(
                              'Proof uploaded',
                              proofUploadedAt.isEmpty
                                  ? '-'
                                  : _shortDateTime(proofUploadedAt)),
                          const SizedBox(height: 8),
                          if (_routerPhotoPath != null ||
                              _cablePhotoPath != null) ...[
                            Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: [
                                if (_routerPhotoPath != null)
                                  _proofPreviewCard(
                                      'Router photo', _routerPhotoPath!),
                                if (_cablePhotoPath != null)
                                  _proofPreviewCard(
                                      'Cable photo', _cablePhotoPath!),
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
                                    : () =>
                                        _captureProofPhoto(routerPhoto: true),
                                child: Text(_routerPhotoPath != null
                                    ? 'Retake router photo'
                                    : 'Capture router photo'),
                              ),
                              OutlinedButton(
                                onPressed: _busy
                                    ? null
                                    : () =>
                                        _captureProofPhoto(routerPhoto: false),
                                child: Text(_cablePhotoPath != null
                                    ? 'Retake cable photo'
                                    : 'Capture cable photo'),
                              ),
                              OutlinedButton(
                                onPressed: _busy || !canSubmitProof
                                    ? null
                                    : _submitCapturedProof,
                                child: Text(proof.isNotEmpty
                                    ? 'Update proof'
                                    : 'Submit proof'),
                              ),
                              OutlinedButton(
                                onPressed: _busy || !canSendInstallOtp
                                    ? null
                                    : () async {
                                        setState(() => _busy = true);
                                        try {
                                          final otp = await _appState.api
                                              .sendCompletionOtp(
                                                  _appState.session!,
                                                  widget.job.id);
                                          _show(otp == null
                                              ? 'Completion OTP sent'
                                              : 'Completion OTP: $otp');
                                          await _loadAll();
                                        } catch (e) {
                                          _show(e.toString());
                                        } finally {
                                          if (mounted) {
                                            setState(() => _busy = false);
                                          }
                                        }
                                      },
                                child: const Text('Send OTP'),
                              ),
                              OutlinedButton(
                                onPressed: () => _copyText(
                                    'Proof summary copied', proofSummaryPack),
                                child: const Text('Copy proof summary'),
                              ),
                            ],
                          ),
                          if (otpPurpose.isNotEmpty ||
                              otpVerifiedAt.isNotEmpty ||
                              otpExpiresAt.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: kSurface2,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: kBorder),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'OTP state',
                                    style: theme.textTheme.titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 10),
                                  _row('Purpose', _otpPurposeLabel(otpPurpose)),
                                  _row(
                                      'Expires',
                                      otpExpiresAt.isEmpty
                                          ? '-'
                                          : _shortDateTime(otpExpiresAt)),
                                  _row(
                                      'Verified',
                                      otpVerifiedAt.isEmpty
                                          ? '-'
                                          : _shortDateTime(otpVerifiedAt)),
                                ],
                              ),
                            ),
                          ],
                          if (_routerPhotoCapturedAt != null ||
                              _cablePhotoCapturedAt != null) ...[
                            const SizedBox(height: 10),
                            if (_routerPhotoCapturedAt != null)
                              _row(
                                  'Router captured',
                                  _shortDateTime(_routerPhotoCapturedAt!
                                      .toIso8601String())),
                            if (_cablePhotoCapturedAt != null)
                              _row(
                                  'Cable captured',
                                  _shortDateTime(_cablePhotoCapturedAt!
                                      .toIso8601String())),
                          ],
                          const SizedBox(height: 12),
                          TextField(
                            controller: _otpController,
                            onChanged: (_) => setState(() {}),
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                                labelText: 'Customer OTP'),
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
                                      _completeInstallationFlow();
                                    },
                              child: const Text('Complete installation'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              if (status != 'completed' && status != 'cancelled')
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : _showDeferJobSheet,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFFBBF24),
                          side: const BorderSide(color: Color(0x55F59E0B)),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        icon: const Icon(Icons.schedule_rounded, size: 18),
                        label: Text('Follow-up', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                      ),
                    ),
                    if (!isComplaint && _canCancelInstall(status)) ...[
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : _showCancelInstallationSheet,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFFFCA5A5),
                            side: const BorderSide(color: Color(0x55EF4444)),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          icon: const Icon(Icons.cancel_outlined, size: 18),
                          label: Text('Cancel job', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ],
                ),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Wizard: step derivation + scaffold ──────────────────────────────────

  int _deriveWizardStep(String status, String configStatus, bool isComplaint,
      bool proofUploaded, bool activationLive) {
    if (isComplaint) {
      switch (status) {
        case 'assigned': return 0;
        case 'accepted': case 'enroute': return 1;
        case 'onsite': return 2;
        case 'complaint_in_progress': return 3;
        case 'completed': return 4;
        default: return 2;
      }
    }
    switch (status) {
      case 'assigned': return 0;
      case 'accepted': case 'enroute': return 1;
      case 'onsite': case 'ont_scanned':
        return _serialController.text.trim().isEmpty ? 2 : 3;
      case 'activation_in_progress': return 4;
      case 'failed': return activationLive ? 5 : 4;
      case 'active': return proofUploaded ? 6 : 5;
      case 'completed': return 6;
      default: return 2;
    }
  }

  Widget _buildWizardNew() {
    final detail = _detail;
    final diagnostics = _diagnostics ?? <String, dynamic>{};
    final preview = _preview ?? <String, dynamic>{};
    final status = (detail?['status'] ?? widget.job.status).toString();
    final isComplaint = widget.job.jobType.toLowerCase().contains('complaint');
    final customerName = _firstNonBlankText([detail?['customerSnapshot']?['fullName'], widget.job.customerName]);
    final phone = _firstNonBlankText([
      if ((detail?['customerSnapshot']?['phone']?.toString() ?? '').isNotEmpty)
        detail?['customerSnapshot']?['phone'],
      widget.job.customerPhone,
    ]);
    final activation = (detail?['activation'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final configStatus = (activation['configStatus'] ?? '-').toString();
    final proof = (detail?['proof'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
    final proofUploaded = proof.isNotEmpty;
    final activationLive = _isActivationLiveStatus(status, configStatus);
    final step = _wizardStep ?? _deriveWizardStep(status, configStatus, isComplaint, proofUploaded, activationLive);
    final totalSteps = isComplaint ? 5 : 7;

    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        backgroundColor: const Color(0xFF100820),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white70),
          onPressed: () {
            final currentStep = _wizardStep ?? step;
            if (currentStep > 0) {
              setState(() => _wizardStep = currentStep - 1);
            } else {
              Navigator.of(context).pop();
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(widget.job.jobNumber,
                style: GoogleFonts.inter(color: Colors.white30, fontSize: 10, fontWeight: FontWeight.w600)),
            Text(
              isComplaint
                  ? 'Complaint  —  Step ${step + 1} of $totalSteps'
                  : 'Installation  —  Step ${step + 1} of $totalSteps',
              style: GoogleFonts.inter(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        actions: [
          if (_busy)
            const Padding(
              padding: EdgeInsets.only(right: 16),
              child: Center(child: SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white38))),
            ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Colors.white38, size: 20),
            onPressed: _busy ? null : _loadAll,
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3),
          child: LinearProgressIndicator(
            value: (step + 1) / totalSteps,
            backgroundColor: Colors.white12,
            color: kPrimaryLight,
            minHeight: 3,
          ),
        ),
      ),
      body: RefreshIndicator(
        color: kPrimaryLight,
        backgroundColor: kSurface,
        onRefresh: _loadAll,
        child: isComplaint
            ? _complaintWizardStep(step, status, phone, customerName, configStatus,
                proofUploaded, activationLive, detail, diagnostics, preview)
            : _installWizardStep(step, status, phone, customerName, configStatus,
                proofUploaded, activationLive, detail, diagnostics, preview),
      ),
    );
  }

  Widget _installWizardStep(int step, String status, String phone, String customerName,
      String configStatus, bool proofUploaded, bool activationLive,
      Map<String, dynamic>? detail, Map<String, dynamic> diagnostics, Map<String, dynamic> preview) {
    switch (step) {
      case 0: return _wizStepOverview(status, phone, customerName, detail, preview, isComplaint: false);
      case 1: return _wizStepTravel(status, phone, customerName, detail, isComplaint: false);
      case 2: return _wizStepScanOnt(status, detail, diagnostics);
      case 3: return _wizStepDiagnostics(status, detail, diagnostics, isComplaint: false);
      case 4: return _wizStepConfigActivate(status, configStatus, activationLive, detail, preview);
      case 5: return _wizStepProof(status, configStatus, activationLive, detail);
      case 6: return _wizStepOtp(status, configStatus, proofUploaded, activationLive, phone);
      default: return _wizStepOverview(status, phone, customerName, detail, preview, isComplaint: false);
    }
  }

  Widget _complaintWizardStep(int step, String status, String phone, String customerName,
      String configStatus, bool proofUploaded, bool activationLive,
      Map<String, dynamic>? detail, Map<String, dynamic> diagnostics, Map<String, dynamic> preview) {
    switch (step) {
      case 0: return _wizStepOverview(status, phone, customerName, detail, preview, isComplaint: true);
      case 1: return _wizStepTravel(status, phone, customerName, detail, isComplaint: true);
      case 2: return _wizStepDiagnostics(status, detail, diagnostics, isComplaint: true);
      case 3: return _wizStepComplaintResolution(status, detail);
      case 4: return _wizStepComplaintOtp(status, phone);
      default: return _wizStepOverview(status, phone, customerName, detail, preview, isComplaint: true);
    }
  }

  // ── Wizard: shared UI helpers ────────────────────────────────────────────

  Widget _wCard({required Widget child, Color? borderColor}) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: borderColor ?? kBorder),
        ),
        child: child,
      );

  Widget _wLabel(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: GoogleFonts.inter(
                color: kSubtle, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1.4)),
      );

  Widget _wPrimaryBtn(String label,
      {required VoidCallback? onPressed, Color? color, IconData? icon}) =>
      SizedBox(
        width: double.infinity,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: color ?? kPrimary,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          ),
          onPressed: _busy ? null : onPressed,
          icon: _busy
              ? const SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Icon(icon ?? Icons.arrow_forward_rounded, size: 20),
          label: Text(label, style: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w800)),
        ),
      );

  Widget _wizBottomBar(Widget child) => Positioned(
        left: 0, right: 0, bottom: 0,
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
          decoration: BoxDecoration(color: kBg, border: Border(top: BorderSide(color: kBorder))),
          child: SafeArea(top: false, child: child),
        ),
      );

  Widget _wPriorityBadge(String priority) {
    final color = ['urgent', 'high'].contains(priority)
        ? const Color(0xFFEF4444)
        : priority == 'medium' ? const Color(0xFFF59E0B) : const Color(0xFF10B981);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(priority.isEmpty ? 'NORMAL' : priority.toUpperCase(),
          style: GoogleFonts.inter(color: color, fontSize: 10, fontWeight: FontWeight.w800)),
    );
  }

  // ── Step 0: Job Overview ─────────────────────────────────────────────────

  Widget _wizStepOverview(String status, String phone, String customerName,
      Map<String, dynamic>? detail, Map<String, dynamic> preview,
      {required bool isComplaint}) {
    // Address: handle {fullAddress, pinCode} map stored as object
    final rawAddr = detail?['customerSnapshot']?['address'];
    String addr;
    if (rawAddr is Map) {
      final full = (rawAddr['fullAddress'] ?? '').toString().trim();
      final pin = (rawAddr['pinCode'] ?? '').toString().trim();
      addr = [full, if (pin.isNotEmpty && pin != '0000') pin]
          .where((p) => p.isNotEmpty).join(', ');
      if (addr.isEmpty) addr = widget.job.customerAddress;
    } else {
      addr = _firstNonBlankText([rawAddr, widget.job.customerAddress]);
    }
    final planName = _firstNonBlankText(
        [preview['planName'], widget.job.planCode], fallback: 'Pending assignment');
    final planSpeed = widget.job.downloadSpeedMbps > 0
        ? '${widget.job.downloadSpeedMbps.toInt()} Mbps'
        : (preview['speedMbps'] != null ? '${preview['speedMbps']} Mbps' : '');
    final monthly = widget.job.monthlyPrice > 0
        ? '₹${widget.job.monthlyPrice.toInt()}/mo'
        : (preview['monthlyPrice'] != null ? '₹${preview['monthlyPrice']}/mo' : '');
    final scheduledAt = _firstNonBlankText(
        [detail?['scheduledAt'], widget.job.scheduledAt], fallback: '');
    final priority = _firstNonBlankText(
        [detail?['priority'], widget.job.priority], fallback: 'normal');
    final canAccept = _canAccept(status);
    final canTravel = _canStartTravel(status);
    // Complaint issue details
    final complaintObj = (detail?['complaint'] as Map?)?.cast<String, dynamic>() ?? {};
    final issueCategory = _firstNonBlankText(
        [complaintObj['category'], widget.job.complaintCategory], fallback: '')
        .replaceAll('_', ' ');
    final issueDesc = _firstNonBlankText(
        [complaintObj['description'], widget.job.complaintDescription], fallback: '');

    return Stack(children: [
      SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 130),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                  color: _statusBadgeColor(status), borderRadius: BorderRadius.circular(999)),
              child: Text(status.replaceAll('_', ' ').toUpperCase(),
                  style: GoogleFonts.inter(
                      color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                  color: kPrimary.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(999)),
              child: Text(isComplaint ? 'COMPLAINT' : 'INSTALLATION',
                  style: GoogleFonts.inter(
                      color: kPrimaryLight, fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
            ),
          ]),
          // Complaint issue card
          if (isComplaint && (issueCategory.isNotEmpty || issueDesc.isNotEmpty)) ...[
            const SizedBox(height: 12),
            _wCard(
              borderColor: const Color(0xFFF97316).withValues(alpha: 0.45),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(Icons.report_problem_rounded,
                      color: Color(0xFFF97316), size: 16),
                  const SizedBox(width: 8),
                  _wLabel('CUSTOMER COMPLAINT'),
                ]),
                const SizedBox(height: 8),
                if (issueCategory.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF97316).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: const Color(0xFFF97316).withValues(alpha: 0.35)),
                    ),
                    child: Text(issueCategory.toUpperCase(),
                        style: GoogleFonts.inter(
                            color: const Color(0xFFF97316),
                            fontSize: 11, fontWeight: FontWeight.w800)),
                  ),
                if (issueDesc.isNotEmpty)
                  Text(issueDesc,
                      style: GoogleFonts.inter(
                          color: kText, fontSize: 14, height: 1.5,
                          fontWeight: FontWeight.w500)),
              ]),
            ),
          ],
          const SizedBox(height: 16),
          _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _wLabel('CUSTOMER'),
            Text(customerName,
                style: GoogleFonts.inter(
                    color: kText, fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: -0.4)),
            if (phone.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.phone_rounded, color: kPrimaryLight, size: 14),
                const SizedBox(width: 6),
                Text('+91 $phone',
                    style: GoogleFonts.inter(color: kPrimaryLight, fontSize: 13, fontWeight: FontWeight.w700)),
              ]),
            ],
            if (addr.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Icon(Icons.location_on_rounded, color: kMuted, size: 14),
                const SizedBox(width: 6),
                Expanded(child: Text(addr,
                    style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.4))),
              ]),
            ],
          ])),
          const SizedBox(height: 12),
          _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _wLabel('PLAN'),
            Row(children: [
              Expanded(child: Text(planName,
                  style: GoogleFonts.inter(color: kText, fontSize: 15, fontWeight: FontWeight.w800))),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                if (monthly.isNotEmpty)
                  Text(monthly, style: GoogleFonts.inter(
                      color: kPrimaryLight, fontSize: 16, fontWeight: FontWeight.w900)),
                if (planSpeed.isNotEmpty)
                  Text(planSpeed, style: GoogleFonts.inter(color: kMuted, fontSize: 12)),
              ]),
            ]),
          ])),
          const SizedBox(height: 12),
          if (scheduledAt.isNotEmpty)
            _wCard(child: Row(children: [
              const Icon(Icons.event_rounded, color: kPrimaryLight, size: 18),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _wLabel('SCHEDULED'),
                Text(_shortDateTime(scheduledAt),
                    style: GoogleFonts.inter(color: kText, fontSize: 14, fontWeight: FontWeight.w700)),
              ])),
              _wPriorityBadge(priority),
            ])),
          const SizedBox(height: 12),
          _wCard(child: Row(children: [
            const Icon(Icons.tag_rounded, color: kMuted, size: 18),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('JOB NUMBER'),
              Text(widget.job.jobNumber,
                  style: GoogleFonts.inter(color: kText, fontSize: 14, fontWeight: FontWeight.w700)),
            ])),
            GestureDetector(
              onTap: () => _copyText('Job number copied', widget.job.jobNumber),
              child: const Icon(Icons.copy_rounded, color: kSubtle, size: 18),
            ),
          ])),
        ]),
      ),
      _wizBottomBar(Column(mainAxisSize: MainAxisSize.min, children: [
        if (canAccept)
          _wPrimaryBtn(isComplaint ? 'Accept Complaint' : 'Accept Job',
              icon: Icons.check_circle_rounded,
              onPressed: () => _run(
                  () => _appState.api.acceptJob(_appState.session!, widget.job.id),
                  isComplaint ? 'Complaint accepted' : 'Job accepted'))
        else if (canTravel)
          _wPrimaryBtn('Start Travelling to Site',
              icon: Icons.directions_car_rounded,
              onPressed: () async {
                await _run(
                    () => _appState.api.startTravel(_appState.session!, widget.job.id),
                    'Travel started');
                if (mounted) setState(() => _wizardStep = 1);
              })
        else
          _wPrimaryBtn('Proceed to Next Step',
              icon: Icons.arrow_forward_rounded,
              onPressed: () => setState(() => _wizardStep = 1)),
      ])),
    ]);
  }

  // ── Step 1: Travel to Site ───────────────────────────────────────────────

  Widget _wizStepTravel(String status, String phone, String customerName,
      Map<String, dynamic>? detail, {required bool isComplaint}) {
    final rawAddr = detail?['customerSnapshot']?['address'];
    final String addr;
    if (rawAddr is Map) {
      final full = (rawAddr['fullAddress'] ?? '').toString().trim();
      final pin = (rawAddr['pinCode'] ?? '').toString().trim();
      final joined = [full, if (pin.isNotEmpty && pin != '0000') pin]
          .where((p) => p.isNotEmpty).join(', ');
      addr = joined.isNotEmpty ? joined : widget.job.customerAddress;
    } else {
      addr = _firstNonBlankText([rawAddr, widget.job.customerAddress]);
    }
    final lat = widget.job.latitude;
    final lng = widget.job.longitude;
    final mapUrl = widget.job.mapUrl.isNotEmpty
        ? widget.job.mapUrl
        : (lat != null && lng != null ? 'https://maps.google.com/?q=$lat,$lng' : '');
    final canOnsite = _canStartOnsite(status);
    final canTravel = _canStartTravel(status);
    final nextStep = isComplaint ? 2 : 2;

    return Stack(children: [
      SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 140),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _wLabel('DESTINATION'),
            Text(customerName,
                style: GoogleFonts.inter(color: kText, fontSize: 18, fontWeight: FontWeight.w900)),
            if (addr.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(addr, style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.4)),
            ],
          ])),
          const SizedBox(height: 16),
          Row(children: [
            if (phone.isNotEmpty) ...[
              Expanded(child: _quickActionBtn(
                  icon: Icons.call_rounded, label: 'Call',
                  color: const Color(0xFF10B981),
                  onTap: () => _openUri('tel:$phone'))),
              const SizedBox(width: 10),
              Expanded(child: _quickActionBtn(
                  icon: Icons.chat_rounded, label: 'WhatsApp',
                  color: const Color(0xFF25D366),
                  onTap: () => _openUri(
                      'https://wa.me/91$phone?text=${Uri.encodeComponent('Hello! I am from JustFiber and am on my way for your ${isComplaint ? 'complaint resolution' : 'installation'}.')}'))),
              const SizedBox(width: 10),
            ],
            if (mapUrl.isNotEmpty)
              Expanded(child: _quickActionBtn(
                  icon: Icons.map_rounded, label: 'Maps',
                  color: const Color(0xFF0EA5E9),
                  onTap: () => _openUri(mapUrl))),
          ]),
          const SizedBox(height: 16),
          _wCard(
            borderColor: canOnsite
                ? const Color(0xFF10B981).withValues(alpha: 0.4)
                : const Color(0xFF0EA5E9).withValues(alpha: 0.3),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(
                  canOnsite ? Icons.location_on_rounded : Icons.directions_car_rounded,
                  color: canOnsite ? const Color(0xFF10B981) : const Color(0xFF0EA5E9),
                  size: 20,
                ),
                const SizedBox(width: 10),
                Expanded(child: Text(
                  canOnsite ? 'You have arrived at the customer site' : 'Currently travelling to site',
                  style: GoogleFonts.inter(color: kText, fontSize: 14, fontWeight: FontWeight.w700),
                )),
              ]),
              const SizedBox(height: 6),
              Text(
                canOnsite
                    ? 'Tap "Mark Arrived" to begin the ${isComplaint ? 'complaint' : 'installation'} process.'
                    : 'Once you reach the customer, tap "Mark Arrived" below.',
                style: GoogleFonts.inter(color: kMuted, fontSize: 12, height: 1.4),
              ),
            ]),
          ),
        ]),
      ),
      _wizBottomBar(Column(mainAxisSize: MainAxisSize.min, children: [
        if (canTravel)
          _wPrimaryBtn('Start Travelling',
              icon: Icons.directions_car_rounded,
              onPressed: () => _run(
                  () => _appState.api.startTravel(_appState.session!, widget.job.id),
                  'Travel started'))
        else if (canOnsite)
          _wPrimaryBtn('Mark Arrived at Site',
              icon: Icons.location_on_rounded, color: const Color(0xFF10B981),
              onPressed: () async {
                await _run(() async {
                  await _appState.api.startOnsite(_appState.session!, widget.job.id);
                  if (lat != null && lng != null) {
                    await _appState.api.checkinLocation(
                        _appState.session!, widget.job.id,
                        lat: lat, lng: lng, address: addr);
                  }
                }, 'Onsite started');
                if (mounted) setState(() => _wizardStep = nextStep);
              })
        else
          _wPrimaryBtn('Continue',
              icon: Icons.arrow_forward_rounded,
              onPressed: () => setState(() => _wizardStep = nextStep)),
      ])),
    ]);
  }

  // ── Step 2 (Install): Scan ONT ───────────────────────────────────────────

  Widget _wizStepScanOnt(String status, Map<String, dynamic>? detail,
      Map<String, dynamic> diagnostics) {
    final device = (diagnostics['device'] as Map?)?.cast<String, dynamic>() ?? {};
    final knownSerial = _firstNonBlankText([
      device['serialNumber'],
      detail?['deviceContext']?['finalSerialNumber'],
      detail?['deviceContext']?['manualSerialNumber'],
    ], fallback: '');
    if (knownSerial.isNotEmpty && _serialController.text.trim().isEmpty) {
      WidgetsBinding.instance.addPostFrameCallback(
          (_) => setState(() => _serialController.text = knownSerial));
    }
    // True if a serial is already confirmed in the backend (not just in text field)
    final alreadyConfirmed = knownSerial.isNotEmpty;

    return StatefulBuilder(builder: (context, setLocal) {
      return Stack(children: [
        SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 140),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Already-confirmed serial info banner
            if (alreadyConfirmed && _serialConflictError == null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: kPrimaryLight.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: kPrimaryLight.withValues(alpha: 0.25)),
                ),
                child: Row(children: [
                  const Icon(Icons.info_outline_rounded, color: kPrimaryLight, size: 15),
                  const SizedBox(width: 8),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Saved serial: $knownSerial',
                        style: GoogleFonts.inter(
                            color: kPrimaryLight, fontSize: 12, fontWeight: FontWeight.w700)),
                    Text('Clear below and scan/type to replace.',
                        style: GoogleFonts.inter(color: Colors.white54, fontSize: 11)),
                  ])),
                ]),
              ),
              const SizedBox(height: 12),
            ],
            // Conflict error banner
            if (_serialConflictError != null) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
                ),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Icon(Icons.link_off_rounded, color: Color(0xFFEF4444), size: 18),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Router Already Linked',
                        style: GoogleFonts.inter(
                            color: const Color(0xFFEF4444),
                            fontSize: 13, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(_serialConflictError!,
                        style: GoogleFonts.inter(
                            color: const Color(0xFFFCA5A5), fontSize: 12, height: 1.4)),
                  ])),
                  GestureDetector(
                    onTap: () => setState(() => _serialConflictError = null),
                    child: const Icon(Icons.close_rounded,
                        color: Color(0xFFEF4444), size: 16),
                  ),
                ]),
              ),
              const SizedBox(height: 12),
            ],
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('ONT SERIAL NUMBER'),
              const SizedBox(height: 8),
              TextField(
                controller: _serialController,
                style: GoogleFonts.inter(color: kText, fontSize: 16, fontWeight: FontWeight.w700),
                textCapitalization: TextCapitalization.characters,
                decoration: InputDecoration(
                  hintText: 'e.g. HWTCA1234567',
                  hintStyle: GoogleFonts.inter(color: kSubtle),
                  filled: true, fillColor: kSurface2,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  suffixIcon: _serialController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear_rounded, color: kSubtle),
                          onPressed: () => setState(() {
                            _serialController.clear();
                            _serialConflictError = null;
                          }))
                      : null,
                ),
                onChanged: (_) => setLocal(() => _serialConflictError = null),
              ),
            ])),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _quickActionBtn(
                icon: Icons.qr_code_scanner_rounded,
                label: 'Scan Barcode',
                color: kPrimaryLight,
                onTap: () => _scanSerial(
                  controller: _serialController,
                  title: 'Scan ONT Serial',
                  subtitle: 'Scan the barcode or QR code on the router.',
                  refreshOntDetails: true,
                ),
              )),
              const SizedBox(width: 10),
              Expanded(child: _quickActionBtn(
                icon: Icons.router_rounded,
                label: 'Auto-Detect',
                color: const Color(0xFF0EA5E9),
                onTap: _loadAll,
              )),
            ]),
            const SizedBox(height: 16),
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('WHERE TO FIND THE SERIAL'),
              const SizedBox(height: 6),
              Text(
                'The ONT serial number is printed on a sticker on the router. Scan the QR/barcode or type it manually above.',
                style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.5),
              ),
            ])),
          ]),
        ),
        _wizBottomBar(_wPrimaryBtn(
          'Confirm Serial & View Diagnostics',
          icon: Icons.monitor_heart_rounded,
          onPressed: _serialController.text.trim().isEmpty || _busy
              ? null
              : () async {
                  final serial = _serialController.text.trim();
                  setState(() => _busy = true);
                  try {
                    await _appState.api.setManualSerial(
                        _appState.session!, widget.job.id, serial);
                    await _loadAll();
                    if (mounted) setState(() => _wizardStep = 3);
                  } catch (e) {
                    final raw = e.toString();
                    final conflict = _extractSerialConflictMessage(
                      raw,
                      attemptedSerial: serial,
                    );
                    if (conflict != null) {
                      setState(() => _serialConflictError = conflict);
                      await _showSerialConflictDialog(conflict);
                    } else {
                      _show(raw);
                    }
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                },
        )),
      ]);
    });
  }

  // ── Step 3: Diagnostics ──────────────────────────────────────────────────

  Widget _wizStepDiagnostics(String status, Map<String, dynamic>? detail,
      Map<String, dynamic> diagnostics, {required bool isComplaint}) {
    final device = (diagnostics['device'] as Map?)?.cast<String, dynamic>() ?? {};
    final optical = (detail?['opticalReadings'] as Map?)?.cast<String, dynamic>() ?? {};
    final rxText = _resolveOpticalValue(optical, diagnostics, device,
        const ['rxPower', 'opticalRxPower', 'receivedPower', 'ontRxPower', 'rx']);
    final txText = _resolveOpticalValue(optical, diagnostics, device,
        const ['txPower', 'opticalTxPower', 'transmitPower', 'ontTxPower', 'tx']);
    final healthText = _resolveOpticalValue(optical, diagnostics, device,
        const ['healthStatus', 'opticalHealth', 'status'], fallback: 'unknown');
    final model = _firstNonBlankText([device['productClass'], device['model']], fallback: '-');
    final serial = _firstNonBlankText(
        [device['serialNumber'], detail?['deviceContext']?['finalSerialNumber']], fallback: '-');
    final onlineRaw = (device['onlineStatus'] ?? 'unknown').toString();
    final recommendations = (diagnostics['recommendations'] as List?)
            ?.map((e) => e.toString()).where((e) => e.isNotEmpty).toList() ??
        [];
    final healthColor = healthText.toLowerCase().contains('good')
        ? const Color(0xFF10B981)
        : healthText.toLowerCase().contains('warn')
            ? const Color(0xFFF59E0B)
            : const Color(0xFFEF4444);
    final onlineColor = onlineRaw.toLowerCase().contains('online') || onlineRaw == 'true'
        ? const Color(0xFF10B981)
        : const Color(0xFFEF4444);
    final nextStep = isComplaint ? 3 : 4;

    return Stack(children: [
      SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 130),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: _wCard(child: Column(children: [
              _wLabel('RX POWER'),
              const SizedBox(height: 4),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Container(width: 8, height: 8, margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                        color: _opticalPowerColor(rxText), shape: BoxShape.circle)),
                Flexible(child: Text(rxText,
                    style: GoogleFonts.inter(
                        color: _opticalPowerColor(rxText), fontSize: 18, fontWeight: FontWeight.w900))),
              ]),
              Text('dBm', style: GoogleFonts.inter(color: kSubtle, fontSize: 10)),
            ]))),
            const SizedBox(width: 10),
            Expanded(child: _wCard(child: Column(children: [
              _wLabel('TX POWER'),
              const SizedBox(height: 4),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                Container(width: 8, height: 8, margin: const EdgeInsets.only(right: 6),
                    decoration: BoxDecoration(
                        color: _opticalPowerColor(txText), shape: BoxShape.circle)),
                Flexible(child: Text(txText,
                    style: GoogleFonts.inter(
                        color: _opticalPowerColor(txText), fontSize: 18, fontWeight: FontWeight.w900))),
              ]),
              Text('dBm', style: GoogleFonts.inter(color: kSubtle, fontSize: 10)),
            ]))),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: _wCard(child: Column(children: [
              _wLabel('HEALTH'),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: healthColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999)),
                child: Text(healthText.toUpperCase(),
                    style: GoogleFonts.inter(
                        color: healthColor, fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ]))),
            const SizedBox(width: 10),
            Expanded(child: _wCard(child: Column(children: [
              _wLabel('ROUTER'),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                    color: onlineColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(999)),
                child: Text(onlineRaw.toUpperCase(),
                    style: GoogleFonts.inter(
                        color: onlineColor, fontSize: 11, fontWeight: FontWeight.w800)),
              ),
            ]))),
          ]),
          const SizedBox(height: 12),
          _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              Expanded(child: _wLabel('DEVICE DETAILS')),
              GestureDetector(
                onTap: () => setState(() {
                  _wizardStep = 2;
                  _serialConflictError = null;
                }),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: kPrimaryLight.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: kPrimaryLight.withValues(alpha: 0.3)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.qr_code_scanner_rounded, color: kPrimaryLight, size: 13),
                    const SizedBox(width: 5),
                    Text('Change Serial',
                        style: GoogleFonts.inter(
                            color: kPrimaryLight, fontSize: 11, fontWeight: FontWeight.w700)),
                  ]),
                ),
              ),
            ]),
            const SizedBox(height: 4),
            _row('Serial', serial),
            _row('Model', model),
          ])),
          if (recommendations.isNotEmpty) ...[
            const SizedBox(height: 12),
            _wCard(
              borderColor: const Color(0xFFF59E0B).withValues(alpha: 0.3),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _wLabel('FIELD RECOMMENDATIONS'),
                const SizedBox(height: 6),
                ...recommendations.map((r) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Icon(Icons.warning_amber_rounded,
                        color: Color(0xFFF59E0B), size: 14),
                    const SizedBox(width: 6),
                    Expanded(child: Text(r,
                        style: GoogleFonts.inter(color: kMuted, fontSize: 12, height: 1.4))),
                  ]),
                )),
              ]),
            ),
          ],
        ]),
      ),
      _wizBottomBar(Row(children: [
        // Refresh diagnostics
        SizedBox(
          height: 52,
          width: 52,
          child: Material(
            color: kSurface2,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: _busy ? null : _loadAll,
              child: const Icon(Icons.refresh_rounded, color: kPrimaryLight, size: 22),
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Change serial
        SizedBox(
          height: 52,
          width: 52,
          child: Material(
            color: kSurface2,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => setState(() {
                _wizardStep = 2;
                _serialConflictError = null;
              }),
              child: const Icon(Icons.qr_code_scanner_rounded, color: Color(0xFFF59E0B), size: 20),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(child: _wPrimaryBtn(
          isComplaint ? 'Proceed to Resolution' : 'Proceed to Config',
          icon: Icons.arrow_forward_rounded,
          onPressed: () => setState(() => _wizardStep = nextStep),
        )),
      ])),
    ]);
  }

  // ── Step 4 (Install): Config + Activate ──────────────────────────────────

  Widget _wizStepConfigActivate(String status, String configStatus,
      bool activationLive, Map<String, dynamic>? detail,
      Map<String, dynamic>? preview) {
    final activation =
        (detail?['activation'] as Map?)?.cast<String, dynamic>() ?? {};
    final prepared =
        (activation['preparedCredentials'] as Map?)?.cast<String, dynamic>() ??
            {};
    final preparedWifi =
        (prepared['wifi'] as Map?)?.cast<String, dynamic>() ?? {};
    final preparedPppoe =
        (prepared['pppoe'] as Map?)?.cast<String, dynamic>() ?? {};
    final previewWifi =
        (preview?['wifi'] as Map?)?.cast<String, dynamic>() ?? {};
    final previewPppoe =
        (preview?['pppoe'] as Map?)?.cast<String, dynamic>() ?? {};
    final wifiSsid24 = _firstNonBlankText([
      previewWifi['ssid24'],
      activation['credentials']?['wifi']?['ssid24'],
      preparedWifi['ssid24'],
    ]);
    final wifiSsid5 = _firstNonBlankText([
      previewWifi['ssid5'],
      activation['credentials']?['wifi']?['ssid5'],
      preparedWifi['ssid5'],
    ]);
    final wifiPassword = _firstNonBlankText([
      previewWifi['password'],
      activation['credentials']?['wifi']?['password'],
      preparedWifi['password'],
    ]);
    final pppoeUsername = _firstNonBlankText([
      previewPppoe['username'],
      activation['credentials']?['pppoeUsername'],
      preparedPppoe['username'],
    ]);
    final pppoePassword = _firstNonBlankText([
      previewPppoe['password'],
      activation['credentials']?['pppoePassword'],
      preparedPppoe['password'],
    ]);
    final vlanId = (preview?['vlanId'] ?? '').toString();
    final singleSsid = wifiSsid24 != '-' && wifiSsid24 == wifiSsid5;
    final canActivate = _canActivate(status);
    final canRetry = _canRetry(status, configStatus);
    final canRepush = _canRepushConfig(status);
    final serial = _serialController.text.trim();
    final configSuccessful = _isConfigSuccessStatus(configStatus);

    // Stage chips from activation runtime
    final runtime =
        (activation['runtime'] as Map?)?.cast<String, dynamic>() ?? {};
    final stages = (runtime['stages'] as List?)
            ?.map((s) => s.toString())
            .where((s) => s.isNotEmpty)
            .toList() ??
        [];
    final currentStage = _firstNonBlankText([
      runtime['resumeStage'],
      activation['resumeStage'],
    ], fallback: '');

    return Stack(children: [
      SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 150),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Credentials card
          _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _wLabel('WI-FI'),
            if (singleSsid) ...[
              _row('SSID', wifiSsid24),
            ] else ...[
              _row('2.4 GHz SSID', wifiSsid24),
              _row('5 GHz SSID', wifiSsid5),
            ],
            _row('Password', wifiPassword),
          ])),
          const SizedBox(height: 10),
          _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _wLabel('PPPoE'),
            _row('Username', pppoeUsername),
            _row('Password', pppoePassword),
            if (vlanId.isNotEmpty && vlanId != '0') _row('VLAN ID', vlanId),
          ])),
          const SizedBox(height: 10),
          _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _wLabel('ONT SERIAL'),
            _row('Serial', serial.isEmpty ? '(not scanned)' : serial),
          ])),
          // Countdown
          if (_activationCountdown > 0) ...[
            const SizedBox(height: 12),
            _wCard(
              borderColor: kPrimary.withValues(alpha: 0.35),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(Icons.settings_rounded, color: kPrimaryLight, size: 18),
                  const SizedBox(width: 10),
                  Expanded(child: Text('Configuring router…',
                      style: GoogleFonts.inter(
                          color: kText, fontSize: 14, fontWeight: FontWeight.w800))),
                  Text('${_activationCountdown}s',
                      style: GoogleFonts.inter(
                          color: kPrimaryLight, fontSize: 14, fontWeight: FontWeight.w900)),
                ]),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: (180 - _activationCountdown) / 180,
                    minHeight: 8,
                    backgroundColor: kSurface2,
                    valueColor: const AlwaysStoppedAnimation(kPrimaryLight),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Applying Wi-Fi settings, pushing PPPoE config. Please wait.',
                  style: GoogleFonts.inter(color: kMuted, fontSize: 12, height: 1.4),
                ),
              ]),
            ),
          ],
          // Stage chips
          if (stages.isNotEmpty) ...[
            const SizedBox(height: 12),
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('ACTIVATION STAGES'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8, runSpacing: 8,
                children: stages.map((s) {
                  final active = s == currentStage;
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: active
                          ? kPrimary.withValues(alpha: 0.2)
                          : kSurface2,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                          color: active
                              ? kPrimaryLight.withValues(alpha: 0.5)
                              : kBorder),
                    ),
                    child: Text(s.replaceAll('_', ' ').toUpperCase(),
                        style: GoogleFonts.inter(
                            color: active ? kPrimaryLight : kMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.w700)),
                  );
                }).toList(),
              ),
            ])),
          ],
          // Active banner
          if (configSuccessful && !activationLive) ...[
            const SizedBox(height: 12),
            _wCard(
              borderColor: const Color(0xFF60A5FA).withValues(alpha: 0.4),
              child: Row(children: [
                const Icon(Icons.router_rounded,
                    color: Color(0xFF60A5FA), size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(
                  'Config successful. Router config is pushed. Waiting for internet live confirmation.',
                  style: GoogleFonts.inter(
                      color: kText, fontSize: 13, fontWeight: FontWeight.w700, height: 1.4),
                )),
              ]),
            ),
          ],
          if (activationLive) ...[
            const SizedBox(height: 12),
            _wCard(
              borderColor: const Color(0xFF10B981).withValues(alpha: 0.4),
              child: Row(children: [
                const Icon(Icons.check_circle_rounded,
                    color: Color(0xFF10B981), size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(
                  'Internet live! Proceed to upload proof photos.',
                  style: GoogleFonts.inter(
                      color: kText, fontSize: 13, fontWeight: FontWeight.w700, height: 1.4),
                )),
              ]),
            ),
          ],
        ]),
      ),
      _wizBottomBar(Column(mainAxisSize: MainAxisSize.min, children: [
        if (activationLive) ...[
          _wPrimaryBtn('Continue to Proof Upload',
              icon: Icons.photo_camera_rounded,
              color: const Color(0xFF10B981),
              onPressed: () => setState(() => _wizardStep = 5)),
          if (canRepush) ...[
            const SizedBox(height: 8),
            _wPrimaryBtn('Re-push Config',
                icon: Icons.send_rounded,
                color: kPrimary,
                onPressed: _busy || serial.isEmpty
                    ? null
                    : () {
                        _startActivationCountdown(180);
                        _run(
                            () => _appState.runActivationFlow(
                                widget.job.id, serial),
                            'Config re-pushed');
                      }),
          ],
        ] else if (canRepush) ...[
          _wPrimaryBtn('Re-push Config',
              icon: Icons.send_rounded,
              onPressed: _busy || serial.isEmpty
                  ? null
                  : () {
                      _startActivationCountdown(180);
                      _run(
                          () => _appState.runActivationFlow(
                              widget.job.id, serial),
                          'Config re-pushed');
                    }),
          const SizedBox(height: 8),
          _wPrimaryBtn('Continue to Proof Upload',
              icon: Icons.photo_camera_rounded,
              color: const Color(0xFF374151),
              onPressed: () => setState(() => _wizardStep = 5)),
        ] else if (canRetry)
          _wPrimaryBtn('Retry / Resume Activation',
              icon: Icons.refresh_rounded,
              onPressed: _busy
                  ? null
                  : () => _run(
                      () => _appState.api.retryActivation(
                          _appState.session!, widget.job.id,
                          note: 'Retry from wizard step 4'),
                      'Resume requested'))
        else if (canActivate)
          _wPrimaryBtn('Activate Router',
              icon: Icons.power_settings_new_rounded,
              onPressed: _busy || serial.isEmpty
                  ? null
                  : () {
                      _startActivationCountdown(180);
                      _run(
                          () => _appState.runActivationFlow(
                              widget.job.id, serial),
                          'Activation requested');
                    })
        else
          _wPrimaryBtn('Waiting for activation…',
              onPressed: null),
      ])),
    ]);
  }

  // ── Step 5 (Install): Proof Photos ───────────────────────────────────────

  Widget _wizStepProof(String status, String configStatus, bool activationLive,
      Map<String, dynamic>? detail) {
    final proof =
        (detail?['proof'] as Map?)?.cast<String, dynamic>() ?? {};
    // Only treat as uploaded when routerPhotoUrl is present (not just checklist data)
    final proofUploaded =
        proof['uploadedAt'] != null || proof['routerPhotoUrl'] != null;
    final canSubmit =
        _canSubmitProof(status, _hasCapturedProofPhotos(), activationLive);

    return Stack(children: [
      SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 150),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // Already-uploaded banner (informational only — photos can still be retaken)
          if (proofUploaded) ...[
            _wCard(
              borderColor: const Color(0xFF10B981).withValues(alpha: 0.4),
              child: Row(children: [
                const Icon(Icons.check_circle_rounded,
                    color: Color(0xFF10B981), size: 20),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Proof already on record',
                      style: GoogleFonts.inter(
                          color: const Color(0xFF10B981), fontSize: 13,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text('You can retake photos below if needed.',
                      style: GoogleFonts.inter(color: kMuted, fontSize: 11)),
                ])),
              ]),
            ),
            const SizedBox(height: 12),
          ],
          // Router photo — always visible
          _wCard(
            borderColor: _routerPhotoPath != null
                ? const Color(0xFF10B981).withValues(alpha: 0.4)
                : null,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('ROUTER PHOTO'),
              const SizedBox(height: 10),
              if (_routerPhotoPath != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(File(_routerPhotoPath!),
                      height: 180, width: double.infinity, fit: BoxFit.cover),
                ),
                const SizedBox(height: 10),
                Row(children: [
                  const Icon(Icons.check_circle_rounded,
                      color: Color(0xFF10B981), size: 16),
                  const SizedBox(width: 6),
                  Text('Captured',
                      style: GoogleFonts.inter(
                          color: const Color(0xFF10B981), fontSize: 12,
                          fontWeight: FontWeight.w700)),
                ]),
              ] else
                Text('Capture a clear photo of the installed ONT router.',
                    style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.4)),
              const SizedBox(height: 10),
              _wPrimaryBtn(
                _routerPhotoPath != null ? 'Retake Router Photo' : 'Capture Router Photo',
                icon: Icons.camera_alt_rounded,
                onPressed: () => _captureProofPhoto(routerPhoto: true),
              ),
            ]),
          ),
          const SizedBox(height: 12),
          // Cable photo — always visible
          _wCard(
            borderColor: _cablePhotoPath != null
                ? const Color(0xFF10B981).withValues(alpha: 0.4)
                : null,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('CABLE / SPLITTER PHOTO'),
              const SizedBox(height: 10),
              if (_cablePhotoPath != null) ...[
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(File(_cablePhotoPath!),
                      height: 180, width: double.infinity, fit: BoxFit.cover),
                ),
                const SizedBox(height: 10),
                Row(children: [
                  const Icon(Icons.check_circle_rounded,
                      color: Color(0xFF10B981), size: 16),
                  const SizedBox(width: 6),
                  Text('Captured',
                      style: GoogleFonts.inter(
                          color: const Color(0xFF10B981), fontSize: 12,
                          fontWeight: FontWeight.w700)),
                ]),
              ] else
                Text('Capture a clear photo of the fiber cable and splitter connection.',
                    style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.4)),
              const SizedBox(height: 10),
              _wPrimaryBtn(
                _cablePhotoPath != null ? 'Retake Cable Photo' : 'Capture Cable Photo',
                icon: Icons.camera_alt_rounded,
                onPressed: () => _captureProofPhoto(routerPhoto: false),
              ),
            ]),
          ),
        ]),
      ),
      _wizBottomBar(Column(mainAxisSize: MainAxisSize.min, children: [
        if (proofUploaded && !_hasCapturedProofPhotos())
          // Already uploaded, no new photos — go straight to OTP
          _wPrimaryBtn('Proceed to OTP Verification',
              icon: Icons.verified_rounded,
              color: const Color(0xFF10B981),
              onPressed: () => setState(() => _wizardStep = 6))
        else
          // Upload (or re-upload) with captured photos
          _wPrimaryBtn(
            _hasCapturedProofPhotos() ? 'Submit Proof Photos' : 'Capture Photos First',
            icon: Icons.cloud_upload_rounded,
            onPressed: canSubmit && !_busy
                ? () async {
                    await _submitCapturedProof();
                    if (mounted) setState(() => _wizardStep = 6);
                  }
                : null,
          ),
      ])),
    ]);
  }

  // ── Step 6 (Install): OTP + Complete ────────────────────────────────────

  Widget _wizStepOtp(String status, String configStatus, bool proofUploaded,
      bool activationLive, String phone) {
    final canSend = _canSendInstallOtp(status, proofUploaded);

    return StatefulBuilder(builder: (context, setLocal) {
      return Stack(children: [
        SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 150),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('STEP 1 – SEND OTP TO CUSTOMER'),
              const SizedBox(height: 8),
              Text(
                'An OTP will be sent to the customer\'s registered mobile number${phone.isNotEmpty ? ' (+91 $phone)' : ''}. Ask the customer to share it with you.',
                style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.5),
              ),
              const SizedBox(height: 12),
              _wPrimaryBtn('Send OTP to Customer',
                  icon: Icons.sms_rounded,
                  onPressed: canSend && !_busy
                      ? () async {
                          setState(() => _busy = true);
                          try {
                            final demo = await _appState.api.sendCompletionOtp(
                                _appState.session!, widget.job.id);
                            setLocal(() {});
                            if (demo != null && demo.isNotEmpty && mounted) {
                              _show('OTP sent. Demo OTP: $demo');
                            } else {
                              _show('OTP sent to customer');
                            }
                          } catch (e) {
                            _show(e.toString());
                          } finally {
                            if (mounted) setState(() => _busy = false);
                          }
                        }
                      : null),
            ])),
            const SizedBox(height: 12),
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('STEP 2 – ENTER OTP'),
              const SizedBox(height: 8),
              TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                style: GoogleFonts.inter(
                    color: kText, fontSize: 22, fontWeight: FontWeight.w900,
                    letterSpacing: 6),
                decoration: InputDecoration(
                  hintText: '------',
                  hintStyle: GoogleFonts.inter(color: kSubtle, letterSpacing: 6),
                  filled: true, fillColor: kSurface2, counterText: '',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 16),
                ),
                onChanged: (_) => setLocal(() {}),
              ),
            ])),
            const SizedBox(height: 12),
            _wCard(
              borderColor: const Color(0xFF10B981).withValues(alpha: 0.3),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(Icons.info_outline_rounded,
                      color: Color(0xFF10B981), size: 16),
                  const SizedBox(width: 8),
                  Text('Ready to complete?',
                      style: GoogleFonts.inter(
                          color: kText, fontSize: 13, fontWeight: FontWeight.w800)),
                ]),
                const SizedBox(height: 6),
                ...['Internet is live ✓',
                  'Proof photos uploaded ✓',
                  'Enter 6-digit OTP from customer'].map((item) => Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(
                      item.endsWith('✓')
                          ? Icons.check_circle_rounded
                          : Icons.radio_button_unchecked_rounded,
                      color: item.endsWith('✓')
                          ? const Color(0xFF10B981)
                          : kSubtle,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Expanded(child: Text(item.replaceAll(' ✓', ''),
                        style: GoogleFonts.inter(color: kMuted, fontSize: 12))),
                  ]),
                )),
              ]),
            ),
          ]),
        ),
        _wizBottomBar(_wPrimaryBtn(
          'Complete Installation',
          icon: Icons.celebration_rounded,
          color: const Color(0xFF10B981),
          onPressed: _canCompleteInstall(
                  status, _otpController.text.trim(), proofUploaded, activationLive) &&
              !_busy
              ? _completeInstallationFlow
              : null,
        )),
      ]);
    });
  }

  // ── Step 3 (Complaint): Resolution ───────────────────────────────────────

  Widget _wizStepComplaintResolution(
      String status, Map<String, dynamic>? detail) {
    final complaint =
        (detail?['complaint'] as Map?)?.cast<String, dynamic>() ?? {};
    final existingCode = (complaint['resolutionCode'] ?? '').toString();
    final canReboot = _canRebootComplaint(
        status, (complaint['otpPurpose'] ?? '').toString());
    final canReplace = _canReplaceOnt(status);

    return StatefulBuilder(builder: (context, setLocal) {
      return Stack(children: [
        SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 160),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // Resolution code picker
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('RESOLUTION TYPE'),
              const SizedBox(height: 8),
              ..._complaintResolutionCodes.map((code) {
                final selected = code == _complaintResolutionCode;
                return GestureDetector(
                  onTap: () => setState(() => _complaintResolutionCode = code),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: selected
                          ? kPrimary.withValues(alpha: 0.15)
                          : kSurface2,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: selected
                              ? kPrimaryLight.withValues(alpha: 0.5)
                              : kBorder),
                    ),
                    child: Row(children: [
                      Icon(
                        selected
                            ? Icons.radio_button_checked_rounded
                            : Icons.radio_button_unchecked_rounded,
                        color: selected ? kPrimaryLight : kSubtle, size: 18,
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(
                        code.replaceAll('_', ' ').toUpperCase(),
                        style: GoogleFonts.inter(
                            color: selected ? kPrimaryLight : kText,
                            fontSize: 13, fontWeight: FontWeight.w700),
                      )),
                    ]),
                  ),
                );
              }),
            ])),
            const SizedBox(height: 12),
            // Complaint note
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('FIELD NOTE'),
              const SizedBox(height: 8),
              TextField(
                controller: _complaintNoteController,
                maxLines: 3,
                style: GoogleFonts.inter(color: kText, fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Describe the issue and fix applied…',
                  hintStyle: GoogleFonts.inter(color: kSubtle, fontSize: 13),
                  filled: true, fillColor: kSurface2,
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.all(14),
                ),
                onChanged: (_) => setLocal(() {}),
              ),
            ])),
            // Reboot ONT
            if (canReboot) ...[
              const SizedBox(height: 12),
              _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _wLabel('REBOOT ONT'),
                const SizedBox(height: 6),
                Text('Remotely reboot the customer\'s ONT router to resolve soft faults.',
                    style: GoogleFonts.inter(color: kMuted, fontSize: 12, height: 1.4)),
                const SizedBox(height: 10),
                if (_rebootCountdown > 0)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                        color: kSurface2, borderRadius: BorderRadius.circular(12)),
                    child: Row(children: [
                      const Icon(Icons.refresh_rounded,
                          color: kPrimaryLight, size: 18),
                      const SizedBox(width: 10),
                      Text('Rebooting… ${_rebootCountdown}s',
                          style: GoogleFonts.inter(
                              color: kPrimaryLight, fontSize: 13,
                              fontWeight: FontWeight.w700)),
                    ]),
                  )
                else
                  _wPrimaryBtn('Reboot ONT Router',
                      icon: Icons.restart_alt_rounded,
                      onPressed: _busy
                          ? null
                          : () async {
                              await _run(
                                  () => _appState.api.rebootComplaintDevice(
                                      _appState.session!, widget.job.id),
                                  'ONT reboot triggered');
                              if (mounted) _startRebootCountdown();
                            }),
              ])),
            ],
            // Replace ONT
            if (canReplace) ...[
              const SizedBox(height: 12),
              _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _wLabel('REPLACE ONT (if faulty)'),
                const SizedBox(height: 8),
                TextField(
                  controller: _replaceSerialController,
                  textCapitalization: TextCapitalization.characters,
                  style: GoogleFonts.inter(color: kText, fontSize: 14,
                      fontWeight: FontWeight.w700),
                  decoration: InputDecoration(
                    hintText: 'New ONT serial number',
                    hintStyle: GoogleFonts.inter(color: kSubtle),
                    filled: true, fillColor: kSurface2,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                  ),
                  onChanged: (_) => setLocal(() {}),
                ),
                const SizedBox(height: 10),
                _wPrimaryBtn('Replace ONT',
                    icon: Icons.swap_horiz_rounded,
                    onPressed: _busy ||
                            _replaceSerialController.text.trim().isEmpty
                        ? null
                        : () => _run(
                            () => _appState.api.replaceDevice(
                                _appState.session!, widget.job.id,
                                newSerialNumber:
                                    _replaceSerialController.text.trim(),
                                reason: _complaintResolutionCode),
                            'ONT replaced')),
              ])),
            ],
            const SizedBox(height: 8),
            if (existingCode.isNotEmpty)
              _wCard(
                borderColor: const Color(0xFF10B981).withValues(alpha: 0.3),
                child: Row(children: [
                  const Icon(Icons.check_circle_rounded,
                      color: Color(0xFF10B981), size: 18),
                  const SizedBox(width: 10),
                  Expanded(child: Text(
                    'Resolution logged: ${existingCode.replaceAll('_', ' ').toUpperCase()}',
                    style: GoogleFonts.inter(
                        color: kText, fontSize: 13, fontWeight: FontWeight.w700),
                  )),
                ]),
              ),
          ]),
        ),
        _wizBottomBar(Column(mainAxisSize: MainAxisSize.min, children: [
          _wPrimaryBtn('Log Resolution & Get OTP',
              icon: Icons.arrow_forward_rounded,
              onPressed: _busy
                  ? null
                  : () async {
                      final note = _complaintNoteController.text.trim();
                      await _run(
                          () => _appState.api.startComplaint(
                              _appState.session!, widget.job.id,
                              resolutionCode: _complaintResolutionCode,
                              note: note.isEmpty
                                  ? 'Resolution: $_complaintResolutionCode'
                                  : note),
                          'Resolution logged');
                      if (mounted) setState(() => _wizardStep = 4);
                    }),
        ])),
      ]);
    });
  }

  // ── Step 4 (Complaint): OTP + Resolve ────────────────────────────────────

  Widget _wizStepComplaintOtp(String status, String phone) {
    final canSend = _canSendComplaintOtp(status);
    final canResolve = _canResolveComplaint(status, _otpController.text.trim());

    return StatefulBuilder(builder: (context, setLocal) {
      return Stack(children: [
        SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 150),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('STEP 1 – SEND OTP TO CUSTOMER'),
              const SizedBox(height: 8),
              Text(
                'An OTP will be sent to the customer\'s registered mobile${phone.isNotEmpty ? ' (+91 $phone)' : ''}. Ask the customer to share it with you.',
                style: GoogleFonts.inter(color: kMuted, fontSize: 13, height: 1.5),
              ),
              const SizedBox(height: 12),
              _wPrimaryBtn('Send OTP to Customer',
                  icon: Icons.sms_rounded,
                  onPressed: canSend && !_busy
                      ? () async {
                          setState(() => _busy = true);
                          try {
                            final demo = await _appState.api.sendComplaintOtp(
                                _appState.session!, widget.job.id);
                            setLocal(() {});
                            if (demo != null && demo.isNotEmpty && mounted) {
                              _show('OTP sent. Demo OTP: $demo');
                            } else {
                              _show('OTP sent to customer');
                            }
                          } catch (e) {
                            _show(e.toString());
                          } finally {
                            if (mounted) setState(() => _busy = false);
                          }
                        }
                      : null),
            ])),
            const SizedBox(height: 12),
            _wCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _wLabel('STEP 2 – ENTER OTP FROM CUSTOMER'),
              const SizedBox(height: 8),
              TextField(
                controller: _otpController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                style: GoogleFonts.inter(
                    color: kText, fontSize: 22, fontWeight: FontWeight.w900,
                    letterSpacing: 6),
                decoration: InputDecoration(
                  hintText: '------',
                  hintStyle: GoogleFonts.inter(color: kSubtle, letterSpacing: 6),
                  filled: true, fillColor: kSurface2, counterText: '',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 16),
                ),
                onChanged: (_) => setLocal(() {}),
              ),
            ])),
            const SizedBox(height: 12),
            _wCard(
              borderColor: const Color(0xFF10B981).withValues(alpha: 0.3),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  const Icon(Icons.verified_rounded,
                      color: Color(0xFF10B981), size: 16),
                  const SizedBox(width: 8),
                  Text('Almost done!',
                      style: GoogleFonts.inter(
                          color: kText, fontSize: 13, fontWeight: FontWeight.w800)),
                ]),
                const SizedBox(height: 6),
                Text(
                  'Once the customer confirms the resolution is complete, enter the OTP and tap "Resolve Complaint" below.',
                  style: GoogleFonts.inter(color: kMuted, fontSize: 12, height: 1.5),
                ),
              ]),
            ),
          ]),
        ),
        _wizBottomBar(_wPrimaryBtn(
          'Resolve Complaint',
          icon: Icons.verified_rounded,
          color: const Color(0xFF10B981),
          onPressed: canResolve && !_busy ? _resolveComplaintFlow : null,
        )),
      ]);
    });
  }

  Widget _chip(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: kBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: kMuted, fontSize: 12)),
          const SizedBox(height: 4),
          Text(value,
              style:
                  const TextStyle(color: kText, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _miniPill(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: kBorder),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: kText,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _row(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(color: kMuted)),
          ),
          if (valueColor != null) ...[
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 4, right: 6),
              decoration: BoxDecoration(color: valueColor, shape: BoxShape.circle),
            ),
          ],
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: TextStyle(color: valueColor ?? kText, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  static Color _opticalPowerColor(String text) {
    final val = double.tryParse(text.replaceAll(RegExp(r'[^\d.\-]'), ''));
    if (val == null) return kMuted;
    if (val >= -22) return const Color(0xFF10B981); // good
    if (val >= -26) return const Color(0xFFF59E0B); // marginal
    return const Color(0xFFEF4444); // bad
  }

  Widget _proofPreviewCard(String label, String path) {
    return Container(
      width: 140,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: kSurface2,
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
                  color: kSurface2,
                  alignment: Alignment.center,
                  child: const Icon(Icons.image_not_supported_rounded,
                      color: kMuted),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(color: kText, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  Widget _blockerPanel({required String title, required List<String> items}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0x22F59E0B),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0x66F59E0B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: const Color(0xFFFBBF24),
                  fontWeight: FontWeight.w900,
                ),
          ),
          const SizedBox(height: 10),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline_rounded,
                      color: Color(0xFFFBBF24), size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      item,
                      style: const TextStyle(color: kMuted, height: 1.35),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _nextActionCard(
    BuildContext context, {
    required String status,
    required String configStatus,
    required String resumeStage,
    required Map<String, dynamic> activationRuntime,
    required Map<String, dynamic> complaintRuntime,
    required bool isComplaint,
    required bool activationLive,
    required bool canAccept,
    required bool canStartTravel,
    required bool canStartOnsite,
    required bool canActivate,
    required bool canRetry,
    required bool canStartComplaint,
    required bool canReplaceOnt,
    required bool canRebootComplaint,
    required bool canSendComplaintOtp,
    required bool canResolveComplaint,
    required bool canSubmitProof,
    required bool canSendInstallOtp,
    required bool canCompleteInstall,
    required bool proofUploaded,
  }) {
    final nextLabel = isComplaint
        ? _nextComplaintActionLabel(
            status: status,
            canAccept: canAccept,
            canStartTravel: canStartTravel,
            canStartOnsite: canStartOnsite,
            canStartComplaint: canStartComplaint,
            canReplaceOnt: canReplaceOnt,
            canRebootComplaint: canRebootComplaint,
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
    final complaintStageLabel =
        (complaintRuntime['stageLabel'] ?? '').toString().trim();
    final complaintOperatorMessage =
        (complaintRuntime['operatorMessage'] ?? '').toString().trim();
    final complaintFailureCode =
        (complaintRuntime['failureCode'] ?? '').toString().trim();
    final complaintRecommendedActions = (complaintRuntime['recommendedActions']
                as List?)
            ?.map((item) => item.toString().trim())
            .where((item) => item.isNotEmpty)
            .toList() ??
        const <String>[];
    final activationHeadline =
        isComplaint ? '' : _activationProgressHeadline(status, configStatus, activationLive);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0x558224E3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isComplaint && complaintOperatorMessage.isNotEmpty
                ? complaintOperatorMessage
                : nextSubtitle,
            style: const TextStyle(color: kMuted, height: 1.45),
          ),
          if (isComplaint &&
              (complaintStageLabel.isNotEmpty ||
                  complaintRecommendedActions.isNotEmpty ||
                  complaintFailureCode.isNotEmpty)) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: kSurface2,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0x228224E3)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (complaintStageLabel.isNotEmpty) ...[
                    _row('Complaint stage', complaintStageLabel),
                    const SizedBox(height: 10),
                  ],
                  if (complaintFailureCode.isNotEmpty) ...[
                    _row(
                      'Current hold point',
                      _complaintFailureLabel(complaintFailureCode),
                    ),
                    const SizedBox(height: 10),
                  ],
                  if (complaintRecommendedActions.isNotEmpty) ...[
                    ...complaintRecommendedActions.map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.chevron_right_rounded,
                                size: 16, color: kPrimaryLight),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                item,
                                style: const TextStyle(
                                  color: kMuted,
                                  fontSize: 12,
                                  height: 1.4,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
          if (!isComplaint && activationHeadline != 'Activation workflow idle') ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _activationStageChips(status, configStatus, activationLive),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton(
                onPressed: _busy
                    ? null
                    : () => _handleNextPrimaryAction(
                        status, configStatus, isComplaint, proofUploaded),
                child: Text(nextLabel),
              ),
              if (!isComplaint &&
                  (status == 'onsite' ||
                      status == 'ont_scanned' ||
                      status == 'failed'))
                OutlinedButton(
                  onPressed: _busy
                      ? null
                      : () => _scanSerial(
                            controller: _serialController,
                            title: 'Scan ONT serial',
                            subtitle:
                                'Scan the router barcode or QR code to auto-fill the ONT serial before activation.',
                            refreshOntDetails: true,
                          ),
                  child: const Text('Scan serial'),
                ),
            ],
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
            done
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked_rounded,
            size: 18,
            color: done ? kPrimaryLight : kMuted,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style:
                  const TextStyle(color: kMuted, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _headerBadge(String text, Color bgColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: GoogleFonts.inter(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Color _statusBadgeColor(String status) {
    switch (status) {
      case 'completed':
        return const Color(0x5510B981);
      case 'active':
        return const Color(0x558B5CF6);
      case 'deferred':
        return const Color(0x55F59E0B);
      case 'cancelled':
        return const Color(0x55EF4444);
      default:
        return Colors.white.withValues(alpha: 0.15);
    }
  }

  Widget _quickActionBtn({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.inter(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _canAccept(String status) => status == 'assigned';

  bool _canStartTravel(String status) => status == 'accepted';

  bool _canStartOnsite(String status) => status == 'enroute';

  bool _canActivate(String status) =>
      ['onsite', 'ont_scanned', 'failed'].contains(status);

  bool _canRetry(String status, String configStatus) {
    if (['failed', 'ont_scanned', 'activation_in_progress'].contains(status)) {
      return configStatus != 'verified';
    }
    return ['pending', 'failed', 'pushed', 'retried'].contains(configStatus);
  }

  bool _canRepushConfig(String status) => status == 'active';

  bool _canStartComplaint(String status) =>
      ['assigned', 'accepted', 'enroute', 'onsite'].contains(status);

  bool _canReplaceOnt(String status) =>
      ['onsite', 'complaint_in_progress', 'ont_scanned'].contains(status);

  bool _canRebootComplaint(String status, String otpPurpose) =>
      ['onsite', 'complaint_in_progress'].contains(status) &&
      otpPurpose != 'complaint_complete';

  bool _canSendComplaintOtp(String status) =>
      ['complaint_in_progress', 'onsite', 'active'].contains(status);

  bool _canResolveComplaint(String status, String otp) =>
      ['complaint_in_progress', 'active', 'onsite'].contains(status) &&
      otp.length == 6;

  bool _canSubmitProof(
          String status, bool proofPhotosReady, bool activationLive) =>
      ['active', 'activation_in_progress'].contains(status) &&
      activationLive &&
      proofPhotosReady;

  bool _canSendInstallOtp(String status, bool proofUploaded) =>
      ['active', 'activation_in_progress'].contains(status) && proofUploaded;

  bool _canCancelInstall(String status) =>
      !['completed', 'cancelled'].contains(status);

  bool _canCompleteInstall(
          String status, String otp, bool proofUploaded, bool activationLive) =>
      ['active', 'activation_in_progress'].contains(status) &&
      activationLive &&
      proofUploaded &&
      otp.length == 6;

  List<String> _missingInstallRequirements({
    required bool activationLive,
    required bool proofUploaded,
    required String otp,
  }) {
    final items = <String>[];
    if (!activationLive) {
      items.add(
          'Wait for the router to come online and internet activation to go live.');
    }
    if (!proofUploaded) {
      items.add(
          'Capture router and cable proof, then submit the proof payload.');
    }
    if (otp.trim().length != 6) {
      items.add('Collect and verify the 6-digit customer completion OTP.');
    }
    return items;
  }

  List<String> _activationBlockers({
    required String status,
    required String serial,
    required String pppoeUsername,
    required String wifiSsid24,
    required String wifiPassword,
  }) {
    final items = <String>[];
    if (!_canActivate(status)) {
      items.add('Move job to onsite stage before running router activation.');
    }
    if (serial.trim().isEmpty) {
      items.add('Scan or enter ONT serial number.');
    }
    if (pppoeUsername == '-' || pppoeUsername.trim().isEmpty) {
      items.add('Load provisioning preview so PPPoE username is ready.');
    }
    if (wifiSsid24 == '-' || wifiSsid24.trim().isEmpty) {
      items.add('Load provisioning preview so Wi-Fi SSID is ready.');
    }
    if (wifiPassword == '-' || wifiPassword.trim().isEmpty) {
      items.add('Load provisioning preview so Wi-Fi password is ready.');
    }
    return items;
  }

  List<String> _missingComplaintRequirements({
    required String status,
    required String otp,
  }) {
    final items = <String>[];
    if (!['complaint_in_progress', 'active', 'onsite'].contains(status)) {
      items.add(
          'Move the visit into an active complaint stage before closing it.');
    }
    if (otp.trim().length != 6) {
      items.add('Collect and verify the 6-digit complaint closure OTP.');
    }
    return items;
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
    if (canRetry) return _resumeActivationLabel(status);
    if (canActivate) return 'Run activation';
    if (canSubmitProof) return 'Submit proof';
    if (canSendInstallOtp) return 'Send OTP';
    if (canCompleteInstall) return 'Complete installation';
    if (status == 'completed') return 'Installation closed';
    return 'Wait for next update';
  }

  String _resumeActivationLabel(String status) {
    switch (status) {
      case 'failed':
        return 'Resume failed stage';
      case 'activation_in_progress':
        return 'Resume activation';
      case 'active':
        return 'Re-run activation checks';
      default:
        return 'Resume activation';
    }
  }

  String _nextComplaintActionLabel({
    required String status,
    required bool canAccept,
    required bool canStartTravel,
    required bool canStartOnsite,
    required bool canStartComplaint,
    required bool canReplaceOnt,
    required bool canRebootComplaint,
    required bool canSendComplaintOtp,
    required bool canResolveComplaint,
  }) {
    if (canAccept && status == 'assigned') return 'Accept complaint';
    if (canStartTravel && status == 'accepted') return 'Start travel';
    if (canStartOnsite && status == 'enroute') return 'Mark onsite';
    if (canStartComplaint && status == 'onsite') return 'Start complaint';
    if (canReplaceOnt) return 'Replace ONT';
    if (canRebootComplaint) return 'Reboot ONT';
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
        return 'Backend is applying Wi-Fi first, confirming it from the router, and then pushing PPPoE.';
      case 'active':
        return 'Capture proof, submit it, send OTP, and complete customer handover.';
      case 'completed':
        return 'Installation is closed. Review the proof, timeline, and final router details.';
      case 'deferred':
        return 'Visit is marked for follow-up. Review the defer reason and return plan.';
      default:
        return 'Continue the installation sequence from the next guided action.';
    }
  }

  String _activationProgressHeadline(
      String status, String configStatus, bool activationLive) {
    if (activationLive || status == 'active') {
      return 'Internet is live';
    }
    switch (configStatus) {
      case 'verified':
        return 'Activation verified';
      case 'pushed':
        return 'PPPoE pushed, waiting for internet';
      case 'pending':
      case 'retried':
        return 'Applying Wi-Fi before PPPoE';
      case 'failed':
        return 'Activation needs installer attention';
      default:
        if (status == 'ont_scanned' || status == 'onsite') {
          return 'Ready for activation';
        }
        return 'Activation workflow idle';
    }
  }

  String _complaintFailureLabel(String failureCode) {
    switch (failureCode) {
      case 'resolution_pending':
        return 'Issue type and field note';
      case 'replacement_serial_pending':
        return 'Replacement ONT serial';
      case 'otp_verification_pending':
        return 'Customer OTP verification';
      default:
        return failureCode.isEmpty ? '-' : failureCode.replaceAll('_', ' ');
    }
  }

  List<Widget> _activationStageChips(
      String status, String configStatus, bool activationLive) {
    final routerLinked = [
      'ont_scanned',
      'activation_in_progress',
      'active',
      'completed',
      'failed'
    ].contains(status);
    final wifiApplied = ['pending', 'retried', 'pushed', 'verified']
            .contains(configStatus) ||
        activationLive;
    final wifiVerified =
        ['pushed', 'verified'].contains(configStatus) || activationLive;
    final pppoeApplied =
        ['pushed', 'verified'].contains(configStatus) || activationLive;
    final live = activationLive || status == 'active';
    final items = [
      ('Router linked', routerLinked),
      ('Wi-Fi pushed', wifiApplied),
      ('Wi-Fi verified', wifiVerified),
      ('PPPoE pushed', pppoeApplied),
      ('Internet live', live),
    ];

    return items
        .map(
          (item) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: item.$2
                  ? kPrimary.withValues(alpha: 0.18)
                  : kBg,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: item.$2
                    ? const Color(0x558224E3)
                    : const Color(0x221F2937),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  item.$2
                      ? Icons.check_circle_rounded
                      : Icons.radio_button_unchecked_rounded,
                  size: 14,
                  color: item.$2 ? kPrimaryLight : kMuted,
                ),
                const SizedBox(width: 6),
                Text(
                  item.$1,
                  style: TextStyle(
                    color: item.$2 ? kPrimaryLight : kMuted,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        )
        .toList();
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
      case 'deferred':
        return 'Complaint visit is marked for follow-up. Review the defer reason and next action.';
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

  Future<void> _handleNextPrimaryAction(String status, String configStatus,
      bool isComplaint, bool proofUploaded) async {
    if (_busy) return;
    if (isComplaint) {
      if (_canAccept(status)) {
        await _run(
            () => _appState.api.acceptJob(_appState.session!, widget.job.id),
            'Complaint accepted');
        return;
      }
      if (_canStartTravel(status)) {
        await _run(
            () => _appState.api.startTravel(_appState.session!, widget.job.id),
            'Travel started');
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
          final otp = await _appState.api
              .sendComplaintOtp(_appState.session!, widget.job.id);
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
        await _resolveComplaintFlow();
        return;
      }
      final complaintRequirements = _missingComplaintRequirements(
        status: status,
        otp: _otpController.text.trim(),
      );
      if (complaintRequirements.isNotEmpty) {
        await _showRequirementsSheet(
          title: 'Complaint closeout pending',
          subtitle:
              'Before leaving the site, please finish these complaint closure steps.',
          items: complaintRequirements,
        );
        return;
      }
      _show('No complaint action available right now');
      return;
    }

    if (_canAccept(status)) {
      await _run(
          () => _appState.api.acceptJob(_appState.session!, widget.job.id),
          'Job accepted');
      return;
    }
    if (_canStartTravel(status)) {
      await _run(
          () => _appState.api.startTravel(_appState.session!, widget.job.id),
          'Travel started');
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
        'Resume requested',
      );
      return;
    }
    if (_canActivate(status)) {
      final serial = _serialController.text.trim();
      if (serial.isEmpty) {
        _show('Enter ONT serial first');
        return;
      }
      _startActivationCountdown(180);
      await _run(() => _appState.runActivationFlow(widget.job.id, serial),
          'Activation requested');
      return;
    }
    if (_canSubmitProof(
      status,
      _hasCapturedProofPhotos(),
      _isActivationLiveStatus(status, configStatus),
    )) {
      await _submitCapturedProof();
      return;
    }
    if (_canSendInstallOtp(status, proofUploaded)) {
      setState(() => _busy = true);
      try {
        final otp = await _appState.api
            .sendCompletionOtp(_appState.session!, widget.job.id);
        _show(otp == null ? 'Completion OTP sent' : 'Completion OTP: $otp');
        await _loadAll();
      } catch (e) {
        _show(e.toString());
      } finally {
        if (mounted) setState(() => _busy = false);
      }
      return;
    }
    if (_canCompleteInstall(
      status,
      _otpController.text.trim(),
      proofUploaded,
      _isActivationLiveStatus(status, configStatus),
    )) {
      await _completeInstallationFlow();
      return;
    }
    final installRequirements = _missingInstallRequirements(
      activationLive: _isActivationLiveStatus(status, configStatus),
      proofUploaded: proofUploaded,
      otp: _otpController.text.trim(),
    );
    if (installRequirements.isNotEmpty &&
        ['onsite', 'ont_scanned', 'activation_in_progress', 'active']
            .contains(status)) {
      await _showRequirementsSheet(
        title: 'Installation closeout pending',
        subtitle:
            'Before closing this job, please finish these handover steps.',
        items: installRequirements,
      );
      return;
    }
    _show('No installer action available right now');
  }

}
