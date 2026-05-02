import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// Top-level background handler — MUST be a top-level function.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await InstallerNotificationService.instance.showAlert(
    id: message.messageId.hashCode & 0x7fffffff,
    title: message.notification?.title ?? 'JustFiber Field',
    body: message.notification?.body ?? '',
  );
}

class InstallerNotificationService {
  InstallerNotificationService._();

  static final InstallerNotificationService instance = InstallerNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized) return;

    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: androidSettings);
    await _plugin.initialize(settings);

    final androidPlugin =
        _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await androidPlugin?.requestNotificationsPermission();
    await androidPlugin?.createNotificationChannel(
      const AndroidNotificationChannel(
        'installer_field_alerts',
        'Installer Field Alerts',
        description: 'New installer jobs, complaints, and field alerts',
        importance: Importance.max,
      ),
    );

    // FCM: request permission and handle foreground messages.
    // Guarded — no-ops silently if Firebase was not initialised.
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
          title: n.title ?? 'JustFiber Field',
          body: n.body ?? '',
        );
      });
    } catch (_) {}

    _initialized = true;
  }

  /// Returns the FCM registration token, or null if unavailable.
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
  }) async {
    if (!_initialized) await initialize();

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'installer_field_alerts',
        'Installer Field Alerts',
        channelDescription: 'New installer jobs, complaints, and field alerts',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        visibility: NotificationVisibility.public,
      ),
    );

    await _plugin.show(id, title, body, details);
  }

  int stableIdFor(String input) => input.hashCode & 0x7fffffff;
}
