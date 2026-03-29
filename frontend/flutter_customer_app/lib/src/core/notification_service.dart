import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class CustomerNotificationService {
  CustomerNotificationService._();

  static final CustomerNotificationService instance = CustomerNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: androidSettings);
    await _plugin.initialize(settings);

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

    _initialized = true;
  }

  Future<void> showAlert({
    required int id,
    required String title,
    required String body,
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

    await _plugin.show(id, title, body, details);
  }

  int stableIdFor(String input) {
    return input.hashCode & 0x7fffffff;
  }
}
