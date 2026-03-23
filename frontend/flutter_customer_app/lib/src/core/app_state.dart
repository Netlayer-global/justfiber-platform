import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'models.dart';

const defaultApiBase = 'http://103.139.191.114:4000';
const _mobileKey = 'justfiber.mobile';
const _accessTokenKey = 'justfiber.access_token';
const _refreshTokenKey = 'justfiber.refresh_token';
const _latestBookingNumberKey = 'justfiber.latest_booking_number';
const _latestBookingMobileKey = 'justfiber.latest_booking_mobile';
const _latestBookingPlanKey = 'justfiber.latest_booking_plan';
const _latestBookingAmountKey = 'justfiber.latest_booking_amount';
const _latestBookingStepKey = 'justfiber.latest_booking_step';
const _latestBookingDateKey = 'justfiber.latest_booking_date';
const _latestBookingSlotKey = 'justfiber.latest_booking_slot';

class AppState extends ChangeNotifier {
  final api = ApiClient(baseUrl: defaultApiBase);

  CustomerSession? session;
  String? demoOtp;
  bool busy = false;
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
    nextBillDate: '',
    lastPaymentAmount: 0,
    billCycle: '',
    billMode: '',
    generatedDate: '',
    paymentStatus: '',
    lastPaymentDate: '',
    adjustmentPreview: 0,
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
    String? firstError;
    try {
      try {
        dashboard = await api.fetchDashboard(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        wifi = await api.fetchWifi(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        billing = await api.fetchBilling(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        requests = await api.fetchRequests(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        tickets = await api.fetchTickets(current);
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
        connectedDevices = await api.fetchConnectedDevices(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        installerVisits = await api.fetchServiceVisits(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        parentalRules = await api.fetchParentalRules(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        speedTest = await api.fetchSpeedTest(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        networkQuality = await api.fetchNetworkQuality(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      try {
        planChangeOptions = await api.fetchPlanChangeOptions(current);
      } catch (e) {
        firstError ??= e.toString();
      }
      error = firstError;
    } finally {
      busy = false;
      notifyListeners();
    }
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

  Future<bool> createBooking({
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
        address: address,
        pinCode: pinCode,
        lat: lat,
        lng: lng,
        preferredDate: preferredDate,
        preferredSlotCode: preferredSlotCode,
        preferredSlotLabel: preferredSlotLabel,
      );
      latestBookingLookupMobile = current?.mobile ?? mobile;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_latestBookingNumberKey, latestBooking!.bookingNumber);
      await prefs.setString(_latestBookingMobileKey, latestBookingLookupMobile!);
      await prefs.setString(_latestBookingPlanKey, latestBooking!.planName);
      await prefs.setDouble(_latestBookingAmountKey, latestBooking!.amount);
      await prefs.setString(_latestBookingStepKey, latestBooking!.currentStep);
      await prefs.setString(_latestBookingDateKey, latestBooking!.preferredDate);
      await prefs.setString(_latestBookingSlotKey, latestBooking!.preferredSlotLabel);
      if (current != null) {
        bookingTracking = await api.fetchBookingTracking(current, latestBooking!.bookingNumber);
        installerVisits = await api.fetchServiceVisits(current);
      } else if (latestBookingLookupMobile != null && latestBookingLookupMobile!.isNotEmpty) {
        bookingTracking = await api.fetchPublicBookingTracking(
          bookingNumber: latestBooking!.bookingNumber,
          mobile: latestBookingLookupMobile!,
        );
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
        installerVisits = await api.fetchServiceVisits(current);
        notifications = await api.fetchNotifications(current);
        requests = await api.fetchRequests(current);
        tickets = await api.fetchTickets(current);
        if ((bookingNumber ?? '').isNotEmpty) {
          bookingTracking = await api.fetchBookingTracking(current, bookingNumber!);
        }
      } else if ((latestBookingLookupMobile ?? '').isNotEmpty) {
        if ((bookingNumber ?? '').isEmpty) return;
        bookingTracking = await api.fetchPublicBookingTracking(
          bookingNumber: bookingNumber!,
          mobile: latestBookingLookupMobile!,
        );
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
      prefs.remove(_latestBookingNumberKey);
      prefs.remove(_latestBookingMobileKey);
      prefs.remove(_latestBookingPlanKey);
      prefs.remove(_latestBookingAmountKey);
      prefs.remove(_latestBookingStepKey);
      prefs.remove(_latestBookingDateKey);
      prefs.remove(_latestBookingSlotKey);
    });
    session = null;
    demoOtp = null;
    error = null;
    latestBooking = null;
    latestBookingLookupMobile = null;
    bookingTracking = null;
    installerVisits = const [];
    requests = const [];
    tickets = const [];
    notifications = const [];
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
      );
      latestBookingLookupMobile = latestBookingMobile;
      if ((latestBookingLookupMobile ?? '').isNotEmpty) {
        try {
          bookingTracking = await api.fetchPublicBookingTracking(
            bookingNumber: latestBooking!.bookingNumber,
            mobile: latestBookingLookupMobile!,
          );
        } catch (_) {
          // keep stored booking summary even if public tracking isn't available yet
        }
      }
    }
    if (mobile == null || accessToken == null || refreshToken == null) {
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
