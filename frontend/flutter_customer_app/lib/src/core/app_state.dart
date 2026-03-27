import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'models.dart';

const defaultApiBase = String.fromEnvironment(
  'JUSTFIBER_API_BASE',
  defaultValue: 'http://103.139.191.114:4000',
);
const _mobileKey = 'justfiber.mobile';
const _accessTokenKey = 'justfiber.access_token';
const _refreshTokenKey = 'justfiber.refresh_token';
const _selectedCustomerIdKey = 'justfiber.selected_customer_id';
const _latestBookingNumberKey = 'justfiber.latest_booking_number';
const _latestBookingMobileKey = 'justfiber.latest_booking_mobile';
const _latestBookingPlanKey = 'justfiber.latest_booking_plan';
const _latestBookingAmountKey = 'justfiber.latest_booking_amount';
const _latestBookingStepKey = 'justfiber.latest_booking_step';
const _latestBookingDateKey = 'justfiber.latest_booking_date';
const _latestBookingSlotKey = 'justfiber.latest_booking_slot';
const _latestBookingDurationMonthsKey = 'justfiber.latest_booking_duration_months';
const _latestBookingDurationLabelKey = 'justfiber.latest_booking_duration_label';

class AppState extends ChangeNotifier {
  AppState() {
    api.onUnauthorized = _refreshAccessToken;
    loadPlans();
    restoreSession();
  }

  final api = ApiClient(baseUrl: defaultApiBase);

  CustomerSession? session;
  List<CustomerConnection> connections = const [];
  String? selectedCustomerId;
  bool busy = false;
  bool restoringSession = true;
  String? error;
  DashboardData dashboard = const DashboardData(
    customerName: '',
    planName: '',
    walletBalance: 0,
    usedGb: 0,
    totalGb: 0,
    points: 0,
    activeDays: 0,
    wifiName: '',
    billingDue: 0,
  );
  WifiData wifi = const WifiData(
    ssid24: '',
    ssid5: '',
    passwordMask: '********',
    paused: false,
    guestEnabled: false,
    guestSsid: '',
    connectedDevicesCount: 0,
  );
  BillingData billing = const BillingData(
    currentPlan: '',
    dueAmount: 0,
    recurringAmount: 0,
    nextBillDate: '',
    lastPaymentAmount: 0,
    billCycle: '',
    billMode: '',
    generatedDate: '',
    paymentStatus: '',
    latestInvoiceNumber: '',
    latestInvoiceStatus: '',
    invoiceCount: 0,
    serviceStatus: '',
    lastPaymentDate: '',
    adjustmentPreview: 0,
    speedMbps: 0,
    uploadSpeedMbps: 0,
    dataPolicy: 'unlimited',
    dataLimitGb: 0,
    fupSpeedMbps: 0,
    usageGb: 0,
    usageCapGb: 0,
    usageCapReached: false,
    usageCycleStartedAt: '',
    usageLastUpdatedAt: '',
    pendingPlanChange: null,
    invoices: [],
    payments: [],
    notes: [],
  );
  List<RequestItem> requests = const [];
  List<SupportTicketItem> tickets = const [];
  List<NotificationItem> notifications = const [];
  List<FaqItem> faqs = const [];
  List<AddonItem> addons = const [];
  List<ConnectedDevice> connectedDevices = const [];
  List<PlanItem> plans = const [];
  BookingQuote? latestBooking;
  BookingTrackingData? bookingTracking;
  String? latestBookingLookupMobile;
  List<InstallerVisitItem> installerVisits = const [];
  FeasibilityResult? feasibility;
  BillingPaymentOrder? billingPaymentOrder;
  BillingPaymentOrder? bookingPaymentOrder;
  SpeedTestData speedTest = const SpeedTestData(
    downloadMbps: 0,
    uploadMbps: 0,
    latencyMs: 0,
    packetLossPercent: 0,
    status: 'idle',
  );
  NetworkQualityData networkQuality = const NetworkQualityData(
    latencyMs: 0,
    packetLossPercent: 0,
    jitterMs: 0,
    opticalRxPower: 0,
    quality: 'unknown',
  );
  List<ParentalRule> parentalRules = const [];
  List<PlanItem> planChangeOptions = const [];
  PlanChangePreview? planChangePreview;
  PlanChangeApplyResult? lastPlanChangeResult;
  bool bookingBusy = false;
  String? bookingError;

  void _resetCustomerState({bool preserveGuestBooking = false}) {
    final preservedBooking = preserveGuestBooking ? latestBooking : null;
    final preservedTracking = preserveGuestBooking ? bookingTracking : null;
    final preservedLookupMobile = preserveGuestBooking ? latestBookingLookupMobile : null;
    session = null;
    connections = const [];
    selectedCustomerId = null;
    error = null;
    dashboard = const DashboardData(
      customerName: '',
      planName: '',
      walletBalance: 0,
      usedGb: 0,
      totalGb: 0,
      points: 0,
      activeDays: 0,
      wifiName: '',
      billingDue: 0,
    );
    wifi = const WifiData(
      ssid24: '',
      ssid5: '',
      passwordMask: '********',
      paused: false,
      guestEnabled: false,
      guestSsid: '',
      connectedDevicesCount: 0,
    );
    billing = const BillingData(
      currentPlan: '',
      dueAmount: 0,
      recurringAmount: 0,
      nextBillDate: '',
      lastPaymentAmount: 0,
      billCycle: '',
      billMode: '',
      generatedDate: '',
      paymentStatus: '',
      latestInvoiceNumber: '',
      latestInvoiceStatus: '',
      invoiceCount: 0,
      serviceStatus: '',
      lastPaymentDate: '',
      adjustmentPreview: 0,
      speedMbps: 0,
      uploadSpeedMbps: 0,
      dataPolicy: 'unlimited',
      dataLimitGb: 0,
      fupSpeedMbps: 0,
      usageGb: 0,
      usageCapGb: 0,
      usageCapReached: false,
      usageCycleStartedAt: '',
      usageLastUpdatedAt: '',
      pendingPlanChange: null,
      invoices: [],
      payments: [],
      notes: [],
    );
    requests = const [];
    tickets = const [];
    notifications = const [];
    faqs = const [];
    addons = const [];
    connectedDevices = const [];
    latestBooking = preservedBooking;
    bookingTracking = preservedTracking;
    latestBookingLookupMobile = preservedLookupMobile;
    installerVisits = const [];
    feasibility = null;
    billingPaymentOrder = null;
    bookingPaymentOrder = null;
    speedTest = const SpeedTestData(
      downloadMbps: 0,
      uploadMbps: 0,
      latencyMs: 0,
      packetLossPercent: 0,
      status: 'idle',
    );
    networkQuality = const NetworkQualityData(
      latencyMs: 0,
      packetLossPercent: 0,
      jitterMs: 0,
      opticalRxPower: 0,
      quality: 'unknown',
    );
    parentalRules = const [];
    planChangeOptions = const [];
    planChangePreview = null;
    lastPlanChangeResult = null;
    bookingError = null;
  }

  Future<void> requestOtp(String mobile) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.sendOtp(mobile);
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> verifyOtp(String mobile, String otp) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      session = await api.verifyOtp(mobile, otp);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_mobileKey, session!.mobile);
      await prefs.setString(_accessTokenKey, session!.accessToken);
      await prefs.setString(_refreshTokenKey, session!.refreshToken);
      await prefs.remove(_selectedCustomerIdKey);
      selectedCustomerId = null;
      await refresh();
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    final current = session;
    if (current == null) return;
    busy = true;
    error = null;
    notifyListeners();
    String? firstError;
    try {
      try {
        final connectionResult = await api.fetchConnections(current, selectedCustomerId: selectedCustomerId);
        selectedCustomerId = connectionResult.$1;
        connections = connectionResult.$2;
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        dashboard = await api.fetchDashboard(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        wifi = await api.fetchWifi(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        billing = await api.fetchBilling(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        requests = await api.fetchRequests(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        tickets = await api.fetchTickets(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        notifications = await api.fetchNotifications(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        faqs = await api.fetchFaqs();
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        addons = await api.fetchAddons(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        connectedDevices = await api.fetchConnectedDevices(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        installerVisits = await api.fetchServiceVisits(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      if ((latestBooking?.bookingNumber ?? '').isNotEmpty) {
        try {
          bookingTracking = await api.fetchBookingTracking(current, latestBooking!.bookingNumber);
          await _syncLatestBookingWithTracking();
        } catch (e) {
          firstError ??= e.toString();
        }
      }
      try {
        parentalRules = await api.fetchParentalRules(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        speedTest = await api.fetchSpeedTest(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        networkQuality = await api.fetchNetworkQuality(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        planChangeOptions = await api.fetchPlanChangeOptions(current, customerId: selectedCustomerId);
      } catch (e) {
        firstError ??= e.toString();
      }
      error = firstError;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  DashboardData _copyDashboardWithWifiName(String wifiName) {
    return DashboardData(
      customerName: dashboard.customerName,
      planName: dashboard.planName,
      walletBalance: dashboard.walletBalance,
      usedGb: dashboard.usedGb,
      totalGb: dashboard.totalGb,
      points: dashboard.points,
      activeDays: dashboard.activeDays,
      wifiName: wifiName,
      billingDue: dashboard.billingDue,
    );
  }

  void _refreshWifiStateInBackground() {
    final current = session;
    if (current == null) return;
    final customerId = selectedCustomerId;
    Future<void>(() async {
      try {
        final latestWifi = await api.fetchWifi(current, customerId: customerId);
        wifi = latestWifi;
        dashboard = _copyDashboardWithWifiName(
          latestWifi.ssid24.isNotEmpty ? latestWifi.ssid24 : latestWifi.ssid5,
        );
        try {
          connectedDevices = await api.fetchConnectedDevices(
            current,
            customerId: customerId,
          );
        } catch (_) {
          // Keep the last known device list if the lightweight sync fails.
        }
        notifyListeners();
      } catch (_) {
        // Ignore background sync failures after optimistic local updates.
      }
    });
  }

  bool _isTimeoutLikeError(Object error) {
    final message = error.toString().toLowerCase();
    return message.contains('server took too long') || message.contains('timeout');
  }

  WifiData _copyWifiWith({
    String? ssid24,
    String? ssid5,
    String? passwordMask,
    bool? paused,
    bool? guestEnabled,
    String? guestSsid,
    int? connectedDevicesCount,
  }) {
    return WifiData(
      ssid24: ssid24 ?? wifi.ssid24,
      ssid5: ssid5 ?? wifi.ssid5,
      passwordMask: passwordMask ?? wifi.passwordMask,
      paused: paused ?? wifi.paused,
      guestEnabled: guestEnabled ?? wifi.guestEnabled,
      guestSsid: guestSsid ?? wifi.guestSsid,
      connectedDevicesCount: connectedDevicesCount ?? wifi.connectedDevicesCount,
    );
  }

  Future<void> markNotificationRead(String notificationId) async {
    final current = session;
    if (current == null || notificationId.isEmpty) return;
    try {
      await api.markNotificationRead(current, notificationId);
      notifications = notifications
          .map(
            (item) => item.id == notificationId
                ? NotificationItem(
                    id: item.id,
                    type: item.type,
                    title: item.title,
                    body: item.body,
                    createdAt: item.createdAt,
                    readAt: DateTime.now().toIso8601String(),
                    payload: item.payload,
                  )
                : item,
          )
          .toList(growable: false);
      notifyListeners();
    } catch (_) {
      // Keep the alerts center usable even if read sync fails.
    }
  }

  Future<void> loadPlans() async {
    try {
      plans = await api.fetchPlans();
      notifyListeners();
    } catch (_) {
      // Keep the app usable even if plans are temporarily unavailable.
    }
  }

  Future<void> selectConnection(String customerId) async {
    final normalized = customerId.trim();
    if (normalized.isEmpty || normalized == selectedCustomerId) return;
    selectedCustomerId = normalized;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_selectedCustomerIdKey, normalized);
    await refresh();
  }

  Future<bool> createBooking({
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
    final current = session;
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
    try {
      latestBooking = await api.createBooking(
        session: current,
        planCode: planCode,
        fullName: fullName,
        mobile: current?.mobile ?? mobile,
        email: email,
        address: address,
        pinCode: pinCode,
        lat: lat,
        lng: lng,
        paymentMode: paymentMode,
        durationMonths: durationMonths,
        durationLabel: durationLabel,
        preferredDate: preferredDate,
        preferredSlotCode: preferredSlotCode,
        preferredSlotLabel: preferredSlotLabel,
      );
      latestBookingLookupMobile = current?.mobile ?? mobile;
      await _persistLatestBookingCache();
      if (current != null) {
        bookingTracking = await api.fetchBookingTracking(current, latestBooking!.bookingNumber);
        installerVisits = await api.fetchServiceVisits(current, customerId: selectedCustomerId);
        await _syncLatestBookingWithTracking();
      } else if (latestBookingLookupMobile != null && latestBookingLookupMobile!.isNotEmpty) {
        bookingTracking = await api.fetchPublicBookingTracking(
          bookingNumber: latestBooking!.bookingNumber,
          mobile: latestBookingLookupMobile!,
        );
        await _syncLatestBookingWithTracking();
      }
      return true;
    } catch (e) {
      bookingError = e.toString();
      return false;
    } finally {
      bookingBusy = false;
      notifyListeners();
    }
  }

  Future<bool> saveBookingPreferences({
    required String bookingNumber,
    String? preferredDate,
    String? preferredSlotCode,
    String? preferredSlotLabel,
  }) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.saveBookingPreferences(
        current,
        bookingNumber: bookingNumber,
        preferredDate: preferredDate,
        preferredSlotCode: preferredSlotCode,
        preferredSlotLabel: preferredSlotLabel,
      );
      await refreshBookingTracking();
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> changeWifiPassword(String password) async {
    final current = session;
    if (current == null) return;
    error = null;
    try {
      final nextWifi = await api.updateWifi(
        current,
        customerId: selectedCustomerId,
        password: password,
        ssid24: wifi.ssid24,
        ssid5: wifi.ssid5,
      );
      wifi = nextWifi;
      dashboard = _copyDashboardWithWifiName(
        nextWifi.ssid24.isNotEmpty ? nextWifi.ssid24 : nextWifi.ssid5,
      );
      _refreshWifiStateInBackground();
    } catch (e) {
      if (_isTimeoutLikeError(e)) {
        wifi = _copyWifiWith(passwordMask: '********');
        dashboard = _copyDashboardWithWifiName(
          wifi.ssid24.isNotEmpty ? wifi.ssid24 : wifi.ssid5,
        );
        error = null;
        _refreshWifiStateInBackground();
        return;
      }
      error = e.toString();
      notifyListeners();
    } finally {
      notifyListeners();
    }
  }

  Future<bool> changeWifiPasswordAndRefresh({
    required String password,
    required String ssid24,
    required String ssid5,
  }) async {
    final current = session;
    if (current == null) return false;
    error = null;
    try {
      final nextWifi = await api.updateWifi(
        current,
        customerId: selectedCustomerId,
        password: password,
        ssid24: ssid24,
        ssid5: ssid5,
      );
      wifi = nextWifi;
      dashboard = _copyDashboardWithWifiName(
        nextWifi.ssid24.isNotEmpty ? nextWifi.ssid24 : nextWifi.ssid5,
      );
      _refreshWifiStateInBackground();
      return true;
    } catch (e) {
      if (_isTimeoutLikeError(e)) {
        wifi = _copyWifiWith(
          ssid24: ssid24,
          ssid5: ssid5,
          passwordMask: '********',
        );
        dashboard = _copyDashboardWithWifiName(
          wifi.ssid24.isNotEmpty ? wifi.ssid24 : wifi.ssid5,
        );
        error = null;
        _refreshWifiStateInBackground();
        notifyListeners();
        return true;
      }
      error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> checkFeasibility({
    required String address,
    required String pinCode,
    required double lat,
    required double lng,
  }) async {
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
    try {
      feasibility = await api.checkFeasibility(address: address, pinCode: pinCode, lat: lat, lng: lng);
      return feasibility!.feasible;
    } catch (e) {
      bookingError = e.toString();
      return false;
    } finally {
      bookingBusy = false;
      notifyListeners();
    }
  }

  void clearBookingDraft() {
    feasibility = null;
    bookingError = null;
    notifyListeners();
  }

  Future<void> refreshBookingTracking() async {
    final current = session;
    final bookingNumber = latestBooking?.bookingNumber;
    try {
      if (current != null) {
        installerVisits = await api.fetchServiceVisits(current, customerId: selectedCustomerId);
        notifications = await api.fetchNotifications(current);
        requests = await api.fetchRequests(current, customerId: selectedCustomerId);
        tickets = await api.fetchTickets(current, customerId: selectedCustomerId);
        if ((bookingNumber ?? '').isNotEmpty) {
          bookingTracking = await api.fetchBookingTracking(current, bookingNumber!);
          await _syncLatestBookingWithTracking();
        }
      } else if ((latestBookingLookupMobile ?? '').isNotEmpty) {
        if ((bookingNumber ?? '').isEmpty) return;
        bookingTracking = await api.fetchPublicBookingTracking(
          bookingNumber: bookingNumber!,
          mobile: latestBookingLookupMobile!,
        );
        await _syncLatestBookingWithTracking();
      } else {
        return;
      }
      notifyListeners();
    } catch (_) {
      // keep current state
    }
  }

  Future<bool> verifyBillPayment({
    required String orderId,
    required String paymentId,
    required String signature,
    required double amount,
  }) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.verifyBillingPayment(
        current,
        customerId: selectedCustomerId,
        orderId: orderId,
        paymentId: paymentId,
        signature: signature,
        amount: amount,
      );
      await refresh();
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<String?> submitFeasibilityLead({
    required String fullName,
    required String mobile,
    String? email,
    required String address,
    required String pinCode,
    required double lat,
    required double lng,
  }) async {
    try {
      return await api.submitFeasibilityLead(
        fullName: fullName,
        mobile: mobile,
        email: email,
        address: address,
        pinCode: pinCode,
        lat: lat,
        lng: lng,
      );
    } catch (_) {
      return null;
    }
  }

  Future<BillingPaymentOrder?> loadBillingPaymentOrder({double? amount}) async {
    final current = session;
    if (current == null) return null;
    busy = true;
    error = null;
    notifyListeners();
    try {
      billingPaymentOrder = await api.createBillingPaymentOrder(current, customerId: selectedCustomerId, amount: amount);
      return billingPaymentOrder;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<BillingPaymentOrder?> loadBookingPaymentOrder({
    required String bookingNumber,
    double? amount,
  }) async {
    final current = session;
    if (current == null) return null;
    busy = true;
    error = null;
    notifyListeners();
    try {
      bookingPaymentOrder = await api.createBookingPaymentOrder(
        current,
        bookingNumber: bookingNumber,
        amount: amount,
      );
      return bookingPaymentOrder;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> verifyBookingPayment({
    required String bookingNumber,
    required String orderId,
    required String paymentId,
    required String signature,
    required double amount,
  }) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.verifyBookingPayment(
        current,
        bookingNumber: bookingNumber,
        orderId: orderId,
        paymentId: paymentId,
        signature: signature,
        amount: amount,
      );
      await refresh();
      await refreshBookingTracking();
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> toggleWifiPause(bool paused) async {
    final current = session;
    if (current == null) return false;
    final previousWifi = wifi;
    error = null;
    wifi = WifiData(
      ssid24: wifi.ssid24,
      ssid5: wifi.ssid5,
      passwordMask: wifi.passwordMask,
      paused: paused,
      guestEnabled: wifi.guestEnabled,
      guestSsid: wifi.guestSsid,
      connectedDevicesCount: wifi.connectedDevicesCount,
    );
    notifyListeners();
    try {
      await api.pauseWifi(current, paused, customerId: selectedCustomerId);
      _refreshWifiStateInBackground();
      return true;
    } catch (e) {
      if (_isTimeoutLikeError(e)) {
        error = null;
        _refreshWifiStateInBackground();
        notifyListeners();
        return true;
      }
      wifi = previousWifi;
      error = e.toString();
      notifyListeners();
      return false;
    } finally {
      notifyListeners();
    }
  }

  Future<bool> rebootRouter() async {
    final current = session;
    if (current == null) return false;
    error = null;
    try {
      await api.rebootDevice(current, customerId: selectedCustomerId);
      _refreshWifiStateInBackground();
      return true;
    } catch (e) {
      error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> updateGuestWifi({
    required bool enabled,
    required String ssid,
    required String password,
  }) async {
    final current = session;
    if (current == null) return false;
    error = null;
    final previousWifi = wifi;
    wifi = _copyWifiWith(
      guestEnabled: enabled,
      guestSsid: enabled ? ssid : previousWifi.guestSsid,
    );
    notifyListeners();
    try {
      await api.setGuestWifi(current, customerId: selectedCustomerId, enabled: enabled, ssid: ssid, password: password);
      _refreshWifiStateInBackground();
      return true;
    } catch (e) {
      if (_isTimeoutLikeError(e)) {
        error = null;
        _refreshWifiStateInBackground();
        notifyListeners();
        return true;
      }
      wifi = previousWifi;
      error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> addParentalControl({
    required String targetName,
    required String startTime,
    required String endTime,
  }) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.addParentalRule(current, customerId: selectedCustomerId, targetName: targetName, startTime: startTime, endTime: endTime);
      await refresh();
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> setDeviceBlocked(String clientId, bool blocked) async {
    final current = session;
    if (current == null) return false;
    error = null;
    final existingDevices = connectedDevices;
    final updatedDevices = existingDevices
        .map((device) => device.clientId == clientId
            ? ConnectedDevice(
                clientId: device.clientId,
                name: device.name,
                connectionType: device.connectionType,
                signal: device.signal,
                blocked: blocked,
              )
            : device)
        .toList(growable: false);
    connectedDevices = updatedDevices;
    notifyListeners();
    try {
      await api.setDeviceBlocked(current, customerId: selectedCustomerId, clientId: clientId, blocked: blocked);
      return true;
    } catch (e) {
      connectedDevices = existingDevices;
      error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<String?> raiseComplaint({
    required String category,
    required String subject,
    required String description,
  }) async {
    final current = session;
    if (current == null) return null;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final ticketNumber = await api.createSupportTicket(
        current,
        customerId: selectedCustomerId,
        category: category,
        subject: subject,
        description: description,
      );
      await refresh();
      return ticketNumber;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<String?> submitServiceRequest({
    required String type,
    required String note,
  }) async {
    final current = session;
    if (current == null) return null;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final requestNumber = await api.createServiceRequest(
        current,
        customerId: selectedCustomerId,
        type: type,
        note: note,
      );
      await refresh();
      return requestNumber;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<String?> requestPlanChange({
    required String planCode,
    required String effectiveMode,
  }) async {
    final current = session;
    if (current == null) return null;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final result = await api.applyPlanChange(
        current,
        customerId: selectedCustomerId,
        planCode: planCode,
        effectiveMode: effectiveMode,
      );
      lastPlanChangeResult = result;
      await refresh();
      return result.requestNumber;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<PlanChangePreview?> previewPlanChange({
    required String planCode,
    required String effectiveMode,
  }) async {
    final current = session;
    if (current == null) return null;
    busy = true;
    error = null;
    notifyListeners();
    try {
      planChangePreview = await api.previewPlanChange(
        current,
        customerId: selectedCustomerId,
        planCode: planCode,
        effectiveMode: effectiveMode,
      );
      return planChangePreview;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void logout() {
    SharedPreferences.getInstance().then((prefs) {
      prefs.remove(_mobileKey);
      prefs.remove(_accessTokenKey);
      prefs.remove(_refreshTokenKey);
      prefs.remove(_selectedCustomerIdKey);
      prefs.remove(_latestBookingNumberKey);
      prefs.remove(_latestBookingMobileKey);
      prefs.remove(_latestBookingPlanKey);
      prefs.remove(_latestBookingAmountKey);
      prefs.remove(_latestBookingStepKey);
      prefs.remove(_latestBookingDateKey);
      prefs.remove(_latestBookingSlotKey);
      prefs.remove(_latestBookingDurationMonthsKey);
      prefs.remove(_latestBookingDurationLabelKey);
    });
    _resetCustomerState();
    notifyListeners();
  }

  Future<void> restoreSession() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final mobile = prefs.getString(_mobileKey);
      final accessToken = prefs.getString(_accessTokenKey);
      final refreshToken = prefs.getString(_refreshTokenKey);
      selectedCustomerId = prefs.getString(_selectedCustomerIdKey);
      final latestBookingNumber = prefs.getString(_latestBookingNumberKey);
      final latestBookingMobile = prefs.getString(_latestBookingMobileKey);
      if ((latestBookingNumber ?? '').isNotEmpty) {
        latestBooking = BookingQuote(
          bookingNumber: latestBookingNumber!,
          status: 'pending',
          planName: prefs.getString(_latestBookingPlanKey) ?? '',
          amount: prefs.getDouble(_latestBookingAmountKey) ?? 0,
          currentStep: prefs.getString(_latestBookingStepKey) ?? '',
          preferredDate: prefs.getString(_latestBookingDateKey) ?? '',
          preferredSlotLabel: prefs.getString(_latestBookingSlotKey) ?? '',
          durationMonths: prefs.getInt(_latestBookingDurationMonthsKey) ?? 1,
          durationLabel: prefs.getString(_latestBookingDurationLabelKey) ?? '1 month',
        );
        latestBookingLookupMobile = latestBookingMobile;
        if ((latestBookingLookupMobile ?? '').isNotEmpty) {
          try {
            bookingTracking = await api.fetchPublicBookingTracking(
              bookingNumber: latestBooking!.bookingNumber,
              mobile: latestBookingLookupMobile!,
            );
            await _syncLatestBookingWithTracking();
          } catch (_) {
            // keep stored booking summary even if public tracking isn't available yet
          }
        }
      }
      if (mobile == null || accessToken == null || refreshToken == null) {
        _resetCustomerState(preserveGuestBooking: latestBooking != null);
        return;
      }
      session = CustomerSession(
        mobile: mobile,
        accessToken: accessToken,
        refreshToken: refreshToken,
      );
      notifyListeners();
      await refresh();
    } finally {
      restoringSession = false;
      notifyListeners();
    }
  }

  Future<String?> _refreshAccessToken() async {
    final current = session;
    if (current == null || current.refreshToken.isEmpty) return null;
    try {
      final refreshedAccessToken = await api.refreshCustomerSession(current.refreshToken);
      if (refreshedAccessToken.isEmpty) return null;
      session = CustomerSession(
        mobile: current.mobile,
        accessToken: refreshedAccessToken,
        refreshToken: current.refreshToken,
      );
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_accessTokenKey, refreshedAccessToken);
      return refreshedAccessToken;
    } catch (_) {
      return null;
    }
  }

  Future<void> _syncLatestBookingWithTracking() async {
    final currentBooking = latestBooking;
    final tracking = bookingTracking;
    if (currentBooking == null || tracking == null) return;

    final normalizedStep = tracking.currentStep.trim();
    final latestStatus = tracking.steps.isNotEmpty ? tracking.steps.last.status.trim() : '';
    latestBooking = currentBooking.copyWith(
      currentStep: normalizedStep.isEmpty ? currentBooking.currentStep : normalizedStep,
      status: latestStatus.isEmpty ? currentBooking.status : latestStatus,
    );
    await _persistLatestBookingCache();
  }

  Future<void> _persistLatestBookingCache() async {
    final prefs = await SharedPreferences.getInstance();
    final booking = latestBooking;
    final lookupMobile = latestBookingLookupMobile;
    if (booking == null) {
      await prefs.remove(_latestBookingNumberKey);
      await prefs.remove(_latestBookingMobileKey);
      await prefs.remove(_latestBookingPlanKey);
      await prefs.remove(_latestBookingAmountKey);
      await prefs.remove(_latestBookingStepKey);
      await prefs.remove(_latestBookingDateKey);
      await prefs.remove(_latestBookingSlotKey);
      await prefs.remove(_latestBookingDurationMonthsKey);
      await prefs.remove(_latestBookingDurationLabelKey);
      return;
    }
    await prefs.setString(_latestBookingNumberKey, booking.bookingNumber);
    await prefs.setString(_latestBookingMobileKey, lookupMobile ?? '');
    await prefs.setString(_latestBookingPlanKey, booking.planName);
    await prefs.setDouble(_latestBookingAmountKey, booking.amount);
    await prefs.setString(_latestBookingStepKey, booking.currentStep);
    await prefs.setString(_latestBookingDateKey, booking.preferredDate);
    await prefs.setString(_latestBookingSlotKey, booking.preferredSlotLabel);
    await prefs.setInt(_latestBookingDurationMonthsKey, booking.durationMonths);
    await prefs.setString(_latestBookingDurationLabelKey, booking.durationLabel);
  }
}

class AppStateScope extends InheritedNotifier<AppState> {
  const AppStateScope({
    super.key,
    required AppState appState,
    required Widget child,
  }) : super(notifier: appState, child: child);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppStateScope>();
    assert(scope != null, 'AppStateScope not found');
    return scope!.notifier!;
  }
}
