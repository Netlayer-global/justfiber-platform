import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'models.dart';

const installerApiBase = 'http://103.139.191.114:4000';
const _installerLoginKey = 'installer.login';
const _installerAccessTokenKey = 'installer.access_token';
const _installerRefreshTokenKey = 'installer.refresh_token';

class InstallerAppState extends ChangeNotifier {
  final api = InstallerApiClient(baseUrl: installerApiBase);

  InstallerSession? session;
  bool busy = false;
  bool restoringSession = true;
  String? error;
  InstallerDashboard dashboard = const InstallerDashboard(
    todayNewInstallationJobs: 0,
    pendingJobs: 0,
    completedJobs: 0,
    availabilityStatus: '-',
  );
  InstallerProfile profile = const InstallerProfile(
    fullName: '',
    installerCode: '',
    phone: '',
    availabilityStatus: '-',
  );
  List<InstallerJob> jobs = const [];
  List<InstallerNotificationItem> notifications = const [];
  ProvisioningPreview? preview;
  String? selectedJobId;

  InstallerAppState() {
    restoreSession();
  }

  Future<bool> login(String login, String password) async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      session = await api.login(login, password);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_installerLoginKey, session!.login);
      await prefs.setString(_installerAccessTokenKey, session!.accessToken);
      await prefs.setString(_installerRefreshTokenKey, session!.refreshToken);
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
      profile = await api.fetchProfile(current);
      jobs = await api.fetchJobs(current);
      notifications = await api.fetchNotifications(current);
      if (selectedJobId != null && selectedJobId!.isNotEmpty) {
        preview = await api.fetchProvisioningPreview(current, selectedJobId!);
      }
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> loadPreview(String jobId) async {
    final current = session;
    if (current == null) return false;
    selectedJobId = jobId;
    busy = true;
    error = null;
    notifyListeners();
    try {
      preview = await api.fetchProvisioningPreview(current, jobId);
      return true;
    } catch (e) {
      error = e.toString();
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> runActivationFlow(String jobId, String serial) async {
    final current = session;
    if (current == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await api.acceptJob(current, jobId);
      await api.startTravel(current, jobId);
      await api.startOnsite(current, jobId);
      await api.setManualSerial(current, jobId, serial);
      await api.checkOptical(current, jobId);
      await api.saveChecklist(current, jobId);
      await api.activate(current, jobId);
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

  void logout() {
    SharedPreferences.getInstance().then((prefs) {
      prefs.remove(_installerLoginKey);
      prefs.remove(_installerAccessTokenKey);
      prefs.remove(_installerRefreshTokenKey);
    });
    session = null;
    preview = null;
    selectedJobId = null;
    error = null;
    jobs = const [];
    notifications = const [];
    dashboard = const InstallerDashboard(
      todayNewInstallationJobs: 0,
      pendingJobs: 0,
      completedJobs: 0,
      availabilityStatus: '-',
    );
    profile = const InstallerProfile(
      fullName: '',
      installerCode: '',
      phone: '',
      availabilityStatus: '-',
    );
    restoringSession = false;
    notifyListeners();
  }

  Future<void> restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final login = prefs.getString(_installerLoginKey);
    final accessToken = prefs.getString(_installerAccessTokenKey);
    final refreshToken = prefs.getString(_installerRefreshTokenKey);
    if (login == null || accessToken == null || refreshToken == null) {
      restoringSession = false;
      notifyListeners();
      return;
    }
    session = InstallerSession(login: login, accessToken: accessToken, refreshToken: refreshToken);
    notifyListeners();
    await refresh();
    restoringSession = false;
    notifyListeners();
  }
}

class InstallerStateScope extends InheritedNotifier<InstallerAppState> {
  const InstallerStateScope({
    super.key,
    required InstallerAppState appState,
    required Widget child,
  }) : super(notifier: appState, child: child);

  static InstallerAppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<InstallerStateScope>();
    assert(scope != null, 'InstallerStateScope not found');
    return scope!.notifier!;
  }
}
