import 'package:flutter/material.dart';

import 'core/app_state.dart';
import 'core/notification_service.dart';
import 'core/theme.dart';
import 'screens/auth_gate.dart';

class JustFiberCustomerApp extends StatefulWidget {
  const JustFiberCustomerApp({super.key});

  @override
  State<JustFiberCustomerApp> createState() => _JustFiberCustomerAppState();
}

class _JustFiberCustomerAppState extends State<JustFiberCustomerApp> with WidgetsBindingObserver {
  final appState = AppState();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setupNotificationBridge();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      appState.refresh();
    }
  }

  Future<void> _setupNotificationBridge() async {
    await CustomerNotificationService.instance.initialize();
    CustomerNotificationService.instance.tapStream.listen(appState.handleNotificationPayload);
    final initialPayload = CustomerNotificationService.instance.takeInitialPayload();
    if (initialPayload != null && initialPayload.isNotEmpty) {
      appState.handleNotificationPayload(initialPayload);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: appState,
      builder: (context, _) {
        return AppStateScope(
          appState: appState,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            title: 'JustFiber',
            theme: buildJustFiberTheme(),
            home: const AuthGate(),
          ),
        );
      },
    );
  }
}
