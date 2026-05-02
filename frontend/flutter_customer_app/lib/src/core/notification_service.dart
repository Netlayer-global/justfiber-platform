import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// Top-level background handler — MUST be a top-level function (not a class method).
// Called by Firebase when a message arrives while the app is killed or in background.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await CustomerNotificationService.instance.showAlert(
    id: message.messageId.hashCode & 0x7fffffff,
    title: message.notification?.title ?? 'JustFiber',
    body: message.notification?.body ?? '',
    payload: message.data['target'] ?? '',
  );
}

class CustomerNotificationService {
  CustomerNotificationService._();

  static final CustomerNotificationService instance = CustomerNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  final StreamController<String> _tapController = StreamController<String>.broadcast();
  bool _initialized = false;
  String? _initialPayload;

  Stream<String> get tapStream => _tapController.stream;

  Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: androidSettings);
    await _plugin.initialize(
      settings,
      onDidReceiveNotificationResponse: (response) {
        final payload = response.payload;
        if (payload != null && payload.isNotEmpty) {
          _tapController.add(payload);
        }
      },
    );

    final androidPlugin =
        _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.requestNotificationsPermission();
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        'justfiber_customer_alerts',
        'JustFiber Alerts',
        description: 'Billing reminders, support updates, and service alerts',
        importance: Importance.max,
      ),
    );

    final launchDetails = await _plugin.getNotificationAppLaunchDetails();
    final payload = launchDetails?.notificationResponse?.payload;
    if (launchDetails?.didNotificationLaunchApp == true &&
        payload != null &&
        payload.isNotEmpty) {
      _initialPayload = payload;
    }

    // FCM: request permission and listen for foreground messages.
    // Guarded — no-ops silently if Firebase was not initialised (missing google-services.json).
    try {
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final n = message.notification;
        if (n == null) return;
        showAlert(
          id: message.messageId.hashCode & 0x7fffffff,
          title: n.title ?? 'JustFiber',
          body: n.body ?? '',
          payload: message.data['target'] ?? '',
        );
      });
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        final target = message.data['target'] ?? '';
        if (target.isNotEmpty) _tapController.add(target);
      });
    } catch (_) {}

    _initialized = true;
  }

  String? takeInitialPayload() {
    final payload = _initialPayload;
    _initialPayload = null;
    return payload;
  }

  /// Returns the FCM registration token, or null if Firebase is not configured.
  Future<String?> getFcmToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }

  Future<void> showAlert({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_initialized) await initialize();

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'justfiber_customer_alerts',
        'JustFiber Alerts',
        channelDescription: 'Billing reminders, support updates, and service alerts',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        visibility: NotificationVisibility.public,
      ),
    );

    await _plugin.show(id, title, body, details, payload: payload);
  }

  int stableIdFor(String input) => input.hashCode & 0x7fffffff;
}
