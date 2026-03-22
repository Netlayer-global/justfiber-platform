import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

class InstallerApiClient {
  InstallerApiClient({required this.baseUrl});

  final String baseUrl;

  Uri _uri(String path) => Uri.parse('${baseUrl.replaceAll(RegExp(r'/$'), '')}$path');

  Future<dynamic> _request(
    String path, {
    String method = 'GET',
    String? token,
    Map<String, dynamic>? body,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
    late http.Response response;
    if (method == 'POST') {
      response = await http.post(_uri(path), headers: headers, body: jsonEncode(body ?? {}));
    } else {
      response = await http.get(_uri(path), headers: headers);
    }
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400 || payload['success'] == false) {
      throw Exception(payload['error']?['message'] ?? 'Request failed');
    }
    return payload['data'];
  }

  Map<String, dynamic> _asMap(dynamic data) => data is Map<String, dynamic> ? data : <String, dynamic>{};
  List<dynamic> _asList(dynamic data) => data is List ? data : const [];

  Future<InstallerSession> login(String login, String password) async {
    final data = _asMap(await _request('/api/v1/installer/auth/login', method: 'POST', body: {'login': login, 'password': password}));
    return InstallerSession(
      login: login,
      accessToken: (data['accessToken'] ?? '').toString(),
      refreshToken: (data['refreshToken'] ?? '').toString(),
    );
  }

  Future<InstallerDashboard> fetchDashboard(InstallerSession session) async {
    final data = _asMap(await _request('/api/v1/installer/dashboard', token: session.accessToken));
    return InstallerDashboard(
      todayNewInstallationJobs: int.tryParse('${data['todayNewInstallationJobs'] ?? 0}') ?? 0,
      pendingJobs: int.tryParse('${data['pendingJobs'] ?? 0}') ?? 0,
      completedJobs: int.tryParse('${data['completedJobs'] ?? 0}') ?? 0,
      availabilityStatus: (data['availabilityStatus'] ?? 'available').toString(),
    );
  }

  Future<InstallerProfile> fetchProfile(InstallerSession session) async {
    final data = _asMap(await _request('/api/v1/installer/profile', token: session.accessToken));
    return InstallerProfile(
      fullName: (data['fullName'] ?? 'Installer').toString(),
      installerCode: (data['installerCode'] ?? '-').toString(),
      phone: (data['phone'] ?? '-').toString(),
      availabilityStatus: (data['availabilityStatus'] ?? 'available').toString(),
    );
  }

  Future<List<InstallerJob>> fetchJobs(InstallerSession session) async {
    final list = _asList(await _request('/api/v1/installer/jobs', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return InstallerJob(
        id: (map['_id'] ?? map['id'] ?? '').toString(),
        jobNumber: (map['jobNumber'] ?? 'JOB').toString(),
        status: (map['status'] ?? 'assigned').toString(),
        customerName: (map['customerName'] ?? map['customer']?['fullName'] ?? 'Customer').toString(),
        customerAddress: (map['customerAddress'] ?? map['serviceAddress'] ?? 'Address pending').toString(),
        jobType: (map['jobType'] ?? 'installation').toString(),
        latitude: double.tryParse('${map['customerSnapshot']?['location']?['lat'] ?? ''}'),
        longitude: double.tryParse('${map['customerSnapshot']?['location']?['lng'] ?? ''}'),
        mapUrl: (map['customerSnapshot']?['location']?['mapUrl'] ?? '').toString(),
      );
    }).toList();
  }

  Future<ProvisioningPreview> fetchProvisioningPreview(InstallerSession session, String jobId) async {
    final data = _asMap(await _request('/api/v1/installer/jobs/$jobId/provisioning-preview', token: session.accessToken));
    final credentials = _asMap(data['preparedCredentials'] ?? data['credentials']);
    final pppoe = _asMap(credentials['pppoe']);
    final wifi = _asMap(credentials['wifi']);
    return ProvisioningPreview(
      brand: (credentials['brand'] ?? data['ontBrand'] ?? 'generic').toString(),
      pppoeUsername: (pppoe['username'] ?? data['pppoeUsername'] ?? '').toString(),
      pppoePassword: (pppoe['password'] ?? data['pppoePassword'] ?? '').toString(),
      ssid24: (wifi['ssid24'] ?? 'JustFiber').toString(),
      ssid5: (wifi['ssid5'] ?? 'JustFiber').toString(),
      wifiPassword: (wifi['password'] ?? '').toString(),
      vlanId: int.tryParse('${credentials['vlanId'] ?? 100}') ?? 100,
    );
  }

  Future<List<InstallerNotificationItem>> fetchNotifications(InstallerSession session) async {
    final list = _asList(await _request('/api/v1/installer/notifications', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return InstallerNotificationItem(
        id: (map['_id'] ?? '').toString(),
        title: (map['title'] ?? 'Notification').toString(),
        body: (map['body'] ?? map['message'] ?? '').toString(),
      );
    }).toList();
  }

  Future<void> acceptJob(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/accept', method: 'POST', token: session.accessToken);
  }

  Future<void> startTravel(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/start-travel', method: 'POST', token: session.accessToken);
  }

  Future<void> startOnsite(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/start-onsite', method: 'POST', token: session.accessToken);
  }

  Future<void> setManualSerial(InstallerSession session, String jobId, String serial) async {
    await _request('/api/v1/installer/jobs/$jobId/manual-serial', method: 'POST', token: session.accessToken, body: {'serialNumber': serial});
  }

  Future<void> checkOptical(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/check-optical', method: 'POST', token: session.accessToken, body: {'rxPower': '-19.5', 'txPower': '1.2'});
  }

  Future<void> saveChecklist(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/save-checklist', method: 'POST', token: session.accessToken, body: {
      'checklistItems': [
        {'key': 'fiber_ok', 'label': 'Fiber OK', 'status': 'done'},
        {'key': 'router_ok', 'label': 'Router OK', 'status': 'done'}
      ],
      'notes': 'Checklist completed from installer app'
    });
  }

  Future<void> activate(InstallerSession session, String jobId) async {
    await _request('/api/v1/installer/jobs/$jobId/activate', method: 'POST', token: session.accessToken);
  }
}
