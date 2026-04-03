import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/gradient_orb_background.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final identifierController = TextEditingController(text: '9876543210');
  final otpControllers = List.generate(6, (_) => TextEditingController());
  bool otpRequested = false;

  String get _otpValue => otpControllers.map((controller) => controller.text).join();

  Future<void> _handlePrimaryAction(AppState appState) async {
    final identifier = identifierController.text.trim();
    if (identifier.isEmpty) return;
    if (_otpValue.length == 6) {
      final ok = await appState.verifyOtp(identifier, _otpValue);
      if (!mounted) return;
      if (!ok) {
        setState(() => otpRequested = true);
      }
      return;
    }
    await appState.requestOtp(identifier);
    if (!mounted) return;
    if ((appState.error ?? '').isEmpty) {
      setState(() => otpRequested = true);
    }
  }

  @override
  void dispose() {
    identifierController.dispose();
    for (final controller in otpControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      body: GradientOrbBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 18, 24, 32),
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: MediaQuery.of(context).size.height - 70),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        height: 44,
                        width: 44,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          gradient: const LinearGradient(colors: [Color(0xFFA855F7), Color(0xFF8126CF)]),
                          boxShadow: const [
                            BoxShadow(color: Color(0x228126CF), blurRadius: 18, offset: Offset(0, 8)),
                          ],
                        ),
                        child: const Icon(Icons.router_rounded, color: Colors.white),
                      ),
                      const SizedBox(width: 12),
                      Text('FiberConnect', style: theme.textTheme.titleLarge?.copyWith(color: const Color(0xFF8126CF))),
                      const Spacer(),
                      IconButton(
                        onPressed: () {},
                        icon: const Icon(Icons.help_outline_rounded),
                        style: IconButton.styleFrom(backgroundColor: Colors.white.withOpacity(0.72)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 36),
                  Center(
                    child: Column(
                      children: [
                        Container(
                          height: 66,
                          width: 66,
                          decoration: BoxDecoration(
                            color: const Color(0xFFF3E8FF),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: const Icon(Icons.waving_hand_rounded, color: Color(0xFF8126CF), size: 34),
                        ),
                        const SizedBox(height: 20),
                        Text('Welcome back', style: theme.textTheme.headlineMedium, textAlign: TextAlign.center),
                        const SizedBox(height: 10),
                        Text(
                          'Enter your mobile number or account ID to securely access your high-speed world.',
                          style: theme.textTheme.bodyMedium,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 34),
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(32),
                      border: Border.all(color: Colors.white.withOpacity(0.65)),
                      boxShadow: const [
                        BoxShadow(color: Color(0x148126CF), blurRadius: 24, offset: Offset(0, 12)),
                      ],
                    ),
                    child: Column(
                      children: [
                        TextField(
                          controller: identifierController,
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'Mobile, customer ID, account ID, or email',
                            prefixIcon: Icon(Icons.person_outline_rounded),
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: appState.busy ? null : () => _handlePrimaryAction(appState),
                            child: Text(
                              appState.busy
                                  ? (_otpValue.length == 6 ? 'Verifying...' : 'Sending OTP...')
                                  : (_otpValue.length == 6 ? 'Verify & Log In' : 'Send OTP'),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(child: Divider(color: Colors.deepPurple.withOpacity(0.12))),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'VERIFICATION',
                                style: theme.textTheme.labelMedium?.copyWith(
                                  color: const Color(0x998126CF),
                                  letterSpacing: 1.8,
                                ),
                              ),
                            ),
                            Expanded(child: Divider(color: Colors.deepPurple.withOpacity(0.12))),
                          ],
                        ),
                        const SizedBox(height: 20),
                        Text(
                          'Enter 6-digit code',
                          style: theme.textTheme.labelMedium?.copyWith(letterSpacing: 1.4),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: List.generate(6, (index) {
                            return SizedBox(
                              width: 44,
                              child: TextField(
                                controller: otpControllers[index],
                                textAlign: TextAlign.center,
                                keyboardType: TextInputType.number,
                                maxLength: 1,
                                decoration: const InputDecoration(counterText: ''),
                                onChanged: (value) {
                                  if (value.isNotEmpty && index < 5) {
                                    FocusScope.of(context).nextFocus();
                                  }
                                },
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 18),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F3FF),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: const Color(0xFFE9D5FF)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.schedule_rounded, size: 16, color: Color(0xFF8126CF)),
                              const SizedBox(width: 8),
                              Text('Resend in 00:45', style: theme.textTheme.bodyMedium),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: appState.busy
                              ? null
                              : () async {
                                  await appState.requestOtp(identifierController.text.trim());
                                  if (!mounted) return;
                                  if ((appState.error ?? '').isEmpty) {
                                    setState(() => otpRequested = true);
                                  }
                                },
                          child: const Text('Resend OTP'),
                        ),
                        const SizedBox(height: 12),
                        if (!otpRequested)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Text(
                              'Tap Send OTP, then enter the 6-digit code in the same screen.',
                              style: theme.textTheme.bodySmall,
                              textAlign: TextAlign.center,
                            ),
                          ),
                        if ((appState.demoOtp ?? '').isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text('Demo OTP: ${appState.demoOtp}', style: theme.textTheme.bodyMedium),
                        ],
                        if ((appState.error ?? '').isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(appState.error!, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600)),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.44),
                      borderRadius: BorderRadius.circular(34),
                      border: Border.all(color: Colors.white.withOpacity(0.7)),
                    ),
                    child: Column(
                      children: [
                        Container(
                          height: 48,
                          width: 48,
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)),
                          child: const Icon(Icons.security_rounded, color: Color(0xFF8126CF)),
                        ),
                        const SizedBox(height: 12),
                        Text('Secured by FiberSafe', style: theme.textTheme.labelMedium?.copyWith(color: const Color(0xFF8126CF))),
                        const SizedBox(height: 6),
                        Text('End-to-end encrypted verification', style: theme.textTheme.bodyMedium, textAlign: TextAlign.center),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: Text.rich(
                      TextSpan(
                        text: 'By continuing, you agree to our ',
                        style: theme.textTheme.bodyMedium?.copyWith(fontSize: 12),
                        children: const [
                          TextSpan(text: 'Terms', style: TextStyle(color: Color(0xFF8126CF), fontWeight: FontWeight.w700)),
                          TextSpan(text: ' and '),
                          TextSpan(text: 'Privacy Policy', style: TextStyle(color: Color(0xFF8126CF), fontWeight: FontWeight.w700)),
                        ],
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
