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
      customerName: (dashboard['fullName'] ?? dashboard['customerName'] ?? '').toString(),
      planName: (dashboard['currentPlanName'] ?? billing['currentPlanName'] ?? '').toString(),
      walletBalance: double.tryParse('${billing['walletBalance'] ?? 0}') ?? 0,
      usedGb: double.tryParse('${dashboard['usedDataGb'] ?? 0}') ?? 0,
      totalGb: double.tryParse('${dashboard['totalDataGb'] ?? 0}') ?? 0,
      points: int.tryParse('${dashboard['loyaltyPoints'] ?? 0}') ?? 0,
      activeDays: int.tryParse('${dashboard['activeDays'] ?? 0}') ?? 0,
      wifiName: (wifi['ssid24'] ?? wifi['ssid5'] ?? '').toString(),
      billingDue: double.tryParse('${billing['dueAmount'] ?? 0}') ?? 0,
    );
  }

  Future<WifiData> fetchWifi(CustomerSession session) async {
    final data = _asMap(await _request('/api/v1/customer/wifi', token: session.accessToken));
    return WifiData(
      ssid24: (data['ssid24'] ?? '').toString(),
      ssid5: (data['ssid5'] ?? '').toString(),
      passwordMask: '********',
      paused: data['paused'] == true,
      guestEnabled: _asMap(data['guestWifi'])['enabled'] == true,
      guestSsid: (_asMap(data['guestWifi'])['ssid'] ?? '').toString(),
      connectedDevicesCount: int.tryParse('${data['connectedDevices'] ?? 0}') ?? 0,
    );
  }

  Future<BillingData> fetchBilling(CustomerSession session) async {
    final details = _asMap(await _request('/api/v1/customer/billing/details', token: session.accessToken));
    final data = _asMap(details['summary']);
    final invoices = _asList(details['invoices']).map((item) {
      final map = item as Map<String, dynamic>;
      return BillingInvoiceItem(
        invoiceNumber: (map['invoiceNumber'] ?? map['invoiceId'] ?? '').toString(),
        totalAmount: double.tryParse('${map['totalAmount'] ?? map['amount'] ?? 0}') ?? 0,
        generatedAt: (map['generatedAt'] ?? '').toString(),
        dueDate: (map['dueDate'] ?? '').toString(),
        paymentStatus: (map['paymentStatus'] ?? 'unknown').toString(),
        viewUrl: (map['viewUrl'] ?? '').toString(),
        pdfUrl: (map['pdfUrl'] ?? '').toString(),
      );
    }).toList();
    final payments = _asList(details['payments']).map((item) {
      final map = item as Map<String, dynamic>;
      return BillingPaymentItem(
        transactionId: (map['transactionId'] ?? '').toString(),
        amount: double.tryParse('${map['amount'] ?? 0}') ?? 0,
        paidAt: (map['paidAt'] ?? '').toString(),
        provider: (map['provider'] ?? '').toString(),
        reference: (map['reference'] ?? '').toString(),
        viewUrl: (map['viewUrl'] ?? '').toString(),
        pdfUrl: (map['pdfUrl'] ?? '').toString(),
      );
    }).toList();
    final notes = _asList(details['notes']).map((item) {
      final map = item as Map<String, dynamic>;
      return BillingNoteItem(
        noteNumber: (map['noteNumber'] ?? '').toString(),
        type: (map['type'] ?? '').toString(),
        totalAmount: double.tryParse('${map['totalAmount'] ?? map['amount'] ?? 0}') ?? 0,
        reason: (map['reasonCode'] ?? map['note'] ?? '').toString(),
        issuedAt: (map['issuedAt'] ?? '').toString(),
        viewUrl: (map['viewUrl'] ?? '').toString(),
        pdfUrl: (map['pdfUrl'] ?? '').toString(),
      );
    }).toList();
    final pendingPlanChangeMap = _asMap(data['pendingPlanChange']);
    return BillingData(
      currentPlan: (data['currentPlan'] ?? data['currentPlanName'] ?? '').toString(),
      dueAmount: double.tryParse('${data['dueAmount'] ?? data['amount'] ?? 0}') ?? 0,
      nextBillDate: (data['dueDate'] ?? data['nextBillDate'] ?? '').toString(),
      lastPaymentAmount: double.tryParse('${data['lastPaymentAmount'] ?? payments.firstOrNull?.amount ?? 0}') ?? 0,
      billCycle: (data['billCycle'] ?? '').toString(),
      billMode: (data['billMode'] ?? '').toString(),
      generatedDate: (data['generatedDate'] ?? '').toString(),
      paymentStatus: (data['paymentStatus'] ?? 'unknown').toString(),
      lastPaymentDate: (data['lastPaymentDate'] ?? payments.firstOrNull?.paidAt ?? '').toString(),
      adjustmentPreview: double.tryParse('${data['adjustmentPreview'] ?? 0}') ?? 0,
      pendingPlanChange: pendingPlanChangeMap.isEmpty
          ? null
          : PendingPlanChange(
              planCode: (pendingPlanChangeMap['planCode'] ?? '').toString(),
              planName: (pendingPlanChangeMap['planName'] ?? pendingPlanChangeMap['planCode'] ?? '').toString(),
              effectiveMode: (pendingPlanChangeMap['effectiveMode'] ?? '').toString(),
              billMode: (pendingPlanChangeMap['billMode'] ?? '').toString(),
              currentPrice: double.tryParse('${pendingPlanChangeMap['currentPrice'] ?? 0}') ?? 0,
              nextPrice: double.tryParse('${pendingPlanChangeMap['nextPrice'] ?? 0}') ?? 0,
              requestedAt: (pendingPlanChangeMap['requestedAt'] ?? '').toString(),
              noteNumber: (pendingPlanChangeMap['noteNumber'] ?? '').toString(),
            ),
      invoices: invoices,
      payments: payments,
      notes: notes,
    );
  }

  Future<void> updateWifi(
    CustomerSession session, {
    required String password,
    String? ssid24,
    String? ssid5,
  }) async {
    await _request(
      '/api/v1/customer/wifi/update',
      method: 'POST',
      token: session.accessToken,
      body: {
        'sameSsidMode': false,
        'ssid24': ssid24,
        'ssid5': ssid5,
        'password24': password,
        'password5': password,
      },
    );
  }

  Future<List<RequestItem>> fetchRequests(CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/requests', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      final payload = _asMap(map['payload']);
      return RequestItem(
        id: (map['_id'] ?? '').toString(),
        referenceNumber: (map['requestNumber'] ?? '').toString(),
        title: (map['subject'] ?? map['title'] ?? map['requestType'] ?? map['type'] ?? 'Customer request').toString(),
        type: (map['type'] ?? 'request').toString(),
        note: (payload['note'] ?? payload['description'] ?? '').toString(),
        status: (map['status'] ?? 'open').toString(),
        createdAt: (map['createdAt'] ?? '').toString(),
      );
    }).toList();
  }

  Future<List<SupportTicketItem>> fetchTickets(CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/tickets', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return SupportTicketItem(
        id: (map['_id'] ?? '').toString(),
        ticketNumber: (map['ticketNumber'] ?? '').toString(),
        category: (map['category'] ?? '').toString(),
        subject: (map['subject'] ?? 'Support ticket').toString(),
        description: (map['description'] ?? '').toString(),
        status: (map['status'] ?? 'open').toString(),
        priority: (map['priority'] ?? 'medium').toString(),
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

  Future<List<ConnectedDevice>> fetchConnectedDevices(CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/device/connected-devices', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return ConnectedDevice(
        clientId: (map['clientId'] ?? '').toString(),
        name: (map['name'] ?? map['hostName'] ?? map['deviceName'] ?? 'Connected device').toString(),
        connectionType: (map['connectionType'] ?? 'wifi').toString(),
        signal: (map['signal'] ?? 'good').toString(),
        blocked: map['blocked'] == true,
      );
    }).toList();
  }

  Future<List<PlanItem>> fetchPlans() async {
    final list = _asList(await _request('/api/v1/customer/plans'));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return PlanItem(
        planCode: (map['planCode'] ?? '').toString(),
        name: (map['name'] ?? '').toString(),
        speedMbps: double.tryParse('${map['speedMbps'] ?? 100}') ?? 100,
        monthlyPrice: double.tryParse('${map['monthlyPrice'] ?? 0}') ?? 0,
        otcCharge: double.tryParse('${map['otcCharge'] ?? 0}') ?? 0,
      );
    }).where((item) => item.planCode.isNotEmpty).toList();
  }

  Future<BookingQuote> createBooking(
    CustomerSession session, {
    required String planCode,
    required String fullName,
    required String mobile,
    required String address,
    required String pinCode,
    required double lat,
    required double lng,
    String? preferredDate,
    String? preferredSlotCode,
    String? preferredSlotLabel,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/bookings',
        method: 'POST',
        token: session.accessToken,
        body: {
          'planCode': planCode,
          'fullName': fullName,
          'mobile': mobile,
          'fullAddress': address,
          'pinCode': pinCode,
          'lat': lat,
          'lng': lng,
          if (preferredDate != null && preferredDate.isNotEmpty) 'preferredDate': preferredDate,
          if (preferredSlotCode != null && preferredSlotCode.isNotEmpty) 'preferredSlotCode': preferredSlotCode,
          if (preferredSlotLabel != null && preferredSlotLabel.isNotEmpty) 'preferredSlotLabel': preferredSlotLabel,
          'paymentMode': 'cash',
        },
      ),
    );
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

  Future<BookingTrackingData> fetchBookingTracking(CustomerSession session, String bookingNumber) async {
    final data = _asMap(await _request('/api/v1/customer/bookings/$bookingNumber/tracking', token: session.accessToken));
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

  Future<List<InstallerVisitItem>> fetchServiceVisits(CustomerSession session) async {
    final list = _asList(await _request('/api/v1/customer/services/track', token: session.accessToken));
    return list.map((item) {
      final map = item as Map<String, dynamic>;
      return InstallerVisitItem(
        jobNumber: (map['jobNumber'] ?? '').toString(),
        type: (map['type'] ?? '').toString(),
        status: (map['status'] ?? '').toString(),
        priority: (map['priority'] ?? 'medium').toString(),
        createdAt: (map['createdAt'] ?? '').toString(),
        completedAt: (map['completedAt'] ?? '').toString(),
        installerName: (map['installerName'] ?? '').toString(),
        lastUpdateAt: (map['lastUpdateAt'] ?? '').toString(),
        lastUpdateNote: (map['lastUpdateNote'] ?? '').toString(),
        latestEventCode: (map['latestEventCode'] ?? '').toString(),
        mapUrl: (map['mapUrl'] ?? '').toString(),
        etaText: (map['etaText'] ?? '').toString(),
      );
    }).toList();
  }

  Future<BillingPaymentOrder> createBillingPaymentOrder(CustomerSession session, {double? amount}) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/billing/payment/order',
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

  Future<void> verifyBillingPayment(
    CustomerSession session, {
    required String orderId,
    required String paymentId,
    required String signature,
    required double amount,
  }) async {
    await _request(
      '/api/v1/customer/billing/payment/verify',
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

  Future<String> createSupportTicket(
    CustomerSession session, {
    required String category,
    required String subject,
    required String description,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/tickets',
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
    required String type,
    required String note,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/requests',
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

  Future<void> pauseWifi(CustomerSession session, bool paused) async {
    await _request(
      '/api/v1/customer/wifi/pause',
      method: 'POST',
      token: session.accessToken,
      body: {'paused': paused},
    );
  }

  Future<void> rebootDevice(CustomerSession session) async {
    await _request(
      '/api/v1/customer/device/reboot',
      method: 'POST',
      token: session.accessToken,
      body: const {},
    );
  }

  Future<void> setGuestWifi(
    CustomerSession session, {
    required bool enabled,
    required String ssid,
    required String password,
  }) async {
    await _request(
      '/api/v1/customer/wifi/guest',
      method: 'POST',
      token: session.accessToken,
      body: {'enabled': enabled, 'ssid': ssid, 'password': password},
    );
  }

  Future<List<ParentalRule>> fetchParentalRules(CustomerSession session) async {
    final data = _asMap(await _request('/api/v1/customer/wifi/parental-controls', token: session.accessToken));
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
    required String targetName,
    required String startTime,
    required String endTime,
  }) async {
    await _request(
      '/api/v1/customer/wifi/parental-controls',
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
    required String clientId,
    required bool blocked,
  }) async {
    await _request(
      '/api/v1/customer/device/access-control',
      method: 'POST',
      token: session.accessToken,
      body: {'clientId': clientId, 'blocked': blocked},
    );
  }

  Future<List<PlanItem>> fetchPlanChangeOptions(CustomerSession session) async {
    final data = _asMap(await _request('/api/v1/customer/plan/change-options', token: session.accessToken));
    return _asList(data['options']).map((item) {
      final map = item as Map<String, dynamic>;
      return PlanItem(
        planCode: (map['planCode'] ?? '').toString(),
        name: (map['name'] ?? '').toString(),
        speedMbps: double.tryParse('${map['speedMbps'] ?? 100}') ?? 100,
        monthlyPrice: double.tryParse('${map['monthlyPrice'] ?? 0}') ?? 0,
        otcCharge: double.tryParse('${map['otcCharge'] ?? 0}') ?? 0,
      );
    }).where((item) => item.planCode.isNotEmpty).toList();
  }

  Future<String> submitPlanChangeRequest(
    CustomerSession session, {
    required String planCode,
    required String effectiveMode,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/plan/change-request',
        method: 'POST',
        token: session.accessToken,
        body: {'planCode': planCode, 'effectiveMode': effectiveMode},
      ),
    );
    return (data['requestNumber'] ?? '').toString();
  }

  Future<PlanChangePreview> previewPlanChange(
    CustomerSession session, {
    required String planCode,
    required String effectiveMode,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/plan/change/preview',
        method: 'POST',
        token: session.accessToken,
        body: {'planCode': planCode, 'effectiveMode': effectiveMode},
      ),
    );
    return PlanChangePreview(
      customerId: (data['customerId'] ?? '').toString(),
      currentPlanCode: (data['currentPlanCode'] ?? '').toString(),
      nextPlanCode: (data['nextPlanCode'] ?? planCode).toString(),
      nextPlanName: (data['nextPlanName'] ?? planCode).toString(),
      effectiveMode: (data['effectiveMode'] ?? effectiveMode).toString(),
      currentPrice: double.tryParse('${data['currentPrice'] ?? 0}') ?? 0,
      nextPrice: double.tryParse('${data['nextPrice'] ?? 0}') ?? 0,
      adjustmentAmount: double.tryParse('${data['adjustmentAmount'] ?? 0}') ?? 0,
      payableNow: double.tryParse('${data['payableNow'] ?? 0}') ?? 0,
      creditAmount: double.tryParse('${data['creditAmount'] ?? 0}') ?? 0,
      remainingDays: int.tryParse('${data['remainingDays'] ?? 0}') ?? 0,
    );
  }

  Future<PlanChangeApplyResult> applyPlanChange(
    CustomerSession session, {
    required String planCode,
    required String effectiveMode,
  }) async {
    final data = _asMap(
      await _request(
        '/api/v1/customer/plan/change/apply',
        method: 'POST',
        token: session.accessToken,
        body: {'planCode': planCode, 'effectiveMode': effectiveMode},
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
    );
  }

  Future<SpeedTestData> fetchSpeedTest(CustomerSession session) async {
    final data = _asMap(await _request('/api/v1/customer/network/speed-test', token: session.accessToken));
    return SpeedTestData(
      downloadMbps: double.tryParse('${data['downloadMbps'] ?? 0}') ?? 0,
      uploadMbps: double.tryParse('${data['uploadMbps'] ?? 0}') ?? 0,
      latencyMs: double.tryParse('${data['latencyMs'] ?? 0}') ?? 0,
      packetLossPercent: double.tryParse('${data['packetLossPercent'] ?? 0}') ?? 0,
      status: (data['status'] ?? 'unknown').toString(),
    );
  }

  Future<NetworkQualityData> fetchNetworkQuality(CustomerSession session) async {
    final data = _asMap(await _request('/api/v1/customer/network/quality', token: session.accessToken));
    return NetworkQualityData(
      latencyMs: double.tryParse('${data['latencyMs'] ?? 0}') ?? 0,
      packetLossPercent: double.tryParse('${data['packetLossPercent'] ?? 0}') ?? 0,
      jitterMs: double.tryParse('${data['jitterMs'] ?? 0}') ?? 0,
      opticalRxPower: double.tryParse('${data['opticalRxPower'] ?? 0}') ?? 0,
      quality: (data['quality'] ?? 'unknown').toString(),
    );
  }
}

extension _FirstOrNull<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
