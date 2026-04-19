import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../core/theme.dart';
import '../widgets/app_card.dart';
import '../widgets/field_background.dart';
import 'home_screen.dart';
import 'login_screen.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    if (appState.restoringSession) {
      return Scaffold(
        body: FieldBackground(
          child: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: AppCard(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 68,
                        height: 68,
                        decoration: BoxDecoration(
                          color: kPrimary.withValues(alpha: 0.16),
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: kPrimary.withValues(alpha: 0.34)),
                        ),
                        child: const Padding(
                          padding: EdgeInsets.all(16),
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            color: kPrimaryLight,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Restoring installer session',
                        style: Theme.of(context).textTheme.titleLarge,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Checking saved credentials and loading your assigned field queue.',
                        style: TextStyle(color: kMuted, height: 1.45),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }
    return appState.session == null ? const LoginScreen() : const HomeScreen();
  }
}
