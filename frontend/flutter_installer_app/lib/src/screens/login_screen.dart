import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/field_background.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final loginController = TextEditingController(text: '9000000001');
  final passwordController = TextEditingController(text: 'Installer123!');

  @override
  Widget build(BuildContext context) {
    final appState = InstallerStateScope.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: FieldBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                Text(
                  'INSTALLER CONSOLE',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: const Color(0xFF9CA3AF),
                    letterSpacing: 3.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text('JustFiber Field', style: theme.textTheme.headlineMedium),
                const SizedBox(height: 12),
                Text('Installer app for jobs, activation, diagnostics, and completion workflow.', style: theme.textTheme.bodyMedium?.copyWith(color: const Color(0xFFD1D5DB), height: 1.45)),
                const SizedBox(height: 28),
                TextField(
                  controller: loginController,
                  decoration: const InputDecoration(labelText: 'Phone or email'),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(labelText: 'Password'),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy ? null : () => appState.login(loginController.text, passwordController.text),
                    child: Text(appState.busy ? 'Signing in...' : 'Open Installer App'),
                  ),
                ),
                if ((appState.error ?? '').isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(appState.error!, style: const TextStyle(color: Color(0xFFFCA5A5))),
                ],
                const Spacer(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
