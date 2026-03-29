import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'models.dart';

const defaultApiBase = 'http://103.139.191.114:4000';
const _mobileKey = 'justfiber.mobile';
const _accessTokenKey = 'justfiber.access_token';
const _refreshTokenKey = 'justfiber.refresh_token';
const _selectedCustomerKey = 'justfiber.selected_customer_id';

class AppState extends ChangeNotifier {
  AppState() {
    api.onUnauthorized = _handleUnauthorized;
    restoreSession();
  }

  final api = ApiClient(baseUrl: defaultApiBase);

  CustomerSession? session;
  String? demoOtp;
  bool busy = false;
  bool bookingBusy = false;
  bool restoringSession = true;
  String? error;
  String? bookingError;
  String? selectedCustomerId;
  DateTime? lastSyncedAt;

  DashboardData dashboard = const DashboardData(
    customerName: 'JustFiber Customer',
    planName: '',
    walletBalance: 0,
    usedGb: 0,
    totalGb: 0,
    points: 0,
    activeDays: 0,
    wifiName: '',
    billingDue: 0,
    billingStatus: '',
    serviceStatus: '',
    billingAlert: '',
    billingAlertTone: 'info',
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
    lastDueReminderAt: '',
    lastOverdueReminderAt: '',
    lastSuspensionWarningAt: '',
    promiseToPayAt: '',
    promiseAmount: 0,
    promiseNote: '',
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
  List<AppBannerItem> banners = const [];
  List<ConnectedDevice> connectedDevices = const [];
  List<CustomerConnection> connections = const [];
  List<PlanItem> plans = const [];
  List<PlanItem> planChangeOptions = const [];
  List<InstallerVisitItem> installerVisits = const [];
  List<ParentalRule> parentalRules = const [];

  BookingQuote? latestBooking;
  BookingTrackingData? bookingTracking;
  BookingQuote? bookingDraft;
  FeasibilityResult? feasibility;
  PlanChangeApplyResult? lastPlanChangeResult;

  SpeedTestData speedTest = const SpeedTestData(
    downloadMbps: 0,
    uploadMbps: 0,
    latencyMs: 0,
    packetLossPercent: 0,
    status: '',
  );

  NetworkQualityData networkQuality = const NetworkQualityData(
    latencyMs: 0,
    packetLossPercent: 0,
    jitterMs: 0,
    opticalRxPower: 0,
    quality: '',
  );

  Future<String?> _handleUnauthorized() async {
    final current = session;
    if (current == null || current.refreshToken.isEmpty) return null;
    try {
      final nextAccessToken = await api.refreshCustomerSession(current.refreshToken);
      if (nextAccessToken.isEmpty) return null;
      session = CustomerSession(
        mobile: current.mobile,
        accessToken: nextAccessToken,
        refreshToken: current.refreshToken,
      );
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_accessTokenKey, nextAccessToken);
      notifyListeners();
      return nextAccessToken;
    } catch (_) {
      return null;
    }
  }

  Future<void> requestOtp(String mobile) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.sendOtp(mobile);
      demoOtp = null;
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
      final prefs = await SharedPreferences.getInstance();
      final savedSelectedCustomer = prefs.getString(_selectedCustomerKey);
      final connectionResult = await api.fetchConnections(current, selectedCustomerId: selectedCustomerId ?? savedSelectedCustomer);
      final nextSelected = connectionResult.$1;
      connections = connectionResult.$2;
      selectedCustomerId = nextSelected ?? (connections.isNotEmpty ? connections.first.customerId : null);
      if (selectedCustomerId != null) {
        await prefs.setString(_selectedCustomerKey, selectedCustomerId!);
      }

      dashboard = await api.fetchDashboard(current, customerId: selectedCustomerId);
      wifi = await api.fetchWifi(current, customerId: selectedCustomerId);
      billing = await api.fetchBilling(current, customerId: selectedCustomerId);
      requests = await api.fetchRequests(current, customerId: selectedCustomerId);
      tickets = await api.fetchTickets(current, customerId: selectedCustomerId);
      notifications = await api.fetchNotifications(current);
      faqs = await api.fetchFaqs();
      addons = await api.fetchAddons(current);
      banners = await api.fetchAppBanners();
      connectedDevices = await api.fetchConnectedDevices(current, customerId: selectedCustomerId);
      planChangeOptions = await api.fetchPlanChangeOptions(current, customerId: selectedCustomerId);
      plans = await api.fetchPlans();
      parentalRules = await api.fetchParentalRules(current, customerId: selectedCustomerId);
      networkQuality = await api.fetchNetworkQuality(current, customerId: selectedCustomerId);
      speedTest = await api.fetchSpeedTest(current, customerId: selectedCustomerId);

      await refreshBookingTracking(silent: true);
      lastSyncedAt = DateTime.now();
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> refreshBookingTracking({bool silent = false}) async {
    final current = session;
    if (current == null) return;
    if (!silent) {
      busy = true;
      error = null;
      notifyListeners();
    }
    try {
      installerVisits = await api.fetchServiceVisits(current, customerId: selectedCustomerId);
      if (latestBooking != null && latestBooking!.bookingNumber.isNotEmpty) {
        try {
          bookingTracking = await api.fetchBookingTracking(current, latestBooking!.bookingNumber);
        } catch (_) {}
      }
      tickets = await api.fetchTickets(current, customerId: selectedCustomerId);
    } catch (e) {
      error = e.toString();
    } finally {
      if (!silent) {
        busy = false;
        notifyListeners();
      } else {
        notifyListeners();
      }
    }
  }

  Future<void> changeWifiPassword(String password) async {
    await changeWifiPasswordAndRefresh(password: password);
  }

  Future<bool> changeWifiPasswordAndRefresh({
    required String password,
    String? ssid24,
    String? ssid5,
  }) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      wifi = await api.updateWifi(
        current,
        customerId: selectedCustomerId,
        password: password,
        ssid24: ssid24,
        ssid5: ssid5,
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

  Future<bool> toggleWifiPause(bool paused) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.pauseWifi(current, paused, customerId: selectedCustomerId);
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
      await api.rebootDevice(current, customerId: selectedCustomerId);
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
      await api.setGuestWifi(
        current,
        customerId: selectedCustomerId,
        enabled: enabled,
        ssid: ssid,
        password: password,
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
      await api.addParentalRule(
        current,
        customerId: selectedCustomerId,
        targetName: targetName,
        startTime: startTime,
        endTime: endTime,
      );
      parentalRules = await api.fetchParentalRules(current, customerId: selectedCustomerId);
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
      await api.setDeviceBlocked(
        current,
        customerId: selectedCustomerId,
        clientId: clientId,
        blocked: blocked,
      );
      connectedDevices = await api.fetchConnectedDevices(current, customerId: selectedCustomerId);
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> selectConnection(String customerId) async {
    selectedCustomerId = customerId;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_selectedCustomerKey, customerId);
    notifyListeners();
    await refresh();
  }

  Future<void> markNotificationRead(String notificationId) async {
    final current = session;
    if (current == null) return;
    try {
      await api.markNotificationRead(current, notificationId);
      notifications = notifications.map((item) {
        if (item.id != notificationId || item.readAt.isNotEmpty) return item;
        return NotificationItem(
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          createdAt: item.createdAt,
          readAt: DateTime.now().toIso8601String(),
          payload: item.payload,
        );
      }).toList(growable: false);
      notifyListeners();
    } catch (e) {
      error = e.toString();
      notifyListeners();
    }
  }

  Future<void> markAllNotificationsRead() async {
    for (final item in notifications.where((item) => item.readAt.isEmpty)) {
      await markNotificationRead(item.id);
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
      tickets = await api.fetchTickets(current, customerId: selectedCustomerId);
      return ticketNumber.isEmpty ? null : ticketNumber;
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
      requests = await api.fetchRequests(current, customerId: selectedCustomerId);
      return requestNumber.isEmpty ? null : requestNumber;
    } catch (e) {
      error = e.toString();
      return null;
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
      return await api.createBillingPaymentOrder(
        current,
        customerId: selectedCustomerId,
        amount: amount,
      );
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
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
    try {
      return await api.createBookingPaymentOrder(
        current,
        bookingNumber: bookingNumber,
        amount: amount,
      );
    } catch (e) {
      bookingError = e.toString();
      return null;
    } finally {
      bookingBusy = false;
      notifyListeners();
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

  Future<bool> verifyBookingPayment({
    required String bookingNumber,
    required String orderId,
    required String paymentId,
    required String signature,
    required double amount,
  }) async {
    final current = session;
    if (current == null) return false;
    bookingBusy = true;
    bookingError = null;
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
      await refreshBookingTracking(silent: true);
      return true;
    } catch (e) {
      bookingError = e.toString();
      error = bookingError;
      return false;
    } finally {
      bookingBusy = false;
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
      return await api.previewPlanChange(
        current,
        customerId: selectedCustomerId,
        planCode: planCode,
        effectiveMode: effectiveMode,
      );
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
    lastPlanChangeResult = null;
    notifyListeners();
    try {
      final result = await api.applyPlanChange(
        current,
        customerId: selectedCustomerId,
        planCode: planCode,
        effectiveMode: effectiveMode,
      );
      lastPlanChangeResult = result;
      return result.requestNumber.isEmpty ? null : result.requestNumber;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
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
      feasibility = await api.checkFeasibility(
        address: address,
        pinCode: pinCode,
        lat: lat,
        lng: lng,
      );
      return feasibility?.feasible == true;
    } catch (e) {
      bookingError = e.toString();
      error = bookingError;
      return false;
    } finally {
      bookingBusy = false;
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
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
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
    } catch (e) {
      bookingError = e.toString();
      error = bookingError;
      return null;
    } finally {
      bookingBusy = false;
      notifyListeners();
    }
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
  }) async {
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
    try {
      latestBooking = await api.createBooking(
        session: session,
        planCode: planCode,
        fullName: fullName,
        mobile: mobile,
        email: email,
        address: address,
        pinCode: pinCode,
        lat: lat,
        lng: lng,
        paymentMode: paymentMode,
        durationMonths: durationMonths,
        durationLabel: durationLabel,
      );
      bookingDraft = latestBooking;
      if (session != null && latestBooking != null && latestBooking!.bookingNumber.isNotEmpty) {
        try {
          bookingTracking = await api.fetchBookingTracking(session!, latestBooking!.bookingNumber);
        } catch (_) {}
      }
      return latestBooking != null;
    } catch (e) {
      bookingError = e.toString();
      error = bookingError;
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
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
    try {
      await api.saveBookingPreferences(
        current,
        bookingNumber: bookingNumber,
        preferredDate: preferredDate,
        preferredSlotCode: preferredSlotCode,
        preferredSlotLabel: preferredSlotLabel,
      );
      if (latestBooking?.bookingNumber == bookingNumber) {
        latestBooking = latestBooking?.copyWith(
          preferredDate: preferredDate ?? latestBooking?.preferredDate,
          preferredSlotLabel: preferredSlotLabel ?? latestBooking?.preferredSlotLabel,
        );
      }
      return true;
    } catch (e) {
      bookingError = e.toString();
      error = bookingError;
      return false;
    } finally {
      bookingBusy = false;
      notifyListeners();
    }
  }

  void clearBookingDraft() {
    latestBooking = null;
    bookingTracking = null;
    bookingDraft = null;
    feasibility = null;
    bookingError = null;
    notifyListeners();
  }

  void logout() {
    SharedPreferences.getInstance().then((prefs) async {
      await prefs.remove(_mobileKey);
      await prefs.remove(_accessTokenKey);
      await prefs.remove(_refreshTokenKey);
      await prefs.remove(_selectedCustomerKey);
    });
    session = null;
    demoOtp = null;
    error = null;
    selectedCustomerId = null;
    _resetCustomerState();
    notifyListeners();
  }

  void _resetCustomerState() {
    dashboard = const DashboardData(
      customerName: 'JustFiber Customer',
      planName: '',
      walletBalance: 0,
      usedGb: 0,
      totalGb: 0,
      points: 0,
      activeDays: 0,
      wifiName: '',
      billingDue: 0,
      billingStatus: '',
      serviceStatus: '',
      billingAlert: '',
      billingAlertTone: 'info',
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
      lastDueReminderAt: '',
      lastOverdueReminderAt: '',
      lastSuspensionWarningAt: '',
      promiseToPayAt: '',
      promiseAmount: 0,
      promiseNote: '',
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
    banners = const [];
    connectedDevices = const [];
    connections = const [];
    plans = const [];
    planChangeOptions = const [];
    installerVisits = const [];
    parentalRules = const [];
    latestBooking = null;
    bookingTracking = null;
    bookingDraft = null;
    feasibility = null;
    lastPlanChangeResult = null;
    speedTest = const SpeedTestData(
      downloadMbps: 0,
      uploadMbps: 0,
      latencyMs: 0,
      packetLossPercent: 0,
      status: '',
    );
    networkQuality = const NetworkQualityData(
      latencyMs: 0,
      packetLossPercent: 0,
      jitterMs: 0,
      opticalRxPower: 0,
      quality: '',
    );
    bookingError = null;
    lastSyncedAt = null;
    busy = false;
    bookingBusy = false;
  }

  Future<void> restoreSession() async {
    restoringSession = true;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    final mobile = prefs.getString(_mobileKey);
    final accessToken = prefs.getString(_accessTokenKey);
    final refreshToken = prefs.getString(_refreshTokenKey);
    selectedCustomerId = prefs.getString(_selectedCustomerKey);
    if (mobile == null || accessToken == null || refreshToken == null) {
      restoringSession = false;
      notifyListeners();
      return;
    }
    session = CustomerSession(
      mobile: mobile,
      accessToken: accessToken,
      refreshToken: refreshToken,
    );
    notifyListeners();
    await refresh();
    restoringSession = false;
    notifyListeners();
  }
}

class AppStateScope extends InheritedNotifier<AppState> {
  const AppStateScope({
    super.key,
    required AppState appState,
    required super.child,
  }) : super(notifier: appState);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppStateScope>();
    assert(scope != null, 'AppStateScope not found');
    return scope!.notifier!;
  }
}
