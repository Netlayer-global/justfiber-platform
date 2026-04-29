import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

String installerFriendlyError(Object error) {
  final text =
      error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '').trim();
  if (text.contains('TimeoutException') || text.contains('timed out')) {
    return 'Server took too long to respond. Please retry.';
  }
  if (text.contains('SocketException') ||
      text.contains('Failed host lookup') ||
      text.contains('Connection refused') ||
      text.contains('Connection reset') ||
      text.contains('HandshakeException')) {
    return 'Unable to reach server right now. Check internet and retry.';
  }
  if (text.isEmpty) {
    return 'Something went wrong. Please retry.';
  }
  return text;
}

class InstallerApiClient {
  InstallerApiClient({required this.baseUrl});

  final String baseUrl;
  Future<String?> Function()? onUnauthorized;
  final http.Client _client = http.Client();

  Uri _uri(String path) =>
      Uri.parse('${baseUrl.replaceAll(RegExp(r'/$'), '')}$path');
  String _requestId() => 'installer-${DateTime.now().microsecondsSinceEpoch}';

  Future<dynamic> _request(
    String path, {
    String method = 'GET',
    String? token,
    Map<String, dynamic>? body,
    bool allowRetry = true,
    bool allowTransientRetry = true,
    Duration timeout = const Duration(seconds: 18),
  }) async {
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Client': 'justfiber-installer-app',
      'X-Request-ID': _requestId(),
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };

    Future<http.Response> send() {
      if (method == 'POST') {
        return _client
            .post(_uri(path), headers: headers, body: jsonEncode(body ?? {}))
            .timeout(timeout);
      }
      if (method == 'DELETE') {
        return _client.delete(_uri(path), headers: headers).timeout(timeout);
      }
      return _client.get(_uri(path), headers: headers).timeout(timeout);
    }

    late http.Response response;
    try {
      response = await send();
      if (method == 'GET' &&
          allowTransientRetry &&
          {502, 503, 504}.contains(response.statusCode)) {
        await Future<void>.delayed(const Duration(milliseconds: 650));
        response = await send();
      }
    } on TimeoutException {
      throw 'Server took too long to respond. Please retry.';
    } catch (_) {
      throw 'Unable to reach server right now. Check internet and retry.';
    }

    final payload = _decodeResponse(response);
    if (response.statusCode == 401 && allowRetry && onUnauthorized != null) {
      final refreshedToken = await onUnauthorized!.call();
      if (refreshedToken != null && refreshedToken.isNotEmpty) {
        return _request(
          path,
          method: method,
          token: refreshedToken,
          body: body,
          allowRetry: false,
          allowTransientRetry: allowTransientRetry,
          timeout: timeout,
        );
      }
    }
    if (response.statusCode >= 400 || payload['success'] == false) {
      final message = payload['error']?['message'] ??
          payload['message'] ??
          'Request failed (${response.statusCode})';
      throw installerFriendlyError(message);
    }
    return payload['data'];
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    if (response.body.trim().isEmpty) {
      return <String, dynamic>{'success': response.statusCode < 400};
    }
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) return decoded;
      return <String, dynamic>{
        'success': response.statusCode < 400,
        'data': decoded
      };
    } catch (_) {
      if (response.statusCode >= 500) {
        return <String, dynamic>{
          'success': false,
          'message': 'Server returned an invalid response. Please retry.'
        };
      }
      return <String, dynamic>{
        'success': false,
        'message': response.body.trim()
      };
    }
  }

  Map<String, dynamic> _asMap(dynamic data) =>
      data is Map<String, dynamic> ? data : <String, dynamic>{};
  List<dynamic> _asList(dynamic data) => data is List ? data : const [];

  // Handles address stored as plain string or as {fullAddress, pinCode} map
  String _extractAddress(dynamic raw) {
    if (raw == null) return '-';
    if (raw is Map) {
      final full = raw['fullAddress']?.toString() ?? '';
      final pin = raw['pinCode']?.toString() ?? '';
      final parts = [full, if (pin.isNotEmpty && pin != '0000') pin];
      return parts.where((p) => p.isNotEmpty).join(', ');
    }
    final s = raw.toString().trim();
    return s.isEmpty ? '-' : s;
  }

  Future<InstallerSession> login(String login, String password) async {
    final data = _asMap(await _request('/api/v1/installer/auth/login',
        method: 'POST', body: {'login': login, 'password': password}));
    return InstallerSession(
      login: login,
      accessToken: (data['accessToken'] ?? '').toString(),
      refreshToken: (data['refreshToken'] ?? '').toString(),
    );
  }

  Future<String> refreshInstallerSession(String refreshToken) async {
    final data = _asMap(
      await _request(
        '/api/v1/installer/auth/refresh',
        method: 'POST',
        body: {'refreshToken': refreshToken},
        allowRetry: false,
      ),
    );
    return (data['accessToken'] ?? '').toString();
  }

  Future<InstallerDashboard> fetchDashboard(InstallerSession session) async {
    final data = _asMap(await _request('/api/v1/installer/dashboard',
        token: session.accessToken));
    return InstallerDashboard(
      todayNewInstallationJobs:
          int.tryParse('${data['todayNewInstallationJobs'] ?? 0}') ?? 0,
      pendingJobs: int.tryParse('${data['pendingJobs'] ?? 0}') ?? 0,
      completedJobs: int.tryParse('${data['completedJobs'] ?? 0}') ?? 0,
      availabilityStatus: (data['availabilityStatus'] ?? '-').toString(),
    );
  }

  Future<InstallerProfile> fetchProfile(InstallerSession session) async {
    final data = _asMap(await _request('/api/v1/installer/profile',
        token: session.accessToken));
    return InstallerProfile(
      fullName: (data['fullName'] ?? '').toString(),
      installerCode: (data['installerCode'] ?? '-').toString(),
      phone: (data['phone'] ?? '-').toString(),
      availabilityStatus: (data['availabilityStatus'] ?? '-').toString(),
    );
  }

  Future<List<InstallerJob>> fetchJobs(InstallerSession session) async {
    final list = _asList(
        await _request('/api/v1/installer/jobs', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return InstallerJob(
        id: (map['_id'] ?? map['id'] ?? '').toString(),
        jobNumber: (map['jobNumber'] ?? '-').toString(),
        status: (map['status'] ?? 'assigned').toString(),
        subStatus: (map['subStatus'] ?? '').toString(),
        customerName:
            (map['customerSnapshot']?['fullName'] ??
             map['customerName'] ??
             map['customer']?['fullName'] ?? '-')
                .toString(),
        customerPhone: (map['customerSnapshot']?['phone'] ?? map['phone'] ?? '')
            .toString(),
        customerAddress: _extractAddress(
            map['customerSnapshot']?['address'] ??
            map['customerAddress'] ??
            map['serviceAddress']),
        planName: (map['customerSnapshot']?['planName'] ?? '').toString(),
        planCode: (map['customerSnapshot']?['planCode'] ?? '').toString(),
        planCategory:
            (map['customerSnapshot']?['planCategory'] ?? 'home').toString(),
        monthlyPrice: double.tryParse(
                '${map['customerSnapshot']?['monthlyPrice'] ?? 0}') ??
            0,
        downloadSpeedMbps:
            double.tryParse('${map['customerSnapshot']?['speedMbps'] ?? 0}') ??
                0,
        uploadSpeedMbps: double.tryParse(
                '${map['customerSnapshot']?['uploadSpeedMbps'] ?? 0}') ??
            0,
        dataLimitGb: double.tryParse(
                '${map['customerSnapshot']?['dataLimitGb'] ?? 0}') ??
            0,
        fupSpeedMbps: double.tryParse(
                '${map['customerSnapshot']?['fupSpeedMbps'] ?? 0}') ??
            0,
        dataPolicy:
            (map['customerSnapshot']?['dataPolicy'] ?? 'unlimited').toString(),
        otcCharge:
            double.tryParse('${map['customerSnapshot']?['otcCharge'] ?? 0}') ??
                0,
        installationCharge: double.tryParse(
                '${map['customerSnapshot']?['installationCharge'] ?? 0}') ??
            0,
        tags: _asList(map['customerSnapshot']?['tags'])
            .map((item) => item.toString())
            .where((item) => item.isNotEmpty)
            .toList(),
        staticBenefits: _asList(map['customerSnapshot']?['staticBenefits'])
            .map((item) => item.toString())
            .where((item) => item.isNotEmpty)
            .toList(),
        jobType: (map['jobType'] ?? map['type'] ?? 'installation').toString(),
        priority: (map['priority'] ?? 'medium').toString(),
        scheduledAt:
            (map['scheduledDate'] ?? map['assignment']?['assignedAt'] ?? '')
                .toString(),
        latestEventCode:
            ((map['timeline'] is List && (map['timeline'] as List).isNotEmpty)
                        ? ((map['timeline'] as List).last
                            as Map<String, dynamic>)['event']
                        : '')
                    ?.toString() ??
                '',
        configStatus: (map['activation']?['configStatus'] ?? '').toString(),
        finalSerialNumber: (map['deviceContext']?['finalSerialNumber'] ??
                map['deviceContext']?['manualSerialNumber'] ??
                '')
            .toString(),
        rxPowerText: (map['opticalReadings']?['rxPower'] ??
                map['opticalReadings']?['opticalRxPower'] ??
                map['opticalReadings']?['receivedPower'] ??
                '')
            .toString(),
        opticalHealth: (map['opticalReadings']?['healthStatus'] ??
                map['opticalReadings']?['opticalHealth'] ??
                map['opticalReadings']?['status'] ??
                '')
            .toString(),
        latitude: double.tryParse(
            '${map['customerSnapshot']?['location']?['lat'] ?? ''}'),
        longitude: double.tryParse(
            '${map['customerSnapshot']?['location']?['lng'] ?? ''}'),
        mapUrl:
            (map['customerSnapshot']?['location']?['mapUrl'] ?? '').toString(),
        deferNote: (map['deviceContext']?['deferNote'] ?? '').toString(),
        cancelNote: (map['deviceContext']?['cancelNote'] ?? '').toString(),
        complaintCategory:
            (map['complaint']?['category'] ?? '').toString(),
        complaintDescription:
            (map['complaint']?['description'] ?? '').toString(),
      );
    }).toList();
  }

  Future<Map<String, dynamic>> fetchJobDetail(
      InstallerSession session, String jobId) async {
    return _asMap(await _request('/api/v1/installer/jobs/$jobId',
        token: session.accessToken));
  }

  Future<ProvisioningPreview> fetchProvisioningPreview(
      InstallerSession session, String jobId) async {
    final data = _asMap(await _request(
        '/api/v1/installer/jobs/$jobId/provisioning-preview',
        token: session.accessToken));
    final credentials =
        _asMap(data['preparedCredentials'] ?? data['credentials']);
    final pppoe = _asMap(credentials['pppoe']);
    final wifi = _asMap(credentials['wifi']);
    final planSummary = _asMap(data['planSummary']);
    return ProvisioningPreview(
      brand: (credentials['brand'] ?? data['ontBrand'] ?? 'generic').toString(),
      pppoeUsername:
          (pppoe['username'] ?? data['pppoeUsername'] ?? '').toString(),
      pppoePassword:
          (pppoe['password'] ?? data['pppoePassword'] ?? '').toString(),
      ssid24: (wifi['ssid24'] ?? '').toString(),
      ssid5: (wifi['ssid5'] ?? '').toString(),
      wifiPassword: (wifi['password'] ?? '').toString(),
      vlanId: int.tryParse('${credentials['vlanId'] ?? 100}') ?? 100,
      planCode: (planSummary['planCode'] ?? '').toString(),
      planName: (planSummary['planName'] ?? '').toString(),
      planCategory: (planSummary['category'] ?? 'home').toString(),
      monthlyPrice: double.tryParse('${planSummary['monthlyPrice'] ?? 0}') ?? 0,
      downloadSpeedMbps:
          double.tryParse('${planSummary['speedMbps'] ?? 0}') ?? 0,
      uploadSpeedMbps:
          double.tryParse('${planSummary['uploadSpeedMbps'] ?? 0}') ?? 0,
      dataLimitGb: double.tryParse('${planSummary['dataLimitGb'] ?? 0}') ?? 0,
      fupSpeedMbps: double.tryParse('${planSummary['fupSpeedMbps'] ?? 0}') ?? 0,
      dataPolicy: (planSummary['dataPolicy'] ?? 'unlimited').toString(),
      otcCharge: double.tryParse('${planSummary['otcCharge'] ?? 0}') ?? 0,
      installationCharge:
          double.tryParse('${planSummary['installationCharge'] ?? 0}') ?? 0,
      tags: _asList(planSummary['tags'])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList(),
      staticBenefits: _asList(planSummary['staticBenefits'])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList(),
      features: _asList(planSummary['features'])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList(),
    );
  }

  Future<List<InstallerNotificationItem>> fetchNotifications(
      InstallerSession session) async {
    final list = _asList(await _request('/api/v1/installer/notifications',
        token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return InstallerNotificationItem(
        id: (map['_id'] ?? '').toString(),
        type: (map['type'] ?? 'notification').toString(),
        title: (map['title'] ?? 'Notification').toString(),
        body: (map['body'] ?? map['message'] ?? '').toString(),
        createdAt: DateTime.tryParse('${map['createdAt'] ?? ''}'),
        readAt: DateTime.tryParse('${map['readAt'] ?? ''}'),
        payload: _asMap(map['payload']),
      );
    }).toList();
  }

  Future<List<InstallerFaultAlert>> fetchFaultAlerts(
      InstallerSession session) async {
    final list = _asList(await _request('/api/v1/installer/fault-alerts',
        token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return InstallerFaultAlert(
        id: (map['alertId'] ?? map['_id'] ?? '').toString(),
        kind: (map['kind'] ?? '').toString(),
        severity: (map['severity'] ?? 'info').toString(),
        title: (map['title'] ?? 'Fault alert').toString(),
        message: (map['message'] ?? '').toString(),
        pathId: (map['pathId'] ?? '').toString(),
        assetId: (map['assetId'] ?? '').toString(),
        affectedAssets:
            int.tryParse('${map['affectedAssets'] ?? 0}') ?? 0,
        affectedCustomers:
            int.tryParse('${map['affectedCustomers'] ?? 0}') ?? 0,
        rxPower: double.tryParse('${map['rxPower'] ?? ''}'),
        status: (map['status'] ?? '').toString(),
        createdAt: DateTime.tryParse('${map['createdAt'] ?? ''}'),
        impactedItems: _asList(map['impactedItems'])
            .whereType<Map>()
            .map((entry) => Map<String, dynamic>.from(entry))
            .toList(),
      );
    }).toList();
  }

  Future<void> acceptJob(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/accept',
        method: 'POST', token: session.accessToken);
  }

  Future<void> startTravel(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/start-travel',
        method: 'POST', token: session.accessToken);
  }

  Future<void> startOnsite(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/start-onsite',
        method: 'POST', token: session.accessToken);
  }

  Future<Map<String, dynamic>> deferJob(
    InstallerSession session,
    String jobId, {
    required String reason,
    required String note,
  }) async {
    return _asMap(
      await _request(
        '/api/v1/installer/jobs/$jobId/defer',
        method: 'POST',
        token: session.accessToken,
        body: {'reason': reason, 'note': note},
      ),
    );
  }

  Future<Map<String, dynamic>> resumeFollowUp(
      InstallerSession session, String jobId) async {
    return _asMap(
      await _request(
        '/api/v1/installer/jobs/$jobId/resume-follow-up',
        method: 'POST',
        token: session.accessToken,
      ),
    );
  }

  Future<Map<String, dynamic>> cancelInstallation(
    InstallerSession session,
    String jobId, {
    required String reason,
    required String note,
  }) async {
    return _asMap(
      await _request(
        '/api/v1/installer/jobs/$jobId/cancel-installation',
        method: 'POST',
        token: session.accessToken,
        body: {'reason': reason, 'note': note},
      ),
    );
  }

  Future<void> checkinLocation(
    InstallerSession session,
    String jobId, {
    required double lat,
    required double lng,
    required String address,
  }) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/checkin-location',
      method: 'POST',
      token: session.accessToken,
      body: {'lat': lat, 'lng': lng, 'address': address},
    );
  }

  Future<void> setManualSerial(
      InstallerSession session, String jobId, String serial) async {
    await _request('/api/v1/installer/jobs/$jobId/manual-serial',
        method: 'POST',
        token: session.accessToken,
        body: {'serialNumber': serial});
  }

  Future<void> checkOptical(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/check-optical',
        method: 'POST',
        token: session.accessToken,
        body: {'rxPower': '-19.5', 'txPower': '1.2'});
  }

  Future<void> saveChecklist(InstallerSession session, String jobId) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/save-checklist',
      method: 'POST',
      token: session.accessToken,
      body: {
        'fiberLinked': true,
        'powerLevelOk': true,
        'wanConfigured': true,
        'wifiConfigured': true,
        'speedTestDone': true,
        'customerEducated': true,
        'notes': 'Checklist completed from installer app',
      },
    );
  }

  Future<void> activate(InstallerSession session, String jobId) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/activate',
      method: 'POST',
      token: session.accessToken,
      timeout: const Duration(seconds: 35),
    );
  }

  Future<Map<String, dynamic>> fetchDiagnostics(
      InstallerSession session, String jobId) async {
    return _asMap(await _request('/api/v1/installer/jobs/$jobId/diagnostics',
        token: session.accessToken));
  }

  Future<String?> sendCompletionOtp(
      InstallerSession session, String jobId) async {
    final data = _asMap(await _request(
        '/api/v1/installer/jobs/$jobId/send-completion-otp',
        method: 'POST',
        token: session.accessToken));
    final otp = data['demoOtp']?.toString();
    return otp == null || otp.isEmpty ? null : otp;
  }

  Future<void> verifyCompletionOtp(
      InstallerSession session, String jobId, String otp) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/verify-completion-otp',
      method: 'POST',
      token: session.accessToken,
      body: {'otp': otp},
    );
  }

  Future<Map<String, dynamic>> completeJob(
      InstallerSession session, String jobId) async {
    return _asMap(await _request('/api/v1/installer/jobs/$jobId/complete',
        method: 'POST', token: session.accessToken));
  }

  Future<void> markNotificationRead(
      InstallerSession session, String notificationId) async {
    await _request('/api/v1/installer/notifications/$notificationId/read',
        method: 'POST', token: session.accessToken);
  }

  Future<void> retryActivation(InstallerSession session, String jobId,
      {required String note}) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/retry-activation',
      method: 'POST',
      token: session.accessToken,
      body: {'note': note},
    );
  }

  Future<void> uploadProof(
    InstallerSession session,
    String jobId, {
    required String routerPhotoUrl,
    required String cablePhotoUrl,
  }) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/upload-proof',
      method: 'POST',
      token: session.accessToken,
      body: {
        'routerPhotoUrl': routerPhotoUrl,
        'cablePhotoUrl': cablePhotoUrl,
      },
    );
  }

  Future<void> startComplaint(
    InstallerSession session,
    String jobId, {
    required String note,
    String? resolutionCode,
  }) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/start-complaint',
      method: 'POST',
      token: session.accessToken,
      body: {
        'note': note,
        if (resolutionCode != null && resolutionCode.isNotEmpty)
          'resolutionCode': resolutionCode,
      },
    );
  }

  Future<void> replaceDevice(
    InstallerSession session,
    String jobId, {
    required String newSerialNumber,
    required String reason,
  }) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/replace-device',
      method: 'POST',
      token: session.accessToken,
      body: {
        'newSerialNumber': newSerialNumber,
        'reason': reason,
      },
    );
  }

  Future<void> rebootComplaintDevice(
      InstallerSession session, String jobId) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/reboot-device',
      method: 'POST',
      token: session.accessToken,
    );
  }

  Future<String?> sendComplaintOtp(
      InstallerSession session, String jobId) async {
    final data = _asMap(await _request(
        '/api/v1/installer/jobs/$jobId/send-complaint-otp',
        method: 'POST',
        token: session.accessToken));
    final otp = data['demoOtp']?.toString();
    return otp == null || otp.isEmpty ? null : otp;
  }

  Future<void> verifyComplaintOtp(
      InstallerSession session, String jobId, String otp) async {
    await _request(
      '/api/v1/installer/jobs/$jobId/verify-complaint-otp',
      method: 'POST',
      token: session.accessToken,
      body: {'otp': otp},
    );
  }

  Future<Map<String, dynamic>> resolveComplaint(
      InstallerSession session, String jobId) async {
    return _asMap(await _request(
        '/api/v1/installer/jobs/$jobId/resolve-complaint',
        method: 'POST',
        token: session.accessToken));
  }

  Future<void> startLeave(
    InstallerSession session, {
    required String reason,
    DateTime? expectedEndAt,
  }) async {
    await _request(
      '/api/v1/installer/profile/start-leave',
      method: 'POST',
      token: session.accessToken,
      body: {
        'reason': reason,
        if (expectedEndAt != null)
          'expectedEndAt': expectedEndAt.toUtc().toIso8601String(),
      },
    );
  }

  Future<void> endLeave(InstallerSession session) async {
    await _request('/api/v1/installer/profile/end-leave',
        method: 'POST', token: session.accessToken);
  }

  Future<List<SalesPlan>> fetchSalesPlans(InstallerSession session) async {
    final list = _asList(await _request(
      '/api/v1/installer/sales/plans',
      token: session.accessToken,
    ));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return SalesPlan(
        planCode: (map['planCode'] ?? '').toString(),
        planName: (map['name'] ?? map['planName'] ?? '').toString(),
        planCategory: (map['category'] ?? 'home').toString(),
        monthlyPrice: double.tryParse('${map['monthlyPrice'] ?? 0}') ?? 0,
        otcCharge: double.tryParse('${map['otcCharge'] ?? 0}') ?? 0,
        downloadSpeedMbps: double.tryParse('${map['speedMbps'] ?? 0}') ?? 0,
        uploadSpeedMbps: double.tryParse('${map['uploadSpeedMbps'] ?? 0}') ?? 0,
        dataLimitGb: double.tryParse('${map['dataLimitGb'] ?? 0}') ?? 0,
        dataPolicy: (map['dataPolicy'] ?? 'unlimited').toString(),
        tags: _asList(map['tags'])
            .map((t) => t.toString())
            .where((t) => t.isNotEmpty)
            .toList(),
      );
    }).where((p) => p.planCode.isNotEmpty).toList();
  }

  Future<void> deleteInstallerBooking(
      InstallerSession session, String bookingNumber) async {
    await _request(
      '/api/v1/installer/bookings/by-number/$bookingNumber',
      method: 'DELETE',
      token: session.accessToken,
    );
  }

  Future<String> generateInstallerPaymentLink(
      InstallerSession session, String bookingNumber,
      {double? amount}) async {
    final data = _asMap(await _request(
      '/api/v1/installer/bookings/by-number/$bookingNumber/payment-link',
      method: 'POST',
      token: session.accessToken,
      body: amount != null ? {'amount': amount} : {},
    ));
    return (data['paymentLink'] ?? '').toString();
  }

  Future<SalesLead> fetchInstallerBooking(
      InstallerSession session, String bookingNumber) async {
    final data = _asMap(await _request(
      '/api/v1/installer/bookings/by-number/$bookingNumber',
      token: session.accessToken,
    ));
    return SalesLead(
      bookingNumber: (data['bookingNumber'] ?? bookingNumber).toString(),
      customerName: (data['customerName'] ?? '').toString(),
      customerPhone: (data['customerPhone'] ?? '').toString(),
      customerAddress: (data['customerAddress'] ?? '').toString(),
      planName: (data['planName'] ?? '').toString(),
      planCode: (data['planCode'] ?? '').toString(),
      amount: double.tryParse('${data['amount'] ?? 0}') ?? 0,
      durationMonths: int.tryParse('${data['durationMonths'] ?? 1}') ?? 1,
      status: (data['status'] ?? 'payment_pending').toString(),
      paymentMode: (data['paymentMode'] ?? 'online').toString(),
      paymentStatus: (data['paymentStatus'] ?? 'pending').toString(),
      createdAt: (data['createdAt'] ?? '').toString(),
    );
  }

  Future<void> uploadBookingKyc(
    InstallerSession session,
    String bookingNumber, {
    String? aadhaarFront,
    String? aadhaarBack,
    String? selfie,
    String? documentNumber,
  }) async {
    await _request(
      '/api/v1/installer/bookings/by-number/$bookingNumber/kyc',
      method: 'POST',
      token: session.accessToken,
      body: {
        if ((aadhaarFront ?? '').isNotEmpty) 'aadhaarFront': aadhaarFront,
        if ((aadhaarBack ?? '').isNotEmpty) 'aadhaarBack': aadhaarBack,
        if ((selfie ?? '').isNotEmpty) 'selfie': selfie,
        if ((documentNumber ?? '').isNotEmpty) 'documentNumber': documentNumber,
      },
      timeout: const Duration(seconds: 45),
    );
  }

  Future<SalesLead> createSalesBooking({
    required String fullName,
    required String mobile,
    String? email,
    required String address,
    required String pinCode,
    required double lat,
    required double lng,
    required String planCode,
    required String planName,
    required double totalAmount,
    required int durationMonths,
    required String paymentMode,
  }) async {
    final data = _asMap(await _request(
      '/api/v1/customer/bookings/public',
      method: 'POST',
      body: {
        'fullName': fullName,
        'mobile': mobile,
        if ((email ?? '').trim().isNotEmpty) 'email': email,
        'fullAddress': address,
        'pinCode': pinCode,
        'lat': lat,
        'lng': lng,
        'planCode': planCode,
        'paymentMode': paymentMode,
        'durationMonths': durationMonths,
        'source': 'installer_app',
      },
    ));
    final selectedPlan = _asMap(data['selectedPlan']);
    return SalesLead(
      bookingNumber: (data['bookingNumber'] ?? '').toString(),
      customerName: fullName,
      customerPhone: mobile,
      customerAddress: address,
      planName: (selectedPlan['planName'] ?? planName).toString(),
      planCode: planCode,
      amount:
          double.tryParse('${selectedPlan['totalAmount'] ?? totalAmount}') ??
              totalAmount,
      durationMonths: durationMonths,
      status: (data['status'] ?? 'payment_pending').toString(),
      paymentMode: paymentMode,
      paymentStatus: paymentMode == 'cash' ? 'paid' : 'pending',
      createdAt: DateTime.now().toIso8601String(),
    );
  }
}
