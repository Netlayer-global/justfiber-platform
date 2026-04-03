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
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 460),
                child: Container(
                  padding: const EdgeInsets.all(28),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.82),
                    borderRadius: BorderRadius.circular(32),
                    border: Border.all(color: Colors.white.withOpacity(0.7)),
                    boxShadow: const [
                      BoxShadow(color: Color(0x148126CF), blurRadius: 24, offset: Offset(0, 12)),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        height: 54,
                        width: 54,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          gradient: const LinearGradient(colors: [Color(0xFF8126CF), Color(0xFFC284FF)]),
                        ),
                        child: const Icon(Icons.engineering_rounded, color: Colors.white, size: 28),
                      ),
                      const SizedBox(height: 20),
                      Text('JustFiber Field', style: theme.textTheme.headlineMedium),
                      const SizedBox(height: 10),
                      Text(
                        'Installer app for jobs, activation, diagnostics and completion workflow.',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        controller: loginController,
                        decoration: const InputDecoration(
                          labelText: 'Phone or email',
                          prefixIcon: Icon(Icons.person_outline_rounded),
                        ),
                      ),
                      const SizedBox(height: 14),
                      TextField(
                        controller: passwordController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Password',
                          prefixIcon: Icon(Icons.lock_outline_rounded),
                        ),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: appState.busy ? null : () => appState.login(loginController.text, passwordController.text),
                          child: Text(appState.busy ? 'Signing in...' : 'Open Installer App'),
                        ),
                      ),
                      if ((appState.error ?? '').isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(appState.error!, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600)),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
