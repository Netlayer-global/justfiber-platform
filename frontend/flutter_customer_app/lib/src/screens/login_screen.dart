import 'package:flutter/material.dart';

import '../core/app_state.dart';
import '../widgets/gradient_orb_background.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final mobileController = TextEditingController();
  final otpController = TextEditingController();
  final pageController = PageController();
  int activePage = 0;
  bool otpRequested = false;

  final slides = const [
    _AuthSlide(
      title: 'Pay your internet bills',
      subtitle: 'View monthly bills, open invoices, and complete payments in a few taps.',
      icon: Icons.receipt_long_rounded,
      statLeft: 'Bills',
      statLeftValue: 'Live',
      statRight: 'Status',
      statRightValue: 'Synced',
    ),
    _AuthSlide(
      title: 'Monitor your connection',
      subtitle: 'Track service health, device activity, and support requests from one clean control surface.',
      icon: Icons.wifi_rounded,
      statLeft: 'Wi-Fi',
      statLeftValue: '24x7',
      statRight: 'Support',
      statRightValue: 'Fast',
    ),
  ];

  @override
  void dispose() {
    mobileController.dispose();
    otpController.dispose();
    pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = AppStateScope.of(context);
    final theme = Theme.of(context);

    return Scaffold(
      body: GradientOrbBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFFFF),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0x228224E3)),
                      ),
                      child: const Icon(Icons.wifi_rounded, color: Color(0xFF8224E3), size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'JUSTFIBER CONSOLE',
                            style: TextStyle(
                              color: Color(0xFF6E6A67),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 3.2,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'Customer Access',
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontSize: 24,
                              color: const Color(0xFF131313),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: PageView.builder(
                  controller: pageController,
                  itemCount: slides.length,
                  onPageChanged: (value) => setState(() => activePage = value),
                  itemBuilder: (context, index) => _AuthShowcaseCard(slide: slides[index]),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(
                    slides.length,
                    (index) => AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: activePage == index ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: activePage == index ? const Color(0xFF8224E3) : const Color(0xFFD9D1E9),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                ),
              ),
              Container(
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFFFF),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: const Color(0x338224E3)),
                  boxShadow: const [
                    BoxShadow(color: Color(0x26000000), blurRadius: 20, offset: Offset(0, 10)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      otpRequested ? 'Enter OTP to continue' : 'Login with mobile number',
                      style: theme.textTheme.titleLarge?.copyWith(color: const Color(0xFF131313)),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      otpRequested
                          ? 'We sent a one-time password to your registered mobile number.'
                          : 'Use your registered number to receive an OTP and access your broadband account.',
                      style: theme.textTheme.bodyMedium?.copyWith(color: const Color(0xFF6E6A67)),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: mobileController,
                      keyboardType: TextInputType.phone,
                      textInputAction: otpRequested ? TextInputAction.next : TextInputAction.done,
                      decoration: const InputDecoration(
                        labelText: 'Mobile number',
                        hintText: 'Enter 10-digit mobile number',
                        prefixIcon: Icon(Icons.phone_android_rounded),
                      ),
                    ),
                    if (otpRequested) ...[
                      const SizedBox(height: 12),
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
                    ],
                    if ((appState.error ?? '').isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF1F2),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0x66EF4444)),
                        ),
                        child: Text(
                          appState.error!,
                          style: const TextStyle(color: Color(0xFFBE123C), fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: appState.busy ? null : () => _handlePrimaryAction(appState),
                        child: Text(
                          appState.busy
                              ? (otpRequested ? 'Logging in...' : 'Sending OTP...')
                              : (otpRequested ? 'Submit & Login' : 'Send OTP'),
                        ),
                      ),
                    ),
                    if (otpRequested) ...[
                      const SizedBox(height: 8),
                      Center(
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: [
                            TextButton(
                              onPressed: appState.busy
                                  ? null
                                  : () async {
                                      otpController.clear();
                                      await _sendOtp(appState);
                                    },
                              child: const Text('Resend OTP'),
                            ),
                            TextButton(
                              onPressed: appState.busy
                                  ? null
                                  : () => setState(() {
                                        otpRequested = false;
                                        otpController.clear();
                                      }),
                              child: const Text('Change number'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _handlePrimaryAction(AppState appState) async {
    if (!otpRequested) {
      await _sendOtp(appState);
      return;
    }
    await _verifyOtp(appState);
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
    await appState.requestOtp(mobileController.text.trim());
    if (!mounted) return;
    if ((appState.error ?? '').isEmpty) {
      setState(() => otpRequested = true);
    }
  }

  Future<void> _verifyOtp(AppState appState) async {
    if (!_validateMobile()) return;
    if (otpController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter OTP before continuing.')),
      );
      return;
    }
    await appState.verifyOtp(mobileController.text.trim(), otpController.text.trim());
  }
}

class _AuthSlide {
  const _AuthSlide({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.statLeft,
    required this.statLeftValue,
    required this.statRight,
    required this.statRightValue,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String statLeft;
  final String statLeftValue;
  final String statRight;
  final String statRightValue;
}

class _AuthShowcaseCard extends StatelessWidget {
  const _AuthShowcaseCard({required this.slide});

  final _AuthSlide slide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: Column(
        children: [
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF17141C), Color(0xFF2E2737), Color(0xFF453559)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.circular(34),
                border: Border.all(color: const Color(0x22FFFFFF)),
                boxShadow: const [
                  BoxShadow(color: Color(0x22030B14), blurRadius: 24, offset: Offset(0, 10)),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 22, 20, 24),
                child: Column(
                  children: [
                    Row(
                      children: const [
                        Text(
                          '9:41',
                          style: TextStyle(color: Color(0xFFFFFFFF), fontWeight: FontWeight.w700),
                        ),
                        Spacer(),
                        Icon(Icons.signal_cellular_alt_rounded, color: Color(0xFFFFFFFF), size: 18),
                        SizedBox(width: 6),
                        Icon(Icons.wifi_rounded, color: Color(0xFFFFFFFF), size: 18),
                        SizedBox(width: 6),
                        Icon(Icons.battery_full_rounded, color: Color(0xFFFFFFFF), size: 18),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Expanded(
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0x33FFFFFF), Color(0x00000000), Color(0x22000000)],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                                borderRadius: BorderRadius.circular(28),
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.topCenter,
                            child: Padding(
                              padding: const EdgeInsets.only(top: 20),
                              child: Column(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                    decoration: BoxDecoration(
                                      color: const Color(0x1AFFFFFF),
                                      borderRadius: BorderRadius.circular(999),
                                      border: Border.all(color: const Color(0x22FFFFFF)),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        const Icon(Icons.wifi_rounded, color: Color(0xFFFFFFFF), size: 18),
                                        const SizedBox(width: 8),
                                        Text(
                                          'JustFiber',
                                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                                color: const Color(0xFFFFFFFF),
                                                fontWeight: FontWeight.w700,
                                              ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 26),
                                  _RouterShowcase(icon: slide.icon),
                                ],
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.bottomLeft,
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.fromLTRB(18, 28, 18, 18),
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [Color(0x00000000), Color(0xAA111017), Color(0xE6111017)],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    slide.title,
                                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                          fontSize: 34,
                                          height: 1.0,
                                          color: const Color(0xFFFFFFFF),
                                        ),
                                  ),
                                  const SizedBox(height: 10),
                                  Text(
                                    slide.subtitle,
                                    style: const TextStyle(color: Color(0xFFE5E7EB), height: 1.45),
                                  ),
                                  const SizedBox(height: 18),
                                  Row(
                                    children: [
                                      Expanded(child: _DarkMiniStat(value: slide.statLeftValue, label: slide.statLeft)),
                                      const SizedBox(width: 10),
                                      Expanded(child: _DarkMiniStat(value: slide.statRightValue, label: slide.statRight)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DarkMiniStat extends StatelessWidget {
  const _DarkMiniStat({
    required this.value,
    required this.label,
  });

  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0x1AFFFFFF),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0x22FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFFFFFFFF))),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: Color(0xFFE5E7EB), fontSize: 11)),
        ],
      ),
    );
  }
}

class _RouterShowcase extends StatelessWidget {
  const _RouterShowcase({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 260,
      height: 300,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 260,
            height: 260,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [Color(0x448224E3), Color(0x00000000)],
              ),
            ),
          ),
          Positioned(
            top: 16,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0x55FFFFFF), width: 1.5),
              ),
              child: const Icon(Icons.wifi_rounded, color: Color(0xFFFFFFFF), size: 44),
            ),
          ),
          Positioned(
            top: 76,
            child: Container(
              width: 190,
              height: 2,
              color: const Color(0x55FFFFFF),
            ),
          ),
          Positioned(
            left: 52,
            top: 90,
            child: Container(
              width: 12,
              height: 70,
              decoration: BoxDecoration(
                color: const Color(0xFFF6F1EB),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          Positioned(
            right: 52,
            top: 90,
            child: Container(
              width: 12,
              height: 70,
              decoration: BoxDecoration(
                color: const Color(0xFFF6F1EB),
                borderRadius: BorderRadius.circular(999),
              ),
            ),
          ),
          Positioned(
            bottom: 54,
            child: Container(
              width: 188,
              height: 96,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFFF7F4FB), Color(0xFFE7DDF7)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(28),
                boxShadow: const [
                  BoxShadow(color: Color(0x33000000), blurRadius: 24, offset: Offset(0, 12)),
                ],
              ),
              child: Column(
                children: [
                  const SizedBox(height: 16),
                  Container(
                    width: 56,
                    height: 6,
                    decoration: BoxDecoration(
                      color: const Color(0xFF8224E3),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Icon(icon, color: const Color(0xFF8224E3), size: 28),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      4,
                      (index) => Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: BoxDecoration(
                          color: index == 0 ? const Color(0xFF22C55E) : const Color(0x558224E3),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}



