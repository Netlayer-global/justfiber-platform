import 'package:flutter/material.dart';

import 'src/app.dart';
import 'src/core/notification_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await InstallerNotificationService.instance.initialize();
  runApp(const JustFiberInstallerApp());
}
