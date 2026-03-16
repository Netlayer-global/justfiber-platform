import 'package:flutter/material.dart';

import '../core/app_state.dart';
import 'home_screen.dart';
import 'login_screen.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    return appState.session == null ? const LoginScreen() : const HomeScreen();
  }
}
