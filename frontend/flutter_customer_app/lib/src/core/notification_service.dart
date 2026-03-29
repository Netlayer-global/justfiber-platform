import 'dart:async';

import 'package:flutter_local_notifications/flutter_local_notifications.dart';

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

    final androidPlugin = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
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
    final response = launchDetails?.notificationResponse;
    final payload = response?.payload;
    if (launchDetails?.didNotificationLaunchApp == true && payload != null && payload.isNotEmpty) {
      _initialPayload = payload;
    }

    _initialized = true;
  }

  String? takeInitialPayload() {
    final payload = _initialPayload;
    _initialPayload = null;
    return payload;
  }

  Future<void> showAlert({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    if (!_initialized) {
      await initialize();
    }

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

  int stableIdFor(String input) {
    return input.hashCode & 0x7fffffff;
  }
}
