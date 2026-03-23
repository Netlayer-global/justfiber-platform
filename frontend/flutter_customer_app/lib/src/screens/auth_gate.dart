import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import 'home_screen.dart';
import 'login_screen.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    if (appState.restoringSession) {
      return const _AuthGateLoading();
    }
    return appState.session == null ? const LoginScreen() : const HomeScreen();
  }
}

class _AuthGateLoading extends StatelessWidget {
  const _AuthGateLoading();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: AppCard(
            color: const Color(0xFF0C1018),
            borderColor: const Color(0x22E6FF3C),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: const [
                SizedBox(
                  width: 34,
                  height: 34,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.6,
                    valueColor: AlwaysStoppedAnimation(Color(0xFFE6FF3C)),
                  ),
                ),
                SizedBox(height: 18),
                Text(
                  'Restoring your JustFiber session',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Color(0xFFEFEEE8),
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Checking saved login, latest booking, and customer console state.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFF9CA3AF), height: 1.45),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
