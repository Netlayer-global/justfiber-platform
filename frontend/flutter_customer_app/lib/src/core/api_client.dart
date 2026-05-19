import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiClient {
  ApiClient({required this.baseUrl});

  final String baseUrl;
  static const Duration _requestTimeout = Duration(seconds: 22);
  static const Duration _retryDelay = Duration(milliseconds: 700);
  Future<String?> Function()? onUnauthorized;

  Uri _uri(String path) =>
      Uri.parse('${baseUrl.replaceAll(RegExp(r'/$'), '')}$path');

  String _withCustomerId(String path, String? customerId) {
    final normalized = (customerId ?? '').trim();
    if (normalized.isEmpty) return path;
    final separator = path.contains('?') ? '&' : '?';
    return '$path${separator}customerId=${Uri.encodeQueryComponent(normalized)}';
  }

  Future<dynamic> _request(
    String path, {
    String method = 'GET',
    String? token,
    Map<String, dynamic>? body,
    bool allowRetry = true,
  }) async {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
    final uri = _uri(path);
    http.Response response;
    try {
      if (method == 'POST') {
        response = await http
            .post(uri, headers: headers, body: jsonEncode(body ?? {}))
            .timeout(_requestTimeout);
      } else {
        response =
            await http.get(uri, headers: headers).timeout(_requestTimeout);
      }
    } on FormatException {
      throw Exception('Invalid server URL. Check app API configuration.');
    } on TimeoutException {
      if (allowRetry && method == 'GET') {
        await Future<void>.delayed(_retryDelay);
        return _request(
          path,
          method: method,
          token: token,
          body: body,
          allowRetry: false,
        );
      }
      throw Exception(
          'Server is responding slowly. Please retry on a stable network.');
    } on SocketException {
      if (allowRetry && method == 'GET') {
        await Future<void>.delayed(_retryDelay);
        return _request(
          path,
          method: method,
          token: token,
          body: body,
          allowRetry: false,
        );
      }
      throw Exception(
          'No internet connection or server is unreachable. Please try again.');
    } on http.ClientException {
      if (allowRetry && method == 'GET') {
        await Future<void>.delayed(_retryDelay);
        return _request(
          path,
          method: method,
          token: token,
          body: body,
          allowRetry: false,
        );
      }
      throw Exception('Unable to connect right now. Please retry in a moment.');
    } on Exception catch (error) {
      final message = error.toString().toLowerCase();
      if (message.contains('timeout')) {
        if (allowRetry && method == 'GET') {
          await Future<void>.delayed(_retryDelay);
          return _request(
            path,
            method: method,
            token: token,
            body: body,
            allowRetry: false,
          );
        }
        throw Exception(
            'Server took too long to respond. Please try again on a stable network.');
      }
      rethrow;
    }
    Map<String, dynamic> payload;
    try {
      final decoded = jsonDecode(response.body);
      payload = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } on FormatException {
      throw Exception(
        response.statusCode >= 500
            ? 'Server returned an invalid response. Please try again shortly.'
            : 'Unexpected response from server. Please retry.',
      );
    }
    if (response.statusCode == 401 && allowRetry && onUnauthorized != null) {
      final newToken = await onUnauthorized!.call();
      if (newToken != null && newToken.isNotEmpty && newToken != token) {
        return _request(
          path,
          method: method,
          token: newToken,
          body: body,
          allowRetry: false,
        );
      }
    }
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

  /// Resolves a relative image path (like /uploads/...) to a full URL.
  String _resolveImageUrl(String base, String path) {
    if (path.isEmpty) return '';
    if (path.startsWith('http')) return path; // already absolute
    final cleanBase = base.replaceAll(RegExp(r'/$'), '');
    return '$cleanBase$path';
  }

  DateTime? _parseDate(String? value) {
    final text = (value ?? '').trim();
    if (text.isEmpty) return null;
    return DateTime.tryParse(text)?.toUtc();
  }

  List<T> _sortByDateDesc<T>(List<T> items, String Function(T item) getDate) {
    final sorted = List<T>.from(items);
    sorted.sort((left, right) {
      final rightDate = _parseDate(getDate(right));
      final leftDate = _parseDate(getDate(left));
      if (rightDate == null && leftDate == null) return 0;
      if (rightDate == null) return -1;
      if (leftDate == null) return 1;
      return rightDate.compareTo(leftDate);
    });
    return sorted;
  }

  Map<String, dynamic> _latestTimelineEntry(dynamic rawTimeline) {
    final items = _asList(rawTimeline)
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
    if (items.isEmpty) return const <String, dynamic>{};
    items.sort((left, right) {
      final rightDate =
          _parseDate((right['at'] ?? right['createdAt'] ?? '').toString());
      final leftDate =
          _parseDate((left['at'] ?? left['createdAt'] ?? '').toString());
      if (rightDate == null && leftDate == null) return 0;
      if (rightDate == null) return -1;
      if (leftDate == null) return 1;
      return rightDate.compareTo(leftDate);
    });
    return items.first;
  }

  Future<void> sendOtp(String identifier) async {
    final value = identifier.trim();
    final body = value.contains('@')
        ? {'email': value, 'identifier': value}
        : {'mobile': value, 'identifier': value};
    await _request('/api/v1/customer/auth/send-otp',
        method: 'POST', body: body);
  }

  Future<CustomerSession> verifyOtp(String identifier, String otp) async {
    final value = identifier.trim();
    final body = value.contains('@')
        ? {'email': value, 'identifier': value, 'otp': otp}
        : {'mobile': value, 'identifier': value, 'otp': otp};
    final data = _asMap(await _request('/api/v1/customer/auth/verify-otp',
        method: 'POST', body: body));
    return CustomerSession(
      mobile: value,
      accessToken: (data['accessToken'] ?? '').toString(),
      refreshToken: (data['refreshToken'] ?? '').toString(),
    );
  }

  Future<String> refreshCustomerSession(String refreshToken) async {
    final data = _asMap(await _request(
      '/api/v1/customer/auth/refresh',
      method: 'POST',
      body: {'refreshToken': refreshToken},
      allowRetry: false,
    ));
    return (data['accessToken'] ?? '').toString();
  }

  Future<(String?, List<CustomerConnection>)> fetchConnections(
      CustomerSession session,
      {String? selectedCustomerId}) async {
    final data = _asMap(await _request(
        _withCustomerId('/api/v1/customer/connections', selectedCustomerId),
        token: session.accessToken));
    final selected = (data['selectedCustomerId'] ?? '').toString().trim();
    final connections = _asList(data['connections'])
        .map((item) {
          final map = item as Map<String, dynamic>;
          return CustomerConnection(
            customerId: (map['customerId'] ?? '').toString(),
            serviceId: (map['serviceId'] ?? '').toString(),
            accountNumber: (map['accountNumber'] ?? '').toString(),
            fullName: (map['fullName'] ?? '').toString(),
            mobile: (map['mobile'] ?? '').toString(),
            email: (map['email'] ?? '').toString(),
            planName: (map['planName'] ?? '').toString(),
            status: (map['status'] ?? '').toString(),
            dueAmount: double.tryParse('${map['dueAmount'] ?? 0}') ?? 0,
            paymentStatus: (map['paymentStatus'] ?? '').toString(),
            billMode: (map['billMode'] ?? '').toString(),
            wifiName: (map['wifiName'] ?? '').toString(),
            onlineStatus: (map['onlineStatus'] ?? '').toString(),
            address: (map['address'] ?? '').toString(),
          );
        })
        .where((item) => item.customerId.isNotEmpty)
        .toList();
    return (selected.isEmpty ? null : selected, connections);
  }

  Future<DashboardData> fetchDashboard(CustomerSession session,
      {String? customerId}) async {
    final results = await Future.wait([
      _request(_withCustomerId('/api/v1/customer/dashboard', customerId),
          token: session.accessToken),
      _request(_withCustomerId('/api/v1/customer/billing/summary', customerId),
          token: session.accessToken),
      _request(_withCustomerId('/api/v1/customer/wifi', customerId),
          token: session.accessToken),
    ]);
    final dashboard = _asMap(results[0]);
    final billing = _asMap(results[1]);
    final wifi = _asMap(results[2]);
    final serviceStatus =
        (billing['serviceStatus'] ?? dashboard['status'] ?? '').toString();
    final paymentStatus = (billing['paymentStatus'] ?? '').toString();
    final hasSuspensionWarning =
        (billing['lastSuspensionWarningAt'] ?? '').toString().isNotEmpty;
    final hasOverdueReminder =
        (billing['lastOverdueReminderAt'] ?? '').toString().isNotEmpty;
    final hasDueReminder =
        (billing['lastDueReminderAt'] ?? '').toString().isNotEmpty;
    final billingDue = double.tryParse('${billing['dueAmount'] ?? 0}') ?? 0;
    final billingAlert = hasSuspensionWarning
        ? 'Suspension warning active'
        : hasOverdueReminder
            ? 'Invoice overdue'
            : hasDueReminder
                ? 'Payment due soon'
                : serviceStatus.toLowerCase() == 'suspended' && billingDue > 0
                    ? 'Service suspended for unpaid bill'
                    : '';
    final billingAlertTone =
        hasSuspensionWarning || serviceStatus.toLowerCase() == 'suspended'
            ? 'critical'
            : hasOverdueReminder
                ? 'warning'
                : hasDueReminder
                    ? 'info'
                    : 'info';
    return DashboardData(
      customerName:
          (dashboard['fullName'] ?? dashboard['customerName'] ?? '').toString(),
      planName:
          (dashboard['currentPlanName'] ?? billing['currentPlanName'] ?? '')
              .toString(),
      walletBalance: double.tryParse('${billing['walletBalance'] ?? 0}') ?? 0,
      usedGb: double.tryParse(
              '${dashboard['usedDataGb'] ?? billing['usageGb'] ?? 0}') ??
          0,
      totalGb: double.tryParse(
              '${dashboard['totalDataGb'] ?? billing['usageCapGb'] ?? billing['dataLimitGb'] ?? 0}') ??
          0,
      points: int.tryParse('${dashboard['loyaltyPoints'] ?? 0}') ?? 0,
      activeDays: int.tryParse('${dashboard['activeDays'] ?? 0}') ?? 0,
      wifiName: (wifi['ssid24'] ?? wifi['ssid5'] ?? '').toString(),
      billingDue: billingDue,
      billingStatus: paymentStatus,
      serviceStatus: serviceStatus,
      billingAlert: billingAlert,
      billingAlertTone: billingAlertTone,
    );
  }

  Future<WifiData> fetchWifi(CustomerSession session,
      {String? customerId}) async {
    final data = _asMap(await _request(
        _withCustomerId('/api/v1/customer/wifi', customerId),
        token: session.accessToken));
    return _mapWifi(data);
  }

  WifiData _mapWifi(Map<String, dynamic> data) {
    return WifiData(
      ssid24: (data['ssid24'] ?? '').toString(),
      ssid5: (data['ssid5'] ?? '').toString(),
      passwordMask: '********',
      paused: data['paused'] == true,
      guestEnabled: _asMap(data['guestWifi'])['enabled'] == true,
      guestSsid: (_asMap(data['guestWifi'])['ssid'] ?? '').toString(),
      connectedDevicesCount:
          int.tryParse('${data['connectedDevices'] ?? 0}') ?? 0,
    );
  }

  Future<BillingData> fetchBilling(CustomerSession session,
      {String? customerId}) async {
    final details = _asMap(await _request(
        _withCustomerId('/api/v1/customer/billing/details', customerId),
        token: session.accessToken));
    final data = _asMap(details['summary']);
    final invoices = _sortByDateDesc(
        _asList(details['invoices']).map((item) {
          final map = item as Map<String, dynamic>;
          return BillingInvoiceItem(
            invoiceNumber:
                (map['invoiceNumber'] ?? map['invoiceId'] ?? '').toString(),
            totalAmount: double.tryParse(
                    '${map['totalAmount'] ?? map['amount'] ?? 0}') ??
                0,
            generatedAt: (map['generatedAt'] ?? '').toString(),
            dueDate: (map['dueDate'] ?? '').toString(),
            paymentStatus: (map['paymentStatus'] ?? 'unknown').toString(),
            lifecycleStatus: (map['lifecycleStatus'] ?? '').toString(),
            viewUrl: (map['viewUrl'] ?? '').toString(),
            pdfUrl: (map['pdfUrl'] ?? '').toString(),
          );
        }).toList(),
        (item) => item.generatedAt);
    final payments = _sortByDateDesc(
        _asList(details['payments']).map((item) {
          final map = item as Map<String, dynamic>;
          return BillingPaymentItem(
            transactionId: (map['transactionId'] ?? '').toString(),
            amount: double.tryParse('${map['amount'] ?? 0}') ?? 0,
            paidAt: (map['paidAt'] ?? '').toString(),
            provider: (map['provider'] ?? '').toString(),
            reference: (map['reference'] ?? '').toString(),
            viewUrl: (map['viewUrl'] ?? '').toString(),
            pdfUrl: (map['pdfUrl'] ?? '').toString(),
            method: (map['method'] ?? '').toString(),
            notes: (map['notes'] ?? '').toString(),
          );
        }).toList(),
        (item) => item.paidAt);
    final notes = _sortByDateDesc(
        _asList(details['notes']).map((item) {
          final map = item as Map<String, dynamic>;
          return BillingNoteItem(
            noteNumber: (map['noteNumber'] ?? '').toString(),
            type: (map['type'] ?? '').toString(),
            totalAmount: double.tryParse(
                    '${map['totalAmount'] ?? map['amount'] ?? 0}') ??
                0,
            reason: (map['reasonCode'] ?? map['note'] ?? '').toString(),
            issuedAt: (map['issuedAt'] ?? '').toString(),
            viewUrl: (map['viewUrl'] ?? '').toString(),
            pdfUrl: (map['pdfUrl'] ?? '').toString(),
          );
        }).toList(),
        (item) => item.issuedAt);
    final pendingPlanChangeMap = _asMap(data['pendingPlanChange']);
    return BillingData(
      currentPlan:
          (data['currentPlan'] ?? data['currentPlanName'] ?? '').toString(),
      dueAmount:
          double.tryParse('${data['dueAmount'] ?? data['amount'] ?? 0}') ?? 0,
      recurringAmount: double.tryParse(
              '${data['recurringAmount'] ?? data['amount'] ?? data['dueAmount'] ?? 0}') ??
          0,
      nextBillDate: (data['dueDate'] ?? data['nextBillDate'] ?? '').toString(),
      lastPaymentAmount: double.tryParse(
              '${data['lastPaymentAmount'] ?? payments.firstOrNull?.amount ?? 0}') ??
          0,
      billCycle: (data['billCycle'] ?? '').toString(),
      billMode: (data['billMode'] ?? '').toString(),
      generatedDate: (data['generatedDate'] ?? '').toString(),
      paymentStatus: (data['paymentStatus'] ?? 'unknown').toString(),
      invoiceLifecycle: (data['invoiceLifecycle'] ??
              invoices.firstOrNull?.lifecycleStatus ??
              '')
          .toString(),
      latestInvoiceNumber: (data['latestInvoiceNumber'] ??
              invoices.firstOrNull?.invoiceNumber ??
              '')
          .toString(),
      latestInvoiceStatus: (data['latestInvoiceStatus'] ??
              invoices.firstOrNull?.paymentStatus ??
              '')
          .toString(),
      invoiceCount:
          int.tryParse('${data['invoiceCount'] ?? invoices.length}') ??
              invoices.length,
      serviceStatus: (data['serviceStatus'] ?? '').toString(),
      lastDueReminderAt: (data['lastDueReminderAt'] ?? '').toString(),
      lastOverdueReminderAt: (data['lastOverdueReminderAt'] ?? '').toString(),
      lastSuspensionWarningAt:
          (data['lastSuspensionWarningAt'] ?? '').toString(),
      promiseToPayAt: (data['promiseToPayAt'] ?? '').toString(),
      promiseAmount: double.tryParse('${data['promiseAmount'] ?? 0}') ?? 0,
      promiseNote: (data['promiseNote'] ?? '').toString(),
      lastPaymentDate:
          (data['lastPaymentDate'] ?? payments.firstOrNull?.paidAt ?? '')
              .toString(),
      adjustmentPreview:
          double.tryParse('${data['adjustmentPreview'] ?? 0}') ?? 0,
      speedMbps: double.tryParse('${data['speedMbps'] ?? 0}') ?? 0,
      uploadSpeedMbps: double.tryParse('${data['uploadSpeedMbps'] ?? 0}') ?? 0,
      dataPolicy: (data['dataPolicy'] ?? 'unlimited').toString(),
      dataLimitGb: double.tryParse('${data['dataLimitGb'] ?? 0}') ?? 0,
      fupSpeedMbps: double.tryParse('${data['fupSpeedMbps'] ?? 0}') ?? 0,
      usageGb: double.tryParse('${data['usageGb'] ?? 0}') ?? 0,
      usageCapGb: double.tryParse(
              '${data['usageCapGb'] ?? data['dataLimitGb'] ?? 0}') ??
          0,
      usageCapReached: data['usageCapReached'] == true,
      usageCycleStartedAt: (data['usageCycleStartedAt'] ?? '').toString(),
      usageLastUpdatedAt: (data['usageLastUpdatedAt'] ?? '').toString(),
      pendingPlanChange: pendingPlanChangeMap.isEmpty
          ? null
          : PendingPlanChange(
              planCode: (pendingPlanChangeMap['planCode'] ?? '').toString(),
              planName: (pendingPlanChangeMap['planName'] ??
                      pendingPlanChangeMap['planCode'] ??
                      '')
                  .toString(),
              effectiveMode:
                  (pendingPlanChangeMap['effectiveMode'] ?? '').toString(),
              billingTerm:
                  (pendingPlanChangeMap['billingTerm'] ?? 'monthly').toString(),
              billMode: (pendingPlanChangeMap['billMode'] ?? '').toString(),
              currentPrice: double.tryParse(
                      '${pendingPlanChangeMap['currentPrice'] ?? 0}') ??
                  0,
              nextPrice: double.tryParse(
                      '${pendingPlanChangeMap['nextPrice'] ?? 0}') ??
                  0,
              requestedAt:
                  (pendingPlanChangeMap['requestedAt'] ?? '').toString(),
              noteNumber: (pendingPlanChangeMap['noteNumber'] ?? '').toString(),
            ),
      invoices: invoices,
      payments: payments,
      notes: notes,
    );
  }

  Future<WifiData> updateWifi(
    CustomerSession session, {
    String? customerId,
    required String password,
    String? ssid24,
    String? ssid5,
  }) async {
    final data = _asMap(await _request(
      _withCustomerId('/api/v1/customer/wifi/update', customerId),
      method: 'POST',
      token: session.accessToken,
      body: {
        'sameSsidMode': false,
        'ssid24': ssid24,
        'ssid5': ssid5,
        'password24': password,
        'password5': password,
      },
    ));
    return _mapWifi(_asMap(data['wifi']));
  }

  Future<List<RequestItem>> fetchRequests(CustomerSession session,
      {String? customerId}) async {
    final list = _asList(await _request(
        _withCustomerId('/api/v1/customer/requests', customerId),
        token: session.accessToken));
    return _sortByDateDesc(
        list.map((item) {
          final map = item as Map<String, dynamic>;
          final payload = _asMap(map['payload']);
          final latestTimeline = _latestTimelineEntry(map['timeline']);
          return RequestItem(
            id: (map['_id'] ?? '').toString(),
            referenceNumber: (map['requestNumber'] ?? '').toString(),
            title: (map['subject'] ??
                    map['title'] ??
                    map['requestType'] ??
                    map['type'] ??
                    'Customer request')
                .toString(),
            type: (map['type'] ?? 'request').toString(),
            note: (payload['note'] ?? payload['description'] ?? '').toString(),
            latestUpdateNote: (latestTimeline['note'] ?? '').toString(),
            latestUpdateAt:
                (latestTimeline['at'] ?? latestTimeline['createdAt'] ?? '')
                    .toString(),
            status: (map['status'] ?? 'open').toString(),
            createdAt: (map['createdAt'] ?? '').toString(),
          );
        }).toList(),
        (item) => item.createdAt);
  }

  Future<List<SupportTicketItem>> fetchTickets(CustomerSession session,
      {String? customerId}) async {
    final list = _asList(await _request(
        _withCustomerId('/api/v1/customer/tickets', customerId),
        token: session.accessToken));
    return _sortByDateDesc(
        list.map((item) {
          final map = item as Map<String, dynamic>;
          final latestTimeline = _latestTimelineEntry(map['timeline']);
          return SupportTicketItem(
            id: (map['_id'] ?? '').toString(),
            ticketNumber: (map['ticketNumber'] ?? '').toString(),
            category: (map['category'] ?? '').toString(),
            subject: (map['subject'] ?? 'Support ticket').toString(),
            description: (map['description'] ?? '').toString(),
            latestUpdateNote:
                (latestTimeline['note'] ?? map['resolutionSummary'] ?? '')
                    .toString(),
            latestUpdateAt:
                (latestTimeline['at'] ?? latestTimeline['createdAt'] ?? '')
                    .toString(),
            status: (map['status'] ?? 'open').toString(),
            priority: (map['priority'] ?? 'medium').toString(),
            createdAt: (map['createdAt'] ?? '').toString(),
          );
        }).toList(),
        (item) => item.createdAt);
  }

  Future<List<NotificationItem>> fetchNotifications(
      CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/notifications',
        token: session.accessToken));
    return _sortByDateDesc(
        list.map((item) {
          final map = item as Map<String, dynamic>;
          return NotificationItem(
            id: (map['_id'] ?? '').toString(),
            type: (map['type'] ?? 'general').toString(),
            title: (map['title'] ?? 'Notification').toString(),
            body: (map['body'] ?? map['message'] ?? '').toString(),
            createdAt: (map['createdAt'] ?? '').toString(),
            readAt: (map['readAt'] ?? '').toString(),
            payload: _asMap(map['payload']),
          );
        }).toList(),
        (item) => item.createdAt);
  }

  Future<void> markNotificationRead(
      CustomerSession session, String notificationId) async {
    await _request(
      '/api/v1/customer/notifications/$notificationId/read',
      method: 'POST',
      token: session.accessToken,
    );
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
    final list = _asList(
        await _request('/api/v1/customer/addons', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return AddonItem(
        name: (map['name'] ?? map['title'] ?? 'Add-on').toString(),
        description: (map['description'] ?? '').toString(),
      );
    }).toList();
  }

  /// Fetches app-level assets (e.g. Wi-Fi hero image URL).
  Future<String> fetchWifiHeroImageUrl() async {
    try {
      final data = _asMap(await _request('/api/v1/customer/app-assets'));
      final raw = (data['wifiHeroImageUrl'] ?? '').toString();
      return _resolveImageUrl(baseUrl, raw);
    } catch (_) {
      return '';
    }
  }

  Future<List<AppBannerItem>> fetchAppBanners() async {
    final list = _asList(await _request('/api/v1/customer/banners'));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      final rawTargetType = (map['targetType'] ?? 'shop').toString();
      final targetType =
          rawTargetType == 'plans' ? 'plan_catalog' : rawTargetType;
      final targetValue = (map['targetValue'] ?? '').toString();
      String description;
      String ctaLabel;
      switch (targetType) {
        case 'plan_catalog':
          description = targetValue.isEmpty
              ? 'Explore available upgrade plans and higher speed options.'
              : targetValue;
          ctaLabel = 'Explore plans';
          break;
        case 'billing':
          description = targetValue.isEmpty
              ? 'Review invoices, payments, and due amount from billing.'
              : targetValue;
          ctaLabel = 'Open billing';
          break;
        case 'support':
          description = targetValue.isEmpty
              ? 'Reach support for service and billing help.'
              : targetValue;
          ctaLabel = 'Get help';
          break;
        case 'tracking':
          description = targetValue.isEmpty
              ? 'Track booking progress and installer updates.'
              : targetValue;
          ctaLabel = 'Track service';
          break;
        default:
          description = targetValue.isEmpty
              ? 'Latest JustFiber offers and service actions.'
              : targetValue;
          ctaLabel = 'Open';
      }
      return AppBannerItem(
        title: (map['title'] ?? 'JustFiber offer').toString(),
        description: description,
        imageUrl: _resolveImageUrl(baseUrl, (map['imageUrl'] ?? '').toString()),
        targetType: targetType,
        targetValue: targetValue,
        ctaLabel: ctaLabel,
      );
    }).toList();
  }

  Future<List<ConnectedDevice>> fetchConnectedDevices(CustomerSession session,
      {String? customerId}) async {
    final list = _asList(await _request(
        _withCustomerId(
            '/api/v1/customer/device/connected-devices', customerId),
        token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return ConnectedDevice(
        clientId: (map['clientId'] ?? '').toString(),
        name: (map['name'] ??
                map['hostName'] ??
                map['deviceName'] ??
                'Connected device')
            .toString(),
        connectionType: (map['connectionType'] ?? 'wifi').toString(),
        signal: (map['signal'] ?? 'good').toString(),
        blocked: map['blocked'] == true,
      );
    }).toList();
  }

  Future<List<PlanItem>> fetchPlans() async {
    final list = _asList(await _request('/api/v1/customer/plans'));
    return list
        .map((item) {
          final map = item as Map<String, dynamic>;
          return PlanItem(
            planCode: (map['planCode'] ?? '').toString(),
            name: (map['name'] ?? '').toString(),
            speedMbps: double.tryParse('${map['speedMbps'] ?? 100}') ?? 100,
            uploadSpeedMbps:
                double.tryParse('${map['uploadSpeedMbps'] ?? 0}') ?? 0,
            dataLimitGb: double.tryParse('${map['dataLimitGb'] ?? 0}') ?? 0,
            fupSpeedMbps: double.tryParse('${map['fupSpeedMbps'] ?? 0}') ?? 0,
            dataPolicy: (map['dataPolicy'] ?? 'unlimited').toString(),
            monthlyPrice: double.tryParse('${map['monthlyPrice'] ?? 0}') ?? 0,
            quarterlyPrice:
                double.tryParse('${map['quarterlyPrice'] ?? 0}') ?? 0,
            halfYearlyPrice:
                double.tryParse('${map['halfYearlyPrice'] ?? 0}') ?? 0,
            yearlyPrice: double.tryParse('${map['yearlyPrice'] ?? 0}') ?? 0,
            otcCharge: double.tryParse('${map['otcCharge'] ?? 0}') ?? 0,
            installationCharge:
                double.tryParse('${map['installationCharge'] ?? 0}') ?? 0,
            category: (map['category'] ?? 'home').toString(),
            taxIncluded: map['taxIncluded'] != false,
            gstRate: double.tryParse('${map['gstRate'] ?? 0}') ?? 0,
            pricesExcludeGst: map['pricesExcludeGst'] == true,
            tags: _asList(map['tags'])
                .map((item) => item.toString())
                .where((item) => item.isNotEmpty)
                .toList(),
            staticBenefits: _asList(map['staticBenefits'])
                .map((item) => item.toString())
                .where((item) => item.isNotEmpty)
                .toList(),
            features: _asList(map['features'])
                .map((item) => item.toString())
                .where((item) => item.isNotEmpty)
                .toList(),
            validityMonthly: _asMap(map['validityOptions'])['monthly'] != false,
            validityQuarterly:
                _asMap(map['validityOptions'])['quarterly'] == true,
            validityHalfYearly:
                _asMap(map['validityOptions'])['halfYearly'] == true,
            validityYearly: _asMap(map['validityOptions'])['yearly'] == true,
            billingPeriodMonths: int.tryParse('${map['billingPeriodMonths'] ?? 1}') ?? 1,
            ottApps: _asList(map['ottApps']).map((item) => item.toString()).where((item) => item.isNotEmpty).toList(),
            routerIncluded: map['routerIncluded'] == true,
            bannerImageUrl: _resolveImageUrl(baseUrl, ((_asMap(map['merchandising']))['bannerImageUrl'] ?? '').toString()),
            merchandisingSubtitle: ((_asMap(map['merchandising']))['subtitle'] ?? '').toString(),
            merchandisingBadges: _asList((_asMap(map['merchandising']))['badges']).map((item) => item.toString()).where((item) => item.isNotEmpty).toList(),
            recommended: (_asMap(map['merchandising']))['recommended'] == true,
          );
        })
        .where((item) => item.planCode.isNotEmpty)
        .toList();
  }

  Future<BookingQuote> createBooking({
    CustomerSession? session,
    required String planCode,
    required String fullName,
    required String mobile,
    String? email,
    required String address,
    required String pinCode,
    required double lat,
    required double lng,
    String paymentMode = 'cash',
    int? durationMonths,
    String? durationLabel,
    String? preferredDate,
    String? preferredSlotCode,
    String? preferredSlotLabel,
  }) async {
    final body = {
      'planCode': planCode,
      'fullName': fullName,
      'mobile': mobile,
      if ((email ?? '').trim().isNotEmpty) 'email': email,
      'fullAddress': address,
      'pinCode': pinCode,
      'lat': lat,
      'lng': lng,
      if (durationMonths != null && durationMonths > 0)
        'durationMonths': durationMonths,
      if (durationLabel != null && durationLabel.isNotEmpty)
        'durationLabel': durationLabel,
      if (preferredDate != null && preferredDate.isNotEmpty)
        'preferredDate': preferredDate,
      if (preferredSlotCode != null && preferredSlotCode.isNotEmpty)
        'preferredSlotCode': preferredSlotCode,
      if (preferredSlotLabel != null && preferredSlotLabel.isNotEmpty)
        'preferredSlotLabel': preferredSlotLabel,
      'paymentMode': paymentMode,
    };
    final primaryPath = session == null
        ? '/api/v1/customer/bookings/public'
        : '/api/v1/customer/bookings';
    final fallbackPath = session == null
        ? '/api/v1/customer/bookings'
        : '/api/v1/customer/bookings/public';
    Map<String, dynamic> data;
    try {
      data = _asMap(
        await _request(
          primaryPath,
          method: 'POST',
          token: session?.accessToken,
          body: body,
        ),
      );
    } catch (e) {
      final message = e.toString();
      if (!message.contains('Route not found')) rethrow;
      data = _asMap(
        await _request(
          fallbackPath,
          method: 'POST',
          token: session?.accessToken,
          body: body,
        ),
      );
    }
    final selectedPlan = _asMap(data['selectedPlan']);
    final tracking = _asMap(data['tracking']);
    return BookingQuote(
      bookingNumber: (data['bookingNumber'] ?? '').toString(),
      status: (data['status'] ?? 'pending').toString(),
      planName: (selectedPlan['planName'] ?? planCode).toString(),
      amount: double.tryParse('${selectedPlan['totalAmount'] ?? 0}') ?? 0,
      currentStep: (tracking['currentStep'] ?? 'booking_placed').toString(),
      preferredDate: preferredDate ?? '',
      preferredSlotLabel: preferredSlotLabel ?? '',
      durationMonths: int.tryParse(
              '${selectedPlan['durationMonths'] ?? durationMonths ?? 1}') ??
          1,
      durationLabel: (selectedPlan['durationLabel'] ??
              durationLabel ??
              '${durationMonths ?? 1} month')
          .toString(),
    );
  }

  Future<void> saveBookingPreferences(
    CustomerSession session, {
    required String bookingNumber,
    String? preferredDate,
    String? preferredSlotCode,
    String? preferredSlotLabel,
  }) async {
    await _request(
      '/api/v1/customer/bookings/$bookingNumber/preferences',
      method: 'POST',
      token: session.accessToken,
      body: {
        if (preferredDate != null && preferredDate.isNotEmpty)
          'preferredDate': preferredDate,
        if (preferredSlotCode != null && preferredSlotCode.isNotEmpty)
          'preferredSlotCode': preferredSlotCode,
        if (preferredSlotLabel != null && preferredSlotLabel.isNotEmpty)
          'preferredSlotLabel': preferredSlotLabel,
      },
    );
  }

  Future<FeasibilityResult> checkFeasibility({
    required String address,
    required String pinCode,
    required double lat,
    required double lng,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/feasibility/check',
        method: 'POST',
        body: {
          'lat': lat,
          'lng': lng,
          'address': '$address, $pinCode',
        },
      ),
    );
    return FeasibilityResult(
      feasible: data['feasible'] == true,
      serviceStatus: (data['serviceStatus'] ?? 'unknown').toString(),
      message: (data['message'] ?? '').toString(),
    );
  }

  Future<String?> submitFeasibilityLead({
    required String fullName,
    required String mobile,
    String? email,
    required String address,
    required String pinCode,
    required double lat,
    required double lng,
    String? planCode,
    String? planName,
    int? durationMonths,
    String? durationLabel,
    String? preferredSlotCode,
    String? preferredSlotLabel,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/feasibility/lead',
        method: 'POST',
        body: {
          'fullName': fullName,
          'mobile': mobile,
          if ((email ?? '').trim().isNotEmpty) 'email': email,
          'address': address,
          'pinCode': pinCode,
          'lat': lat,
          'lng': lng,
          if ((planCode ?? '').isNotEmpty) 'planCode': planCode,
          if ((planName ?? '').isNotEmpty) 'planName': planName,
          if (durationMonths != null) 'durationMonths': durationMonths,
          if ((durationLabel ?? '').isNotEmpty) 'durationLabel': durationLabel,
          if ((preferredSlotCode ?? '').isNotEmpty)
            'preferredSlotCode': preferredSlotCode,
          if ((preferredSlotLabel ?? '').isNotEmpty)
            'preferredSlotLabel': preferredSlotLabel,
        },
      ),
    );
    final leadNumber = (data['leadNumber'] ?? '').toString().trim();
    return leadNumber.isEmpty ? null : leadNumber;
  }

  Future<String?> submitConnectionLead({
    required String fullName,
    required String mobile,
    String? email,
    required String address,
    required String pinCode,
    required double lat,
    required double lng,
    String? planCode,
    String? planName,
    int? durationMonths,
    String? durationLabel,
    String? preferredSlotCode,
    String? preferredSlotLabel,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/feasibility/lead',
        method: 'POST',
        body: {
          'fullName': fullName,
          'mobile': mobile,
          if ((email ?? '').trim().isNotEmpty) 'email': email,
          'address': address,
          'pinCode': pinCode,
          'lat': lat,
          'lng': lng,
          'source': 'app_new_user',
          if ((planCode ?? '').isNotEmpty) 'planCode': planCode,
          if ((planName ?? '').isNotEmpty) 'planName': planName,
          if (durationMonths != null) 'durationMonths': durationMonths,
          if ((durationLabel ?? '').isNotEmpty) 'durationLabel': durationLabel,
          if ((preferredSlotCode ?? '').isNotEmpty)
            'preferredSlotCode': preferredSlotCode,
          if ((preferredSlotLabel ?? '').isNotEmpty)
            'preferredSlotLabel': preferredSlotLabel,
        },
      ),
    );
    final leadNumber = (data['leadNumber'] ?? '').toString().trim();
    return leadNumber.isEmpty ? null : leadNumber;
  }

  Future<BookingTrackingData> fetchBookingTracking(
      CustomerSession session, String bookingNumber) async {
    final data = _asMap(await _request(
        '/api/v1/customer/bookings/$bookingNumber/tracking',
        token: session.accessToken));
    final steps = _asList(data['steps']).map((item) {
      final map = item as Map<String, dynamic>;
      return BookingTrackingItem(
        code: (map['code'] ?? '').toString(),
        status: (map['status'] ?? '').toString(),
        at: (map['at'] ?? '').toString(),
      );
    }).toList();
    return BookingTrackingData(
      currentStep: (data['currentStep'] ?? '').toString(),
      steps: steps,
    );
  }

  Future<BookingTrackingData> fetchPublicBookingTracking({
    required String bookingNumber,
    required String mobile,
  }) async {
    final normalizedMobile = mobile.replaceAll(RegExp(r'\D+'), '');
    final data = _asMap(
      await _request(
          '/api/v1/customer/bookings/$bookingNumber/tracking/public?mobile=$normalizedMobile'),
    );
    final steps = _asList(data['steps']).map((item) {
      final map = item as Map<String, dynamic>;
      return BookingTrackingItem(
        code: (map['code'] ?? '').toString(),
        status: (map['status'] ?? '').toString(),
        at: (map['at'] ?? '').toString(),
      );
    }).toList();
    return BookingTrackingData(
      currentStep: (data['currentStep'] ?? '').toString(),
      steps: steps,
    );
  }

  Future<List<InstallerVisitItem>> fetchServiceVisits(CustomerSession session,
      {String? customerId}) async {
    final list = _asList(await _request(
        _withCustomerId('/api/v1/customer/services/track', customerId),
        token: session.accessToken));
    return _sortByDateDesc(
        list.map((item) {
          final map = item as Map<String, dynamic>;
          return InstallerVisitItem(
            jobNumber: (map['jobNumber'] ?? '').toString(),
            type: (map['type'] ?? '').toString(),
            status: (map['status'] ?? '').toString(),
            priority: (map['priority'] ?? 'medium').toString(),
            createdAt: (map['createdAt'] ?? '').toString(),
            completedAt: (map['completedAt'] ?? '').toString(),
            installerName: (map['installerName'] ?? '').toString(),
            installerPhone: (map['installerPhone'] ?? '').toString(),
            planName: (map['planName'] ?? '').toString(),
            planCode: (map['planCode'] ?? '').toString(),
            planCategory: (map['planCategory'] ?? 'home').toString(),
            planTags: _asList(map['planTags'])
                .map((item) => item.toString())
                .where((item) => item.isNotEmpty)
                .toList(),
            lastUpdateAt: (map['lastUpdateAt'] ?? '').toString(),
            lastUpdateNote: (map['lastUpdateNote'] ?? '').toString(),
            latestEventCode: (map['latestEventCode'] ?? '').toString(),
            mapUrl: (map['mapUrl'] ?? '').toString(),
            etaText: (map['etaText'] ?? '').toString(),
            configStatus: (map['configStatus'] ?? '').toString(),
            proofUploadedAt: (map['proofUploadedAt'] ?? '').toString(),
            routerPhotoUploaded: map['routerPhotoUploaded'] == true,
            cablePhotoUploaded: map['cablePhotoUploaded'] == true,
            completionOtpVerifiedAt:
                (map['completionOtpVerifiedAt'] ?? '').toString(),
            wifiSsid24: (map['wifiSsid24'] ?? '').toString(),
            wifiSsid5: (map['wifiSsid5'] ?? '').toString(),
            complaintResolutionCode: (map['resolutionCode'] ?? '').toString(),
            complaintResolutionNote: (map['resolutionNote'] ?? '').toString(),
            complaintReplacedDevice: map['replacedDevice'] == true,
            oldSerialNumber: (map['oldSerialNumber'] ?? '').toString(),
            newSerialNumber: (map['newSerialNumber'] ?? '').toString(),
          );
        }).toList(),
        (item) =>
            item.lastUpdateAt.isNotEmpty ? item.lastUpdateAt : item.createdAt);
  }

  Future<BillingPaymentOrder> createBillingPaymentOrder(CustomerSession session,
      {String? customerId, double? amount}) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/billing/payment/order', customerId),
        method: 'POST',
        token: session.accessToken,
        body: amount != null ? {'amount': amount} : const {},
      ),
    );
    final prefill = _asMap(data['prefill']);
    return BillingPaymentOrder(
      provider: (data['provider'] ?? 'razorpay').toString(),
      customerId: (data['customerId'] ?? '').toString(),
      orderId: (data['orderId'] ?? '').toString(),
      keyId: (data['keyId'] ?? '').toString(),
      amount: double.tryParse('${data['amount'] ?? 0}') ?? 0,
      amountPaise: int.tryParse('${data['amountPaise'] ?? 0}') ?? 0,
      currency: (data['currency'] ?? 'INR').toString(),
      customerName: (prefill['name'] ?? '').toString(),
      customerEmail: (prefill['email'] ?? '').toString(),
      customerPhone: (prefill['contact'] ?? session.mobile).toString(),
    );
  }

  Future<BillingPaymentOrder> createBookingPaymentOrder(
    CustomerSession session, {
    required String bookingNumber,
    double? amount,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/bookings/$bookingNumber/payment/order',
        method: 'POST',
        token: session.accessToken,
        body: amount != null ? {'amount': amount} : const {},
      ),
    );
    return BillingPaymentOrder(
      provider: (data['provider'] ?? 'razorpay').toString(),
      customerId: (data['bookingNumber'] ?? bookingNumber).toString(),
      orderId: (data['orderId'] ?? '').toString(),
      keyId: (data['keyId'] ?? '').toString(),
      amount: double.tryParse('${data['amount'] ?? 0}') ?? 0,
      amountPaise: int.tryParse('${data['amountPaise'] ?? 0}') ?? 0,
      currency: (data['currency'] ?? 'INR').toString(),
      customerName: (data['customerName'] ?? '').toString(),
      customerEmail: (data['customerEmail'] ?? '').toString(),
      customerPhone: (data['customerPhone'] ?? session.mobile).toString(),
    );
  }

  Future<void> verifyBillingPayment(
    CustomerSession session, {
    String? customerId,
    required String orderId,
    required String paymentId,
    required String signature,
    required double amount,
  }) async {
    await _request(
      _withCustomerId('/api/v1/customer/billing/payment/verify', customerId),
      method: 'POST',
      token: session.accessToken,
      body: {
        'razorpayOrderId': orderId,
        'razorpayPaymentId': paymentId,
        'razorpaySignature': signature,
        'amount': amount,
        'notes': 'Customer app Razorpay verification',
      },
    );
  }

  Future<void> verifyBookingPayment(
    CustomerSession session, {
    required String bookingNumber,
    required String orderId,
    required String paymentId,
    required String signature,
    required double amount,
  }) async {
    await _request(
      '/api/v1/customer/bookings/$bookingNumber/payment/verify',
      method: 'POST',
      token: session.accessToken,
      body: {
        'razorpayOrderId': orderId,
        'razorpayPaymentId': paymentId,
        'razorpaySignature': signature,
        'amount': amount,
        'notes': 'Customer app booking Razorpay verification',
      },
    );
  }

  Future<String> createSupportTicket(
    CustomerSession session, {
    String? customerId,
    required String category,
    required String subject,
    required String description,
  }) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/tickets', customerId),
        method: 'POST',
        token: session.accessToken,
        body: {
          'category': category,
          'subject': subject,
          'description': description,
        },
      ),
    );
    return (data['ticketNumber'] ?? '').toString();
  }

  Future<String> createServiceRequest(
    CustomerSession session, {
    String? customerId,
    required String type,
    required String note,
  }) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/requests', customerId),
        method: 'POST',
        token: session.accessToken,
        body: {
          'type': type,
          'note': note,
        },
      ),
    );
    return (data['requestNumber'] ?? '').toString();
  }

  Future<void> pauseWifi(CustomerSession session, bool paused,
      {String? customerId}) async {
    await _request(
      _withCustomerId('/api/v1/customer/wifi/pause', customerId),
      method: 'POST',
      token: session.accessToken,
      body: {'paused': paused},
    );
  }

  Future<void> rebootDevice(CustomerSession session,
      {String? customerId}) async {
    await _request(
      _withCustomerId('/api/v1/customer/device/reboot', customerId),
      method: 'POST',
      token: session.accessToken,
      body: const {},
    );
  }

  Future<SupportDiagnosis> fetchSupportDiagnosis(
    CustomerSession session, {
    String? customerId,
    String issueType = 'internet',
  }) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/help/diagnose', customerId),
        method: 'POST',
        token: session.accessToken,
        body: {'issueType': issueType},
      ),
    );
    return SupportDiagnosis(
      issueType: (data['issueType'] ?? issueType).toString(),
      diagnosisCode: (data['diagnosisCode'] ?? 'general_check').toString(),
      headline: (data['headline'] ?? 'Connection check complete').toString(),
      summary: (data['summary'] ?? '').toString(),
      internetStatus: (data['internetStatus'] ?? 'unknown').toString(),
      wifiStatus: (data['wifiStatus'] ?? 'unknown').toString(),
      lineStatus: (data['lineStatus'] ?? 'unknown').toString(),
      recommendation: (data['recommendation'] ?? '').toString(),
      needsTicket: data['needsTicket'] == true,
      steps: _asList(data['steps'])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList(),
      opticalRxPower: double.tryParse('${data['opticalRxPower']}'),
      latencyMs: double.tryParse('${data['latencyMs'] ?? 0}') ?? 0,
      packetLossPercent:
          double.tryParse('${data['packetLossPercent'] ?? 0}') ?? 0,
      estimatedSpeedMbps:
          double.tryParse('${data['estimatedSpeedMbps'] ?? 0}') ?? 0,
    );
  }

  Future<void> setGuestWifi(
    CustomerSession session, {
    String? customerId,
    required bool enabled,
    required String ssid,
    required String password,
  }) async {
    await _request(
      _withCustomerId('/api/v1/customer/wifi/guest', customerId),
      method: 'POST',
      token: session.accessToken,
      body: {'enabled': enabled, 'ssid': ssid, 'password': password},
    );
  }

  Future<List<ParentalRule>> fetchParentalRules(CustomerSession session,
      {String? customerId}) async {
    final data = _asMap(await _request(
        _withCustomerId('/api/v1/customer/wifi/parental-controls', customerId),
        token: session.accessToken));
    return _asList(data['rules']).map((item) {
      final map = item as Map<String, dynamic>;
      return ParentalRule(
        targetName: (map['targetName'] ?? 'Rule').toString(),
        blocked: map['blocked'] != false,
        startTime: (map['startTime'] ?? '').toString(),
        endTime: (map['endTime'] ?? '').toString(),
      );
    }).toList();
  }

  Future<void> addParentalRule(
    CustomerSession session, {
    String? customerId,
    required String targetName,
    required String startTime,
    required String endTime,
  }) async {
    await _request(
      _withCustomerId('/api/v1/customer/wifi/parental-controls', customerId),
      method: 'POST',
      token: session.accessToken,
      body: {
        'mode': 'append',
        'rules': [
          {
            'targetName': targetName,
            'blocked': true,
            'startTime': startTime,
            'endTime': endTime,
            'days': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          }
        ],
      },
    );
  }

  Future<void> setDeviceBlocked(
    CustomerSession session, {
    String? customerId,
    required String clientId,
    required bool blocked,
  }) async {
    await _request(
      _withCustomerId('/api/v1/customer/device/access-control', customerId),
      method: 'POST',
      token: session.accessToken,
      body: {'clientId': clientId, 'blocked': blocked},
    );
  }

  Future<List<PlanItem>> fetchPlanChangeOptions(CustomerSession session,
      {String? customerId}) async {
    final data = _asMap(await _request(
        _withCustomerId('/api/v1/customer/plan/change-options', customerId),
        token: session.accessToken));
    return _asList(data['options'])
        .map((item) {
          final map = item as Map<String, dynamic>;
          return PlanItem(
            planCode: (map['planCode'] ?? '').toString(),
            name: (map['name'] ?? '').toString(),
            speedMbps: double.tryParse('${map['speedMbps'] ?? 100}') ?? 100,
            uploadSpeedMbps:
                double.tryParse('${map['uploadSpeedMbps'] ?? 0}') ?? 0,
            dataLimitGb: double.tryParse('${map['dataLimitGb'] ?? 0}') ?? 0,
            fupSpeedMbps: double.tryParse('${map['fupSpeedMbps'] ?? 0}') ?? 0,
            dataPolicy: (map['dataPolicy'] ?? 'unlimited').toString(),
            monthlyPrice: double.tryParse('${map['monthlyPrice'] ?? 0}') ?? 0,
            quarterlyPrice:
                double.tryParse('${map['quarterlyPrice'] ?? 0}') ?? 0,
            halfYearlyPrice:
                double.tryParse('${map['halfYearlyPrice'] ?? 0}') ?? 0,
            yearlyPrice: double.tryParse('${map['yearlyPrice'] ?? 0}') ?? 0,
            otcCharge: double.tryParse('${map['otcCharge'] ?? 0}') ?? 0,
            installationCharge:
                double.tryParse('${map['installationCharge'] ?? 0}') ?? 0,
            category: (map['category'] ?? 'home').toString(),
            taxIncluded: map['taxIncluded'] != false,
            gstRate: double.tryParse('${map['gstRate'] ?? 0}') ?? 0,
            pricesExcludeGst: map['pricesExcludeGst'] == true,
            tags: _asList(map['tags'])
                .map((item) => item.toString())
                .where((item) => item.isNotEmpty)
                .toList(),
            staticBenefits: _asList(map['staticBenefits'])
                .map((item) => item.toString())
                .where((item) => item.isNotEmpty)
                .toList(),
            features: _asList(map['features'])
                .map((item) => item.toString())
                .where((item) => item.isNotEmpty)
                .toList(),
            validityMonthly: _asMap(map['validityOptions'])['monthly'] != false,
            validityQuarterly:
                _asMap(map['validityOptions'])['quarterly'] == true,
            validityHalfYearly:
                _asMap(map['validityOptions'])['halfYearly'] == true,
            validityYearly: _asMap(map['validityOptions'])['yearly'] == true,
            billingPeriodMonths: int.tryParse('${map['billingPeriodMonths'] ?? 1}') ?? 1,
            ottApps: _asList(map['ottApps']).map((item) => item.toString()).where((item) => item.isNotEmpty).toList(),
            routerIncluded: map['routerIncluded'] == true,
            bannerImageUrl: _resolveImageUrl(baseUrl, ((_asMap(map['merchandising']))['bannerImageUrl'] ?? '').toString()),
            merchandisingSubtitle: ((_asMap(map['merchandising']))['subtitle'] ?? '').toString(),
            merchandisingBadges: _asList((_asMap(map['merchandising']))['badges']).map((item) => item.toString()).where((item) => item.isNotEmpty).toList(),
            recommended: (_asMap(map['merchandising']))['recommended'] == true,
          );
        })
        .where((item) => item.planCode.isNotEmpty)
        .toList();
  }

  Future<String> submitPlanChangeRequest(
    CustomerSession session, {
    String? customerId,
    required String planCode,
    required String effectiveMode,
  }) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/plan/change-request', customerId),
        method: 'POST',
        token: session.accessToken,
        body: {'planCode': planCode, 'effectiveMode': effectiveMode},
      ),
    );
    return (data['requestNumber'] ?? '').toString();
  }

  Future<PlanChangePreview> previewPlanChange(
    CustomerSession session, {
    String? customerId,
    required String planCode,
    required String effectiveMode,
    required String billingTerm,
  }) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/plan/change/preview', customerId),
        method: 'POST',
        token: session.accessToken,
        body: {
          'planCode': planCode,
          'effectiveMode': effectiveMode,
          'billingTerm': billingTerm
        },
      ),
    );
    return PlanChangePreview(
      customerId: (data['customerId'] ?? '').toString(),
      currentPlanCode: (data['currentPlanCode'] ?? '').toString(),
      nextPlanCode: (data['nextPlanCode'] ?? planCode).toString(),
      nextPlanName: (data['nextPlanName'] ?? planCode).toString(),
      effectiveMode: (data['effectiveMode'] ?? effectiveMode).toString(),
      billingTerm: (data['billingTerm'] ?? billingTerm).toString(),
      currentPrice: double.tryParse('${data['currentPrice'] ?? 0}') ?? 0,
      nextPrice: double.tryParse('${data['nextPrice'] ?? 0}') ?? 0,
      adjustmentAmount:
          double.tryParse('${data['adjustmentAmount'] ?? 0}') ?? 0,
      payableNow: double.tryParse('${data['payableNow'] ?? 0}') ?? 0,
      creditAmount: double.tryParse('${data['creditAmount'] ?? 0}') ?? 0,
      remainingDays: int.tryParse('${data['remainingDays'] ?? 0}') ?? 0,
    );
  }

  Future<PlanChangeApplyResult> applyPlanChange(
    CustomerSession session, {
    String? customerId,
    required String planCode,
    required String effectiveMode,
    required String billingTerm,
  }) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/plan/change/apply', customerId),
        method: 'POST',
        token: session.accessToken,
        body: {
          'planCode': planCode,
          'effectiveMode': effectiveMode,
          'billingTerm': billingTerm
        },
      ),
    );
    return PlanChangeApplyResult(
      updated: data['updated'] == true,
      scheduled: data['scheduled'] == true,
      paymentRequired: data['paymentRequired'] == true,
      customerId: (data['customerId'] ?? '').toString(),
      planCode: (data['planCode'] ?? planCode).toString(),
      requestNumber: (data['requestNumber'] ?? '').toString(),
      payableNow: double.tryParse('${data['payableNow'] ?? 0}') ?? 0,
      billingTerm: (data['billingTerm'] ?? billingTerm).toString(),
    );
  }

  Future<bool> cancelPlanChange(CustomerSession session,
      {String? customerId}) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/plan/change/cancel', customerId),
        method: 'POST',
        token: session.accessToken,
        body: const {},
      ),
    );
    return data['cancelled'] == true || data.isNotEmpty;
  }

  Future<bool> completePlanChange(CustomerSession session,
      {String? customerId}) async {
    final data = _asMap(
      await _request(
        _withCustomerId('/api/v1/customer/plan/change/complete', customerId),
        method: 'POST',
        token: session.accessToken,
        body: const {},
      ),
    );
    return data['applied'] == true;
  }

  Future<void> registerFcmToken(CustomerSession session, String fcmToken) async {
    try {
      await _request(
        '/api/v1/customer/device/token',
        method: 'POST',
        token: session.accessToken,
        body: {'fcmToken': fcmToken},
      );
    } catch (_) {}
  }

  Future<SpeedTestData> fetchSpeedTest(CustomerSession session,
      {String? customerId}) async {
    final data = _asMap(await _request(
        _withCustomerId('/api/v1/customer/network/speed-test', customerId),
        token: session.accessToken));
    return SpeedTestData(
      downloadMbps: double.tryParse('${data['downloadMbps'] ?? 0}') ?? 0,
      uploadMbps: double.tryParse('${data['uploadMbps'] ?? 0}') ?? 0,
      latencyMs: double.tryParse('${data['latencyMs'] ?? 0}') ?? 0,
      packetLossPercent:
          double.tryParse('${data['packetLossPercent'] ?? 0}') ?? 0,
      status: (data['status'] ?? 'unknown').toString(),
    );
  }

  Future<NetworkQualityData> fetchNetworkQuality(CustomerSession session,
      {String? customerId}) async {
    final data = _asMap(await _request(
        _withCustomerId('/api/v1/customer/network/quality', customerId),
        token: session.accessToken));
    return NetworkQualityData(
      latencyMs: double.tryParse('${data['latencyMs'] ?? 0}') ?? 0,
      packetLossPercent:
          double.tryParse('${data['packetLossPercent'] ?? 0}') ?? 0,
      jitterMs: double.tryParse('${data['jitterMs'] ?? 0}') ?? 0,
      opticalRxPower: double.tryParse('${data['opticalRxPower'] ?? 0}') ?? 0,
      quality: (data['quality'] ?? 'unknown').toString(),
    );
  }

  Future<BookingQuote?> fetchPendingPaymentBooking(
      CustomerSession session) async {
    final list = _asList(await _request(
      '/api/v1/customer/bookings',
      token: session.accessToken,
    ));
    for (final item in list) {
      final map = item as Map<String, dynamic>;
      final status = (map['status'] ?? '').toString().toLowerCase();
      if (status == 'payment_pending') {
        final selectedPlan = _asMap(map['selectedPlan']);
        final payment = _asMap(map['payment']);
        final tracking = _asMap(map['tracking']);
        // Try multiple amount sources: selectedPlan.totalAmount, selectedPlan.amount, payment.amount
        final amount = double.tryParse('${selectedPlan['totalAmount'] ?? 0}') ??
            double.tryParse('${selectedPlan['amount'] ?? 0}') ??
            double.tryParse('${payment['amount'] ?? 0}') ??
            0;
        return BookingQuote(
          bookingNumber: (map['bookingNumber'] ?? '').toString(),
          status: status,
          planName: (selectedPlan['planName'] ?? '').toString(),
          amount: amount > 0 ? amount : (double.tryParse('${payment['amount'] ?? 0}') ?? 0),
          currentStep:
              (tracking['currentStep'] ?? 'booking_placed').toString(),
          preferredDate: '',
          preferredSlotLabel: '',
          durationMonths:
              int.tryParse('${selectedPlan['durationMonths'] ?? 1}') ?? 1,
          durationLabel:
              (selectedPlan['durationLabel'] ?? '1 month').toString(),
        );
      }
    }
    return null;
  }

  Future<JazeBillingView> fetchJazeBilling(CustomerSession session,
      {String? customerId, String? fromDate, String? toDate}) async {
    String path = _withCustomerId('/api/v1/customer/billing/jaze/view', customerId);
    final queryParts = <String>[];
    if (fromDate != null) queryParts.add('fromDate=$fromDate');
    if (toDate != null) queryParts.add('toDate=$toDate');
    if (queryParts.isNotEmpty) {
      final separator = path.contains('?') ? '&' : '?';
      path = '$path$separator${queryParts.join('&')}';
    }

    final data = _asMap(
      await _request(path, token: session.accessToken),
    );
    final summaryMap = _asMap(data['summary']);
    final summary = summaryMap.isEmpty
        ? null
        : JazeBillingSummary(
            customerName: (summaryMap['customerName'] ?? '').toString(),
            username: (summaryMap['username'] ?? '').toString(),
            status: (summaryMap['status'] ?? '').toString(),
            currentPlanName: (summaryMap['currentPlan']?['name'] ?? '').toString(),
            activationDate: (summaryMap['activationDate'] ?? '').toString(),
            expiryDate: (summaryMap['expiryDate'] ?? '').toString(),
            outstanding: double.tryParse('${summaryMap['outstanding'] ?? 0}') ?? 0,
            lastInvoiceDate: (summaryMap['lastInvoiceDate'] ?? '').toString(),
            lastPaymentDate: (summaryMap['lastPaymentDate'] ?? '').toString(),
            paymentStatus: (summaryMap['paymentStatus'] ?? '').toString(),
            uploadMbps: int.tryParse('${summaryMap['bandwidth']?['uploadMbps'] ?? 0}') ?? 0,
            downloadMbps: int.tryParse('${summaryMap['bandwidth']?['downloadMbps'] ?? 0}') ?? 0,
            usageBytes: int.tryParse('${summaryMap['bandwidth']?['usageBytes'] ?? 0}') ?? 0,
            cycleStart: (summaryMap['bandwidth']?['cycleStart'] ?? '').toString(),
            cycleEnd: (summaryMap['bandwidth']?['cycleEnd'] ?? '').toString(),
          );

    final invoices = (_asList(data['invoices'])).map((item) {
      final map = item as Map<String, dynamic>;
      return JazeInvoice(
        invoiceId: (map['invoiceId'] ?? '').toString(),
        orderId: (map['orderId'] ?? '').toString(),
        periodStart: (map['periodStart'] ?? '').toString(),
        periodEnd: (map['periodEnd'] ?? '').toString(),
        issuedAt: (map['issuedAt'] ?? '').toString(),
        amount: double.tryParse('${map['amount'] ?? 0}') ?? 0,
        baseAmount: double.tryParse('${map['baseAmount'] ?? 0}') ?? 0,
        taxAmount: double.tryParse('${map['taxAmount'] ?? 0}') ?? 0,
        durationDays: int.tryParse('${map['durationDays'] ?? 0}') ?? 0,
        durationLabel: (map['durationLabel'] ?? '').toString(),
        planGroupName: (map['planGroupName'] ?? '').toString(),
        notes: (map['notes'] ?? '').toString(),
      );
    }).toList();

    final paymentLink = (_asMap(data['payment'])['paymentLink'] ?? '').toString();

    return JazeBillingView(
      summary: summary,
      invoices: invoices,
      paymentLink: paymentLink,
    );
  }

  /// Requests a fresh Jaze UPI payment link for the authenticated customer.
  /// Returns the payment link URL on success, or null if unavailable.
  Future<String?> requestPaymentLink(CustomerSession session) async {
    try {
      final data = _asMap(
        await _request(
          '/api/v1/customer/billing/jaze/payment-link',
          method: 'POST',
          token: session.accessToken,
        ),
      );
      final link = (data['paymentLink'] ?? '').toString();
      return link.isNotEmpty ? link : null;
    } on Exception {
      rethrow;
    }
  }
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}



