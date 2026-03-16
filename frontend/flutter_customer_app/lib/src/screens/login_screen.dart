import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/gradient_orb_background.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final mobileController = TextEditingController(text: '9876543210');
  final otpController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: GradientOrbBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Spacer(),
                Text('JustFiber', style: theme.textTheme.headlineMedium),
                const SizedBox(height: 12),
                Text('Modern customer app with billing, Wi-Fi controls, usage and rewards.', style: theme.textTheme.bodyMedium),
                const SizedBox(height: 28),
                TextField(
                  controller: mobileController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Mobile number'),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy ? null : () => appState.requestOtp(mobileController.text),
                    child: Text(appState.busy ? 'Sending...' : 'Send OTP'),
                  ),
                ),
                if ((appState.demoOtp ?? '').isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text('Demo OTP: ${appState.demoOtp}', style: const TextStyle(color: Color(0xFFB8A8FF))),
                ],
                const SizedBox(height: 18),
                TextField(
                  controller: otpController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'OTP'),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: appState.busy ? null : () => appState.verifyOtp(mobileController.text, otpController.text),
                    child: Text(appState.busy ? 'Verifying...' : 'Login'),
                  ),
                ),
                if ((appState.error ?? '').isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(appState.error!, style: const TextStyle(color: Colors.redAccent)),
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
