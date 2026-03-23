import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/app_card.dart';
import '../widgets/gradient_orb_background.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final mobileController = TextEditingController(text: '9876543210');
  final otpController = TextEditingController();
  bool otpRequested = false;

  @override
  void dispose() {
    mobileController.dispose();
    otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      body: GradientOrbBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF090D15), Color(0xFF111827)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(32),
                  border: Border.all(color: const Color(0x2239FF14)),
                  boxShadow: const [
                    BoxShadow(color: Color(0x26030B14), blurRadius: 26, offset: Offset(0, 12)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: const Color(0x1439FF14),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: const Color(0x6639FF14)),
                          ),
                          child: const Icon(Icons.wifi_rounded, color: Color(0xFF39FF14), size: 28),
                        ),
                        const Spacer(),
                        _heroChip('Secure OTP'),
                      ],
                    ),
                    const SizedBox(height: 22),
                    Text(
                      'Welcome to\nJustFiber',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        color: Colors.white,
                        fontSize: 34,
                        height: 1.05,
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Manage billing, Wi-Fi controls, support requests, and connection activity from one premium control app.',
                      style: TextStyle(color: Color(0xFFD1D5DB), height: 1.45),
                    ),
                    const SizedBox(height: 18),
                    Row(
                      children: const [
                        Expanded(child: _HeroMetric(value: '24x7', label: 'Support')),
                        SizedBox(width: 10),
                        Expanded(child: _HeroMetric(value: 'Live', label: 'Tracking')),
                        SizedBox(width: 10),
                        Expanded(child: _HeroMetric(value: 'OTP', label: 'Login')),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Login with mobile', style: theme.textTheme.headlineSmall?.copyWith(fontSize: 28)),
                    const SizedBox(height: 8),
                    const Text(
                      'Enter your registered mobile number to receive a one-time password and securely access your account.',
                      style: TextStyle(color: Color(0xFF64748B), height: 1.45),
                    ),
                    const SizedBox(height: 18),
                    _stepHeader('Step 1', 'Send OTP'),
                    const SizedBox(height: 10),
                    TextField(
                      controller: mobileController,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'Mobile number',
                        hintText: 'Enter 10-digit mobile number',
                        prefixIcon: Icon(Icons.phone_android_rounded),
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: appState.busy ? null : () => _sendOtp(appState),
                        child: Text(appState.busy && !otpRequested ? 'Sending OTP...' : 'Send OTP'),
                      ),
                    ),
                    if ((appState.demoOtp ?? '').isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0B0F19),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0x2239FF14)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.lock_clock_rounded, color: Color(0xFF39FF14)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Demo OTP',
                                    style: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    appState.demoOtp!,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 22,
                                      letterSpacing: 2,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 22),
                    _stepHeader('Step 2', 'Verify OTP'),
                    const SizedBox(height: 10),
                    TextField(
                      controller: otpController,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'One-time password',
                        hintText: 'Enter OTP',
                        prefixIcon: Icon(Icons.password_rounded),
                      ),
                    ),
                    const SizedBox(height: 14),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: appState.busy ? null : () => _verifyOtp(appState),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF39FF14),
                          foregroundColor: const Color(0xFF031B17),
                        ),
                        child: Text(appState.busy && otpRequested ? 'Verifying...' : 'Login to JustFiber'),
                      ),
                    ),
                    if ((appState.error ?? '').isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(
                          appState.error!,
                          style: const TextStyle(color: Color(0xFFB91C1C), fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text('Why use the app?', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
                    SizedBox(height: 14),
                    _BenefitRow(
                      icon: Icons.receipt_long_rounded,
                      title: 'Billing at a glance',
                      subtitle: 'Pay dues, open invoices, view receipts, and track payment history.',
                    ),
                    SizedBox(height: 12),
                    _BenefitRow(
                      icon: Icons.router_outlined,
                      title: 'Real Wi-Fi controls',
                      subtitle: 'Manage passwords, devices, guest Wi-Fi, diagnostics, and router actions.',
                    ),
                    SizedBox(height: 12),
                    _BenefitRow(
                      icon: Icons.support_agent_rounded,
                      title: 'Fast support access',
                      subtitle: 'Raise tickets, create requests, and track installer or complaint activity.',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stepHeader(String step, String title) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0x1439FF14),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: const Color(0x6639FF14)),
          ),
          child: Text(
            step,
            style: const TextStyle(color: Color(0xFF0B0F19), fontWeight: FontWeight.w800),
          ),
        ),
        const SizedBox(width: 10),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
      ],
    );
  }

  Widget _heroChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF101722),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x3339FF14)),
      ),
      child: Text(
        label,
        style: const TextStyle(color: Color(0xFF39FF14), fontWeight: FontWeight.w800),
      ),
    );
  }

  bool _validateMobile() {
    final mobile = mobileController.text.trim();
    if (mobile.length != 10 || int.tryParse(mobile) == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid 10-digit mobile number.')),
      );
      return false;
    }
    return true;
  }

  Future<void> _sendOtp(AppState appState) async {
    if (!_validateMobile()) return;
    setState(() => otpRequested = false);
    await appState.requestOtp(mobileController.text.trim());
    if (!mounted) return;
    setState(() => otpRequested = true);
  }

  Future<void> _verifyOtp(AppState appState) async {
    if (!_validateMobile()) return;
    if (otpController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter OTP before logging in.')),
      );
      return;
    }
    setState(() => otpRequested = true);
    await appState.verifyOtp(mobileController.text.trim(), otpController.text.trim());
  }
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({
    required this.value,
    required this.label,
  });

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF101722),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x3339FF14)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }
}

class _BenefitRow extends StatelessWidget {
  const _BenefitRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: const Color(0xFF0B0F19),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Icon(icon, color: const Color(0xFF39FF14)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 4),
              Text(subtitle, style: const TextStyle(color: Color(0xFF64748B), height: 1.4)),
            ],
          ),
        ),
      ],
    );
  }
}
