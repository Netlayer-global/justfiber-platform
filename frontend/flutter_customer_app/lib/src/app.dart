import 'package:flutter/material.dart';

import 'core/app_state.dart';
import 'core/theme.dart';
import 'screens/auth_gate.dart';

class JustFiberCustomerApp extends StatefulWidget {
  const JustFiberCustomerApp({super.key});

  @override
  State<JustFiberCustomerApp> createState() => _JustFiberCustomerAppState();
}

class _JustFiberCustomerAppState extends State<JustFiberCustomerApp> {
  final appState = AppState();

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
