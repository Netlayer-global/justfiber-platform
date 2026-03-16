import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiClient {
  ApiClient({required this.baseUrl});

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

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    return <String, dynamic>{};
  }

  List<dynamic> _asList(dynamic data) {
    if (data is List) return data;
    return const [];
  }

  Future<String> sendOtp(String mobile) async {
    final data = _asMap(await _request('/api/v1/customer/auth/send-otp', method: 'POST', body: {'mobile': mobile}));
    return (data['demoOtp'] ?? '').toString();
  }

  Future<CustomerSession> verifyOtp(String mobile, String otp) async {
    final data = _asMap(await _request('/api/v1/customer/auth/verify-otp', method: 'POST', body: {'mobile': mobile, 'otp': otp}));
    return CustomerSession(
      mobile: mobile,
      accessToken: (data['accessToken'] ?? '').toString(),
      refreshToken: (data['refreshToken'] ?? '').toString(),
    );
  }

  Future<DashboardData> fetchDashboard(CustomerSession session) async {
    final dashboard = _asMap(await _request('/api/v1/customer/dashboard', token: session.accessToken));
    final billing = _asMap(await _request('/api/v1/customer/billing/summary', token: session.accessToken));
    final wifi = _asMap(await _request('/api/v1/customer/wifi', token: session.accessToken));
    return DashboardData(
      customerName: (dashboard['fullName'] ?? dashboard['customerName'] ?? 'JustFiber User').toString(),
      planName: (dashboard['currentPlanName'] ?? billing['currentPlanName'] ?? 'JustFiber Plan').toString(),
      walletBalance: double.tryParse('${billing['walletBalance'] ?? 100000}') ?? 100000,
      usedGb: double.tryParse('${dashboard['usedDataGb'] ?? 16}') ?? 16,
      totalGb: double.tryParse('${dashboard['totalDataGb'] ?? 40}') ?? 40,
      points: int.tryParse('${dashboard['loyaltyPoints'] ?? 10040}') ?? 10040,
      activeDays: int.tryParse('${dashboard['activeDays'] ?? 4}') ?? 4,
      wifiName: (wifi['ssid24'] ?? wifi['ssid5'] ?? 'JustFiber').toString(),
      billingDue: double.tryParse('${billing['dueAmount'] ?? 0}') ?? 0,
    );
  }

  Future<WifiData> fetchWifi(CustomerSession session) async {
    final data = _asMap(await _request('/api/v1/customer/wifi', token: session.accessToken));
    return WifiData(
      ssid24: (data['ssid24'] ?? 'JustFiber').toString(),
      ssid5: (data['ssid5'] ?? 'JustFiber').toString(),
      passwordMask: '********',
      paused: data['isPaused'] == true,
    );
  }

  Future<BillingData> fetchBilling(CustomerSession session) async {
    final data = _asMap(await _request('/api/v1/customer/billing/summary', token: session.accessToken));
    return BillingData(
      currentPlan: (data['currentPlanName'] ?? 'JustFiber 100').toString(),
      dueAmount: double.tryParse('${data['dueAmount'] ?? 0}') ?? 0,
      nextBillDate: (data['nextBillDate'] ?? '05/05/2029').toString(),
      lastPaymentAmount: double.tryParse('${data['lastPaymentAmount'] ?? 1000}') ?? 1000,
    );
  }

  Future<void> updateWifi(CustomerSession session, String password) async {
    await _request(
      '/api/v1/customer/wifi/update',
      method: 'POST',
      token: session.accessToken,
      body: {'sameSsidMode': true, 'password24': password},
    );
  }

  Future<List<RequestItem>> fetchRequests(CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/requests', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return RequestItem(
        title: (map['subject'] ?? map['title'] ?? map['requestType'] ?? 'Customer request').toString(),
        status: (map['status'] ?? 'open').toString(),
        createdAt: (map['createdAt'] ?? '').toString(),
      );
    }).toList();
  }

  Future<List<NotificationItem>> fetchNotifications(CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/notifications', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return NotificationItem(
        title: (map['title'] ?? 'Notification').toString(),
        body: (map['body'] ?? map['message'] ?? '').toString(),
      );
    }).toList();
  }

  Future<List<FaqItem>> fetchFaqs() async {
    final list = _asList(await _request('/api/v1/customer/help/faqs'));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return FaqItem(
        question: (map['question'] ?? 'FAQ').toString(),
        answer: (map['answer'] ?? '').toString(),
      );
    }).toList();
  }

  Future<List<AddonItem>> fetchAddons(CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/addons', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return AddonItem(
        name: (map['name'] ?? map['title'] ?? 'Add-on').toString(),
        description: (map['description'] ?? '').toString(),
      );
    }).toList();
  }

  Future<List<String>> fetchConnectedDevices(CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/device/connected-devices', token: session.accessToken));
    return list.map((item) {
      if (item is Map<String, dynamic>) {
        return (item['hostName'] ?? item['deviceName'] ?? item['macAddress'] ?? 'Connected device').toString();
      }
      return item.toString();
    }).toList();
  }
}
