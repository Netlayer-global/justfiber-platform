import 'package:flutter/material.dart';

import 'core/app_state.dart';
import 'core/theme.dart';
import 'screens/auth_gate.dart';

class JustFiberInstallerApp extends StatefulWidget {
  const JustFiberInstallerApp({super.key});

  @override
  State<JustFiberInstallerApp> createState() => _JustFiberInstallerAppState();
}

class _JustFiberInstallerAppState extends State<JustFiberInstallerApp> {
  final appState = InstallerAppState();

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
