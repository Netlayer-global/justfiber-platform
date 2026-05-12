import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'models.dart';
import 'notification_service.dart';

const defaultApiBase = String.fromEnvironment(
  'JUSTFIBER_API_BASE',
  defaultValue: 'https://api.justfiber.in',
);
const _mobileKey = 'justfiber.mobile';
const _accessTokenKey = 'justfiber.access_token';
const _refreshTokenKey = 'justfiber.refresh_token';
const _selectedCustomerKey = 'justfiber.selected_customer_id';
const _planChangeDraftKey = 'justfiber.plan_change_draft';
const _bookingFlowDraftKey = 'justfiber.booking_flow_draft';
const _surfacedNotificationIdsKey = 'justfiber.surfaced_notification_ids';

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
  Future<void>? _refreshInFlight;
  String? error;
  String? bookingError;
  String? selectedCustomerId;
  String? pendingNavigationTarget;
  String? pendingNotificationReadId;
  DateTime? lastSyncedAt;
  final Set<String> _seenNotificationIds = <String>{};
  final Map<String, DateTime> _recentNotificationFingerprints =
      <String, DateTime>{};

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
    invoiceLifecycle: '',
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

  JazeBillingView? jazeBilling;

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
  BookingQuote? pendingPaymentBooking;
  BookingTrackingData? bookingTracking;
  BookingQuote? bookingDraft;
  FeasibilityResult? feasibility;
  PlanChangeApplyResult? lastPlanChangeResult;
  PlanChangeDraft? planChangeDraft;
  BookingFlowDraft? bookingFlowDraft;

  SpeedTestData speedTest = const SpeedTestData(
    downloadMbps: 0,
    uploadMbps: 0,
    latencyMs: 0,
    packetLossPercent: 0,
    status: '',
  );
  bool speedTestBusy = false;
  String? speedTestError;

  NetworkQualityData networkQuality = const NetworkQualityData(
    latencyMs: 0,
    packetLossPercent: 0,
    jitterMs: 0,
    opticalRxPower: 0,
    quality: '',
  );

  Future<String?> _handleUnauthorized() async {
    final current = session;
    if (current == null || current.refreshToken.isEmpty) {
      if (current != null) {
        await _clearPersistedSession(
            message: 'Session expired. Please log in again.');
      }
      return null;
    }
    try {
      final nextAccessToken =
          await api.refreshCustomerSession(current.refreshToken);
      if (nextAccessToken.isEmpty) {
        await _clearPersistedSession(
            message: 'Session expired. Please log in again.');
        return null;
      }
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
      await _clearPersistedSession(
          message: 'Session expired. Please log in again.');
      return null;
    }
  }

  Future<void> _clearPersistedSession({String? message}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_mobileKey);
    await prefs.remove(_accessTokenKey);
    await prefs.remove(_refreshTokenKey);
    await prefs.remove(_selectedCustomerKey);
    await prefs.remove(_planChangeDraftKey);
    await prefs.remove(_bookingFlowDraftKey);
    await prefs.remove(_surfacedNotificationIdsKey);
    session = null;
    demoOtp = null;
    error = message;
    selectedCustomerId = null;
    restoringSession = false;
    _resetCustomerState();
    notifyListeners();
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
      final nextSession = await api.verifyOtp(mobile, otp);
      _resetCustomerState();
      session = nextSession;
      selectedCustomerId = null;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_mobileKey, session!.mobile);
      await prefs.setString(_accessTokenKey, session!.accessToken);
      await prefs.setString(_refreshTokenKey, session!.refreshToken);
      await prefs.remove(_selectedCustomerKey);
      await prefs.remove(_planChangeDraftKey);
      await prefs.remove(_surfacedNotificationIdsKey);
      unawaited(refresh(silent: true));
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> refresh({bool silent = false}) async {
    final current = session;
    if (current == null) return;
    final existingRefresh = _refreshInFlight;
    if (existingRefresh != null) return existingRefresh;
    if (!silent) busy = true;
    error = null;
    notifyListeners();
    final refreshFuture =
        _performRefresh(current, showBusy: !silent).whenComplete(() {
      _refreshInFlight = null;
    });
    _refreshInFlight = refreshFuture;
    return refreshFuture;
  }

  Future<void> _performRefresh(CustomerSession current,
      {required bool showBusy}) async {
    final failures = <String>[];
    Future<void> runRefreshTask(
        String label, Future<void> Function() task) async {
      try {
        await task();
      } catch (e) {
        failures.add('$label: $e');
      }
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final savedSelectedCustomer = prefs.getString(_selectedCustomerKey);
      final connectionResult = await api.fetchConnections(current,
          selectedCustomerId: selectedCustomerId ?? savedSelectedCustomer);
      final nextSelected = connectionResult.$1;
      connections = connectionResult.$2;
      selectedCustomerId = nextSelected ??
          (connections.isNotEmpty ? connections.first.customerId : null);
      if (selectedCustomerId != null) {
        await prefs.setString(_selectedCustomerKey, selectedCustomerId!);
      }

      final hasConnections = connections.isNotEmpty;
      await Future.wait<void>([
        if (hasConnections)
          runRefreshTask(
              'dashboard',
              () async => dashboard = await api.fetchDashboard(current,
                  customerId: selectedCustomerId)),
        if (hasConnections)
          runRefreshTask(
              'wifi',
              () async => wifi =
                  await api.fetchWifi(current, customerId: selectedCustomerId)),
        if (hasConnections)
          runRefreshTask(
              'billing',
              () async => billing = await api.fetchBilling(current,
                  customerId: selectedCustomerId)),
        if (hasConnections)
          runRefreshTask(
              'jaze billing',
              () async => jazeBilling = await api.fetchJazeBilling(
                  current,
                  customerId: selectedCustomerId)),
        runRefreshTask('notifications',
            () async => notifications = await api.fetchNotifications(current)),
        runRefreshTask(
            'pending booking',
            () async => pendingPaymentBooking =
                await api.fetchPendingPaymentBooking(current)),
      ]);

      lastSyncedAt = DateTime.now();
      await _surfaceNewNotifications();
      error = failures.isEmpty ? null : failures.first;
      unawaited(_refreshSecondaryData(current));
    } catch (e) {
      error = e.toString();
    } finally {
      if (showBusy) busy = false;
      notifyListeners();
    }
  }

  Future<void> _refreshSecondaryData(CustomerSession current) async {
    if (session?.accessToken != current.accessToken) return;
    final failures = <String>[];
    Future<void> runTask(String label, Future<void> Function() task) async {
      try {
        await task();
      } catch (e) {
        failures.add('$label: $e');
      }
    }

    await Future.wait<void>([
      runTask(
          'requests',
          () async => requests =
              await api.fetchRequests(current, customerId: selectedCustomerId)),
      runTask(
          'tickets',
          () async => tickets =
              await api.fetchTickets(current, customerId: selectedCustomerId)),
      runTask('faqs', () async => faqs = await api.fetchFaqs()),
      runTask('addons', () async => addons = await api.fetchAddons(current)),
      runTask('banners', () async => banners = await api.fetchAppBanners()),
      runTask('plans', () async => plans = await api.fetchPlans()),
      runTask(
          'devices',
          () async => connectedDevices = await api
              .fetchConnectedDevices(current, customerId: selectedCustomerId)),
      runTask(
          'plan options',
          () async => planChangeOptions = await api
              .fetchPlanChangeOptions(current, customerId: selectedCustomerId)),
      runTask(
          'parental rules',
          () async => parentalRules = await api.fetchParentalRules(current,
              customerId: selectedCustomerId)),
      runTask(
          'network quality',
          () async => networkQuality = await api.fetchNetworkQuality(current,
              customerId: selectedCustomerId)),
      runTask(
          'speed test',
          () async => speedTest = await api.fetchSpeedTest(current,
              customerId: selectedCustomerId)),
      runTask(
          'service visits',
          () async => installerVisits = await api.fetchServiceVisits(current,
              customerId: selectedCustomerId)),
    ]);

    final bookingNumber = latestBooking?.bookingNumber ?? '';
    if (bookingNumber.isNotEmpty) {
      await runTask(
          'booking tracking',
          () async => bookingTracking =
              await api.fetchBookingTracking(current, bookingNumber));
    }

    if (session?.accessToken != current.accessToken) return;
    if (failures.isNotEmpty && (error ?? '').isEmpty) {
      error = failures.first;
    }
    notifyListeners();
  }

  Future<void> _surfaceNewNotifications() async {
    await CustomerNotificationService.instance.initialize();
    final prefs = await SharedPreferences.getInstance();
    if (_seenNotificationIds.isEmpty) {
      _seenNotificationIds.addAll(
          prefs.getStringList(_surfacedNotificationIdsKey) ?? const <String>[]);
    }

    final candidates = notifications
        .where((item) =>
            item.id.isNotEmpty &&
            item.readAt.isEmpty &&
            !_seenNotificationIds.contains(item.id))
        .toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));

    final latestByFingerprint = <String, NotificationItem>{};
    for (final item in candidates) {
      latestByFingerprint[_notificationFingerprint(item)] = item;
    }

    for (final item in candidates) {
      final fingerprint = _notificationFingerprint(item);
      if (latestByFingerprint[fingerprint]?.id != item.id) {
        _seenNotificationIds.add(item.id);
        continue;
      }
      final lastShownAt = _recentNotificationFingerprints[fingerprint];
      if (lastShownAt != null &&
          DateTime.now().difference(lastShownAt) <
              const Duration(minutes: 10)) {
        _seenNotificationIds.add(item.id);
        continue;
      }
      _seenNotificationIds.add(item.id);
      _recentNotificationFingerprints[fingerprint] = DateTime.now();
      final payload = jsonEncode({
        'target': _notificationTarget(item),
        'notificationId': item.id,
      });
      await CustomerNotificationService.instance.showAlert(
        id: CustomerNotificationService.instance.stableIdFor(item.id),
        title: item.title.isEmpty ? 'JustFiber update' : item.title,
        body: item.body.isEmpty
            ? 'Open the app to review the latest update.'
            : item.body,
        payload: payload,
      );
    }

    await prefs.setStringList(_surfacedNotificationIdsKey,
        _seenNotificationIds.take(200).toList(growable: false));
  }

  String _notificationFingerprint(NotificationItem item) {
    final type = item.type.trim().toLowerCase();
    final target = _notificationTarget(item);
    final title = item.title.trim().toLowerCase();
    final body = item.body.trim().toLowerCase();
    return '$type|$target|$title|$body';
  }

  Future<void> savePlanChangeDraft({
    required String planCode,
    required String planName,
    required String billingTerm,
    required String effectiveMode,
    required int step,
    bool notifyResume = false,
  }) async {
    planChangeDraft = PlanChangeDraft(
      planCode: planCode,
      planName: planName,
      billingTerm: billingTerm,
      effectiveMode: effectiveMode,
      step: step,
      savedAt: DateTime.now().toIso8601String(),
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _planChangeDraftKey,
      jsonEncode({
        'planCode': planCode,
        'planName': planName,
        'billingTerm': billingTerm,
        'effectiveMode': effectiveMode,
        'step': step,
        'savedAt': planChangeDraft!.savedAt,
      }),
    );
    if (notifyResume) {
      await CustomerNotificationService.instance.initialize();
      await CustomerNotificationService.instance.showAlert(
        id: CustomerNotificationService.instance
            .stableIdFor('plan-change-resume'),
        title: 'Resume your plan change',
        body: 'Continue switching to $planName when you are ready.',
        payload: jsonEncode({'target': 'plans_resume'}),
      );
    }
    notifyListeners();
  }

  Future<void> clearPlanChangeDraft() async {
    planChangeDraft = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_planChangeDraftKey);
    notifyListeners();
  }

  Future<void> saveBookingFlowDraft({
    required int step,
    required String selectedPlanCode,
    required int selectedDurationMonths,
    required String selectedDurationLabel,
    required String selectedSlotCode,
    required String selectedSlotLabel,
    required String preferredDateIso,
    required String name,
    required String mobile,
    required String email,
    required String address,
    required String pinCode,
    required double latitude,
    required double longitude,
    required bool hasPickedLocation,
    required bool usedCurrentLocation,
  }) async {
    bookingFlowDraft = BookingFlowDraft(
      step: step,
      selectedPlanCode: selectedPlanCode,
      selectedDurationMonths: selectedDurationMonths,
      selectedDurationLabel: selectedDurationLabel,
      selectedSlotCode: selectedSlotCode,
      selectedSlotLabel: selectedSlotLabel,
      preferredDateIso: preferredDateIso,
      name: name,
      mobile: mobile,
      email: email,
      address: address,
      pinCode: pinCode,
      latitude: latitude,
      longitude: longitude,
      hasPickedLocation: hasPickedLocation,
      usedCurrentLocation: usedCurrentLocation,
      savedAt: DateTime.now().toIso8601String(),
    );
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _bookingFlowDraftKey,
      jsonEncode({
        'step': step,
        'selectedPlanCode': selectedPlanCode,
        'selectedDurationMonths': selectedDurationMonths,
        'selectedDurationLabel': selectedDurationLabel,
        'selectedSlotCode': selectedSlotCode,
        'selectedSlotLabel': selectedSlotLabel,
        'preferredDateIso': preferredDateIso,
        'name': name,
        'mobile': mobile,
        'email': email,
        'address': address,
        'pinCode': pinCode,
        'latitude': latitude,
        'longitude': longitude,
        'hasPickedLocation': hasPickedLocation,
        'usedCurrentLocation': usedCurrentLocation,
        'savedAt': bookingFlowDraft!.savedAt,
      }),
    );
    notifyListeners();
  }

  Future<void> clearBookingFlowDraft() async {
    bookingFlowDraft = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_bookingFlowDraftKey);
    notifyListeners();
  }

  String _notificationTarget(NotificationItem item) {
    final payload = item.payload;
    if (payload['upgradeRecommended'] == true ||
        (payload['recommendedPlanCode'] ?? '').toString().isNotEmpty) {
      return 'plans';
    }
    final type = item.type.toLowerCase();
    final text = '${item.title} ${item.body}'.toLowerCase();
    if (type.contains('billing_') ||
        type.contains('refund') ||
        type.contains('receipt')) {
      return 'billing';
    }
    if (type.contains('booking') ||
        type.contains('installer') ||
        type.contains('job')) {
      return 'tracking';
    }
    if (type.contains('ticket') ||
        type.contains('request') ||
        type.contains('support')) {
      return 'support';
    }
    if (text.contains('invoice') ||
        text.contains('payment') ||
        text.contains('due') ||
        text.contains('receipt') ||
        text.contains('gst')) {
      return 'billing';
    }
    if (text.contains('booking') ||
        text.contains('install') ||
        text.contains('installer') ||
        text.contains('visit')) {
      return 'tracking';
    }
    if (text.contains('ticket') ||
        text.contains('request') ||
        text.contains('complaint') ||
        text.contains('support')) {
      return 'support';
    }
    return 'support';
  }

  void handleNotificationPayload(String payload) {
    try {
      final data = jsonDecode(payload);
      if (data is Map<String, dynamic>) {
        final target = _normalizeNavigationTarget(
            (data['target'] ?? '').toString().trim());
        final notificationId =
            (data['notificationId'] ?? data['id'] ?? '').toString().trim();
        if (notificationId.isNotEmpty) {
          pendingNotificationReadId = notificationId;
        }
        if (target.isNotEmpty) {
          pendingNavigationTarget = target;
          notifyListeners();
        } else if (notificationId.isNotEmpty) {
          notifyListeners();
        }
      }
    } catch (_) {}
  }

  String _normalizeNavigationTarget(String raw) {
    final target = raw.toLowerCase().replaceAll('-', '_').trim();
    switch (target) {
      case 'bill':
      case 'billing':
      case 'invoice':
      case 'payment':
      case 'receipt':
        return 'billing';
      case 'booking':
      case 'install':
      case 'installer':
      case 'tracking':
      case 'service':
        return 'tracking';
      case 'ticket':
      case 'complaint':
      case 'request':
      case 'support':
        return 'support';
      case 'plan':
      case 'plans':
      case 'plans_resume':
      case 'upgrade':
        return target == 'plans_resume' ? 'plans_resume' : 'plans';
      default:
        return target;
    }
  }

  String? consumePendingNavigationTarget() {
    final target = pendingNavigationTarget;
    pendingNavigationTarget = null;
    notifyListeners();
    return target;
  }

  String? consumePendingNotificationReadId() {
    final id = pendingNotificationReadId;
    pendingNotificationReadId = null;
    notifyListeners();
    return id;
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
      final bookingNumber = latestBooking?.bookingNumber ?? '';
      final futures = await Future.wait([
        api.fetchServiceVisits(current, customerId: selectedCustomerId),
        api.fetchRequests(current, customerId: selectedCustomerId),
        api.fetchTickets(current, customerId: selectedCustomerId),
        api.fetchNotifications(current),
        if (bookingNumber.isNotEmpty)
          api
              .fetchBookingTracking(current, bookingNumber)
              .then<BookingTrackingData?>((v) => v)
              .catchError((_) => null),
      ]);
      installerVisits = futures[0] as List<InstallerVisitItem>;
      requests = futures[1] as List<RequestItem>;
      tickets = futures[2] as List<SupportTicketItem>;
      notifications = futures[3] as List<NotificationItem>;
      if (bookingNumber.isNotEmpty && futures.length > 4) {
        final tracking = futures[4] as BookingTrackingData?;
        if (tracking != null) bookingTracking = tracking;
      }
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
      parentalRules =
          await api.fetchParentalRules(current, customerId: selectedCustomerId);
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
      connectedDevices = await api.fetchConnectedDevices(current,
          customerId: selectedCustomerId);
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  bool get isOffline {
    final e = (error ?? '').toLowerCase();
    return e.contains('no internet') ||
        e.contains('unable to connect') ||
        e.contains('socket') ||
        e.contains('network') ||
        e.contains('unreachable') ||
        e.contains('connection refused') ||
        e.contains('failed host lookup');
  }

  Future<void> selectConnection(String customerId) async {
    selectedCustomerId = customerId;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_selectedCustomerKey, customerId);
    notifyListeners();
    await refresh();
  }

  Future<void> runSpeedTest() async {
    final current = session;
    if (current == null || speedTestBusy) return;
    speedTestBusy = true;
    speedTestError = null;
    notifyListeners();
    try {
      speedTest = await api.fetchSpeedTest(current, customerId: selectedCustomerId);
    } catch (e) {
      speedTestError = e.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
    } finally {
      speedTestBusy = false;
      notifyListeners();
    }
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
    final unreadIds = notifications
        .where((item) => item.readAt.isEmpty && item.id.isNotEmpty)
        .map((item) => item.id)
        .toList(growable: false);
    if (unreadIds.isEmpty) return;
    for (final id in unreadIds) {
      await markNotificationRead(id);
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
      requests =
          await api.fetchRequests(current, customerId: selectedCustomerId);
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
    final payableAmount = amount ?? billing.dueAmount;
    if (payableAmount <= 0) {
      error = 'No payable bill amount is available right now.';
      notifyListeners();
      return null;
    }
    busy = true;
    error = null;
    notifyListeners();
    try {
      return await api.createBillingPaymentOrder(
        current,
        customerId: selectedCustomerId,
        amount: payableAmount,
      );
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> loadJazeBilling() async {
    final current = session;
    if (current == null) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      jazeBilling = await api.fetchJazeBilling(
        current,
        customerId: selectedCustomerId,
      );
    } catch (e) {
      error = e.toString();
      jazeBilling = null;
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
    error = null;
    notifyListeners();
    try {
      return await api.createBookingPaymentOrder(
        current,
        bookingNumber: bookingNumber,
        amount: amount,
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
    required String billingTerm,
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
        billingTerm: billingTerm,
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
    required String billingTerm,
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
        billingTerm: billingTerm,
      );
      lastPlanChangeResult = result;
      await clearPlanChangeDraft();
      return result.requestNumber.isEmpty ? null : result.requestNumber;
    } catch (e) {
      error = e.toString();
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> cancelPlanChangeCheckout() async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final ok =
          await api.cancelPlanChange(current, customerId: selectedCustomerId);
      await clearPlanChangeDraft();
      await refresh();
      return ok;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> completePlanChange() async {
    final current = session;
    if (current == null) return false;
    try {
      return await api.completePlanChange(current, customerId: selectedCustomerId);
    } catch (_) {
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

  Future<void> refreshPlans() async {
    error = null;
    notifyListeners();
    try {
      plans = await api.fetchPlans();
    } catch (e) {
      error = e.toString();
    } finally {
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
    String? planCode,
    String? planName,
    int? durationMonths,
    String? durationLabel,
    String? preferredSlotCode,
    String? preferredSlotLabel,
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
        planCode: planCode,
        planName: planName,
        durationMonths: durationMonths,
        durationLabel: durationLabel,
        preferredSlotCode: preferredSlotCode,
        preferredSlotLabel: preferredSlotLabel,
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
    bookingBusy = true;
    bookingError = null;
    notifyListeners();
    try {
      return await api.submitConnectionLead(
        fullName: fullName,
        mobile: mobile,
        email: email,
        address: address,
        pinCode: pinCode,
        lat: lat,
        lng: lng,
        planCode: planCode,
        planName: planName,
        durationMonths: durationMonths,
        durationLabel: durationLabel,
        preferredSlotCode: preferredSlotCode,
        preferredSlotLabel: preferredSlotLabel,
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
    String paymentMode = 'razorpay',
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
      if (session != null &&
          latestBooking != null &&
          latestBooking!.bookingNumber.isNotEmpty) {
        try {
          bookingTracking = await api.fetchBookingTracking(
              session!, latestBooking!.bookingNumber);
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
          preferredSlotLabel:
              preferredSlotLabel ?? latestBooking?.preferredSlotLabel,
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
    clearBookingFlowDraft();
    notifyListeners();
  }

  void logout() {
    _clearPersistedSession();
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
      invoiceLifecycle: '',
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
    pendingPaymentBooking = null;
    bookingTracking = null;
    bookingDraft = null;
    bookingFlowDraft = null;
    feasibility = null;
    lastPlanChangeResult = null;
    planChangeDraft = null;
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
    speedTestBusy = false;
    speedTestError = null;
    pendingNavigationTarget = null;
    pendingNotificationReadId = null;
    lastSyncedAt = null;
    _seenNotificationIds.clear();
    _recentNotificationFingerprints.clear();
    busy = false;
    bookingBusy = false;
  }

  Future<void> restoreSession() async {
    restoringSession = true;
    error = null;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    final mobile = prefs.getString(_mobileKey);
    final accessToken = prefs.getString(_accessTokenKey);
    final refreshToken = prefs.getString(_refreshTokenKey);
    selectedCustomerId = prefs.getString(_selectedCustomerKey);
    final savedPlanChangeDraft = prefs.getString(_planChangeDraftKey);
    final savedBookingFlowDraft = prefs.getString(_bookingFlowDraftKey);
    if (savedPlanChangeDraft != null && savedPlanChangeDraft.isNotEmpty) {
      try {
        final map = jsonDecode(savedPlanChangeDraft);
        if (map is Map<String, dynamic>) {
          planChangeDraft = PlanChangeDraft(
            planCode: (map['planCode'] ?? '').toString(),
            planName: (map['planName'] ?? '').toString(),
            billingTerm: (map['billingTerm'] ?? 'monthly').toString(),
            effectiveMode: (map['effectiveMode'] ?? 'immediate').toString(),
            step: int.tryParse('${map['step'] ?? 0}') ?? 0,
            savedAt: (map['savedAt'] ?? '').toString(),
          );
        }
      } catch (_) {}
    }
    if (savedBookingFlowDraft != null && savedBookingFlowDraft.isNotEmpty) {
      try {
        final map = jsonDecode(savedBookingFlowDraft);
        if (map is Map<String, dynamic>) {
          bookingFlowDraft = BookingFlowDraft(
            step: int.tryParse('${map['step'] ?? 0}') ?? 0,
            selectedPlanCode: (map['selectedPlanCode'] ?? '').toString(),
            selectedDurationMonths:
                int.tryParse('${map['selectedDurationMonths'] ?? 1}') ?? 1,
            selectedDurationLabel:
                (map['selectedDurationLabel'] ?? '1 month').toString(),
            selectedSlotCode: (map['selectedSlotCode'] ?? 'morning').toString(),
            selectedSlotLabel:
                (map['selectedSlotLabel'] ?? '10 AM - 1 PM').toString(),
            preferredDateIso: (map['preferredDateIso'] ?? '').toString(),
            name: (map['name'] ?? '').toString(),
            mobile: (map['mobile'] ?? '').toString(),
            email: (map['email'] ?? '').toString(),
            address: (map['address'] ?? '').toString(),
            pinCode: (map['pinCode'] ?? '').toString(),
            latitude:
                double.tryParse('${map['latitude'] ?? 28.6139}') ?? 28.6139,
            longitude:
                double.tryParse('${map['longitude'] ?? 77.2090}') ?? 77.2090,
            hasPickedLocation: map['hasPickedLocation'] == true,
            usedCurrentLocation: map['usedCurrentLocation'] == true,
            savedAt: (map['savedAt'] ?? '').toString(),
          );
        }
      } catch (_) {}
    }
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
    restoringSession = false;
    notifyListeners();
    unawaited(refresh(silent: true));
    unawaited(_registerFcmToken());
  }

  Future<void> _registerFcmToken() async {
    final s = session;
    if (s == null) return;
    try {
      final token = await CustomerNotificationService.instance.getFcmToken();
      if (token != null && token.isNotEmpty) {
        await api.registerFcmToken(s, token);
      }
    } catch (_) {}
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
