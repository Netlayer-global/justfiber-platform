import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'models.dart';

const defaultApiBase = 'http://103.139.191.114:4000';
const _mobileKey = 'justfiber.mobile';
const _accessTokenKey = 'justfiber.access_token';
const _refreshTokenKey = 'justfiber.refresh_token';

class AppState extends ChangeNotifier {
  final api = ApiClient(baseUrl: defaultApiBase);

  CustomerSession? session;
  String? demoOtp;
  bool busy = false;
  String? error;
  DashboardData dashboard = const DashboardData(
    customerName: 'Esmeralda',
    planName: 'Active Package',
    walletBalance: 100000,
    usedGb: 16,
    totalGb: 40,
    points: 10040,
    activeDays: 4,
    wifiName: 'JustFiber',
    billingDue: 0,
  );
  WifiData wifi = const WifiData(
    ssid24: 'JustFiber',
    ssid5: 'JustFiber',
    passwordMask: '********',
    paused: false,
    guestEnabled: false,
    guestSsid: 'JustFiber-Guest',
    connectedDevicesCount: 0,
  );
  BillingData billing = const BillingData(
    currentPlan: 'JustFiber 100',
    dueAmount: 0,
    nextBillDate: '05/05/2029',
    lastPaymentAmount: 0,
    billCycle: 'Monthly',
    billMode: 'Prepaid',
    generatedDate: '',
    paymentStatus: 'paid',
    lastPaymentDate: '',
    adjustmentPreview: 0,
    pendingPlanChange: null,
    invoices: [],
    payments: [],
    notes: [],
  );
  List<RequestItem> requests = const [];
  List<NotificationItem> notifications = const [];
  List<FaqItem> faqs = const [];
  List<AddonItem> addons = const [];
  List<ConnectedDevice> connectedDevices = const [];
  List<PlanItem> plans = const [];
  BookingQuote? latestBooking;
  BookingTrackingData? bookingTracking;
  List<InstallerVisitItem> installerVisits = const [];
  FeasibilityResult? feasibility;
  BillingPaymentOrder? billingPaymentOrder;
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

  AppState() {
    loadPlans();
    restoreSession();
  }

  Future<void> requestOtp(String mobile) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      demoOtp = await api.sendOtp(mobile);
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
    try {
      dashboard = await api.fetchDashboard(current);
      wifi = await api.fetchWifi(current);
      billing = await api.fetchBilling(current);
      requests = await api.fetchRequests(current);
      notifications = await api.fetchNotifications(current);
      faqs = await api.fetchFaqs();
      addons = await api.fetchAddons(current);
      connectedDevices = await api.fetchConnectedDevices(current);
      installerVisits = await api.fetchServiceVisits(current);
      parentalRules = await api.fetchParentalRules(current);
      speedTest = await api.fetchSpeedTest(current);
      networkQuality = await api.fetchNetworkQuality(current);
      planChangeOptions = await api.fetchPlanChangeOptions(current);
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
      notifyListeners();
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

  Future<bool> createBooking({
    required String planCode,
    required String fullName,
    required String address,
    required String pinCode,
  }) async {
    final current = session;
    if (current == null) {
      bookingError = 'Login required before booking.';
      notifyListeners();
      return false;
    }
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
    try {
      latestBooking = await api.createBooking(
        current,
        planCode: planCode,
        fullName: fullName,
        mobile: current.mobile,
        address: address,
        pinCode: pinCode,
      );
      bookingTracking = await api.fetchBookingTracking(current, latestBooking!.bookingNumber);
      installerVisits = await api.fetchServiceVisits(current);
      return true;
    } catch (e) {
      bookingError = e.toString();
      return false;
    } finally {
      bookingBusy = false;
      notifyListeners();
    }
  }

  Future<void> changeWifiPassword(String password) async {
    final current = session;
    if (current == null) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.updateWifi(current, password: password, ssid24: wifi.ssid24, ssid5: wifi.ssid5);
      await refresh();
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
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
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.updateWifi(current, password: password, ssid24: ssid24, ssid5: ssid5);
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

  Future<bool> checkFeasibility({
    required String address,
    required String pinCode,
  }) async {
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
    try {
      feasibility = await api.checkFeasibility(address: address, pinCode: pinCode);
      return feasibility!.feasible;
    } catch (e) {
      bookingError = e.toString();
      return false;
    } finally {
      bookingBusy = false;
      notifyListeners();
    }
  }

  Future<void> refreshBookingTracking() async {
    final current = session;
    final bookingNumber = latestBooking?.bookingNumber;
    if (current == null || bookingNumber == null || bookingNumber.isEmpty) return;
    try {
      bookingTracking = await api.fetchBookingTracking(current, bookingNumber);
      installerVisits = await api.fetchServiceVisits(current);
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

  Future<BillingPaymentOrder?> loadBillingPaymentOrder({double? amount}) async {
    final current = session;
    if (current == null) return null;
    busy = true;
    error = null;
    notifyListeners();
    try {
      billingPaymentOrder = await api.createBillingPaymentOrder(current, amount: amount);
      return billingPaymentOrder;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> toggleWifiPause(bool paused) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.pauseWifi(current, paused);
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

  Future<bool> rebootRouter() async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.rebootDevice(current);
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> updateGuestWifi({
    required bool enabled,
    required String ssid,
    required String password,
  }) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.setGuestWifi(current, enabled: enabled, ssid: ssid, password: password);
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
      await api.addParentalRule(current, targetName: targetName, startTime: startTime, endTime: endTime);
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
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.setDeviceBlocked(current, clientId: clientId, blocked: blocked);
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
        category: category,
        subject: subject,
        description: description,
      );
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
    });
    session = null;
    demoOtp = null;
    error = null;
    latestBooking = null;
    bookingTracking = null;
    installerVisits = const [];
    feasibility = null;
    billingPaymentOrder = null;
    planChangePreview = null;
    lastPlanChangeResult = null;
    bookingError = null;
    notifyListeners();
  }

  Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final mobile = prefs.getString(_mobileKey);
    final accessToken = prefs.getString(_accessTokenKey);
    final refreshToken = prefs.getString(_refreshTokenKey);
    if (mobile == null || accessToken == null || refreshToken == null) {
      return;
    }
    session = CustomerSession(
      mobile: mobile,
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
    notifyListeners();
    await refresh();
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
