import 'package:flutter/material.dart';

import 'core/app_state.dart';
import 'core/theme.dart';
import 'screens/auth_gate.dart';

class JustFiberInstallerApp extends StatefulWidget {
  const JustFiberInstallerApp({super.key});

  @override
  State<JustFiberInstallerApp> createState() => _JustFiberInstallerAppState();
}

class _JustFiberInstallerAppState extends State<JustFiberInstallerApp> with WidgetsBindingObserver {
  final appState = InstallerAppState();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      appState.refreshNotificationsSilently();
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: appState,
      builder: (context, _) {
        return InstallerStateScope(
          appState: appState,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            title: 'JustFiber Installer',
            theme: buildInstallerTheme(),
            home: const AuthGate(),
          ),
        );
      },
    );
  }
}
