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
  );
  BillingData billing = const BillingData(
    currentPlan: 'JustFiber 100',
    dueAmount: 0,
    nextBillDate: '05/05/2029',
    lastPaymentAmount: 1000,
  );
  List<RequestItem> requests = const [];
  List<NotificationItem> notifications = const [];
  List<FaqItem> faqs = const [];
  List<AddonItem> addons = const [];
  List<String> connectedDevices = const [];

  AppState() {
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
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
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
      await api.updateWifi(current, password);
      await refresh();
    } catch (e) {
      error = e.toString();
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
